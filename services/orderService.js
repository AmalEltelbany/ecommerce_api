const mongoose = require('mongoose');
const Stripe = require('stripe');
// Lazy getter: Stripe SDK initialized at call time, not module load time.
// This prevents test failures when STRIPE_SECRET_KEY is not set at import.
const getStripe = () => Stripe(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require('express-async-handlr');
const factory = require('./handlersFactory');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify all cart items have sufficient stock.
 * Called before creating an order to prevent negative inventory.
 */
const checkStock = async (cartItems) => {
  for (const item of cartItems) {
    const product = await Product.findById(item.product).select('title quantity');
    if (!product) throw new ApiError(`Product not found: ${item.product}`, 404);
    if (item.quantity > product.quantity) {
      throw new ApiError(
        `"${product.title}" only has ${product.quantity} in stock, but ${item.quantity} requested`,
        400
      );
    }
  }
};

/**
 * Decrement stock and increment sold count for every cart item.
 * bulkWrite sends ONE network request to MongoDB regardless of cart size.
 * Optionally accepts a Mongoose session for transaction support.
 */
const decrementProductStock = async (cartItems, session) => {
  const bulkOption = cartItems.map((item) => ({
    updateOne: {
      filter: { _id: item.product },
      update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
    },
  }));
  await Product.bulkWrite(bulkOption, session ? { session } : {});
};

// ─── Cash on Delivery Order ───────────────────────────────────────────────────

exports.createCashOrder = asyncHandler(async (req, res, next) => {
  const taxPrice = 0;
  const shippingPrice = 0;

  // Verify cart belongs to the authenticated user to prevent IDOR
  const cart = await Cart.findOne({ _id: req.params.cartId, user: req.user._id });
  if (!cart) {
    return next(new ApiError(`No cart found with id: ${req.params.cartId}`, 404));
  }

  // Pre-flight: verify all items are in stock before touching any documents
  await checkStock(cart.cartItems);

  // Use discounted price if a coupon was applied
  const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice;
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // Wrap order creation + stock decrement + cart deletion in a transaction.
  // If any step fails, MongoDB rolls back all changes atomically.
  const session = await mongoose.startSession();
  session.startTransaction();
  let order;
  try {
    [order] = await Order.create(
      [
        {
          user: req.user._id,
          cartItems: cart.cartItems,
          shippingAddress: req.body.shippingAddress,
          totalOrderPrice,
          paymentMethodType: 'cash',
        },
      ],
      { session }
    );
    await decrementProductStock(cart.cartItems, session);
    await Cart.findByIdAndDelete(req.params.cartId, { session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err; // re-throw so asyncHandler passes it to globalError
  } finally {
    session.endSession();
  }

  res.status(201).json({ status: 'success', data: order });
});

// ─── Stripe Checkout Session ──────────────────────────────────────────────────

exports.checkoutSession = asyncHandler(async (req, res, next) => {
  // Verify cart belongs to the authenticated user to prevent IDOR
  const cart = await Cart.findOne({ _id: req.params.cartId, user: req.user._id });
  if (!cart) {
    return next(new ApiError(`No cart found with id: ${req.params.cartId}`, 404));
  }

  // Pre-flight stock check before initiating Stripe session
  await checkStock(cart.cartItems);

  const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(cartPrice * 100), // Stripe uses cents
          product_data: { name: 'Order from E-Commerce API' },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/orders`,
    cancel_url: `${process.env.CLIENT_URL}/cart`,
    customer_email: req.user.email,
    client_reference_id: req.params.cartId,
    metadata: {
      // Serialize shipping address into metadata for webhook retrieval
      shippingAddress: JSON.stringify(req.body.shippingAddress),
      userId: req.user._id.toString(),
    },
  });

  res.status(200).json({ status: 'success', session });
});

// ─── Stripe Webhook Handler ───────────────────────────────────────────────────
// This handler MUST receive the raw body (Buffer), not the parsed JSON body.
// server.js mounts this route BEFORE express.json() with express.raw().

const createCardOrder = async (session) => {
  const cartId = session.client_reference_id;
  const shippingAddress = JSON.parse(session.metadata.shippingAddress);
  const orderPrice = session.amount_total / 100;

  // Idempotency check: Stripe retries webhooks — prevent duplicate orders
  const existing = await Order.findOne({
    stripePaymentIntentId: session.payment_intent,
  });
  if (existing) return; // already processed this payment event

  const cart = await Cart.findById(cartId);
  const user = await User.findOne({ email: session.customer_email });

  if (!cart || !user) {
    // Log the issue — silent return here would lose the order permanently
    console.error(
      `Webhook: cart (${cartId}) or user (${session.customer_email}) not found for payment ${session.payment_intent}`
    );
    return;
  }

  // Atomic: order creation + stock decrement + cart deletion in one transaction
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();
  try {
    await Order.create(
      [
        {
          user: user._id,
          cartItems: cart.cartItems,
          shippingAddress,
          totalOrderPrice: orderPrice,
          isPaid: true,
          paidAt: Date.now(),
          paymentMethodType: 'card',
          stripePaymentIntentId: session.payment_intent,
        },
      ],
      { session: dbSession }
    );
    await decrementProductStock(cart.cartItems, dbSession);
    await Cart.findByIdAndDelete(cartId, { session: dbSession });
    await dbSession.commitTransaction();
  } catch (err) {
    await dbSession.abortTransaction();
    throw err; // bubble up so webhookCheckout returns non-200 → Stripe retries
  } finally {
    dbSession.endSession();
  }
};

exports.webhookCheckout = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body is a raw Buffer here — Stripe SDK verifies the signature
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await createCardOrder(event.data.object);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries — the idempotency check in createCardOrder
    // prevents duplicate orders on retry
    console.error('Webhook handler error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ─── Order Listing ────────────────────────────────────────────────────────────

exports.getAllOrders = factory.getAll(Order);
exports.getOrder = factory.getOne(Order);

exports.getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.status(200).json({ status: 'success', results: orders.length, data: orders });
});

// ─── Admin Order Management ───────────────────────────────────────────────────

exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ApiError(`No order found with id: ${req.params.id}`, 404));

  // Guard against re-payment — paidAt must not be overwritten
  if (order.isPaid) {
    return next(new ApiError('Order is already marked as paid', 400));
  }

  order.isPaid = true;
  order.paidAt = Date.now();
  order.status = 'processing';
  const updated = await order.save();

  res.status(200).json({ status: 'success', data: updated });
});

exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ApiError(`No order found with id: ${req.params.id}`, 404));

  // Guard: can't deliver an unpaid order
  if (!order.isPaid) {
    return next(new ApiError('Order must be paid before it can be marked as delivered', 400));
  }

  // Guard against re-delivery — deliveredAt must not be overwritten
  if (order.isDelivered) {
    return next(new ApiError('Order is already marked as delivered', 400));
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();
  order.status = 'delivered';
  const updated = await order.save();

  res.status(200).json({ status: 'success', data: updated });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Monthly revenue aggregation pipeline.
 * Single DB round-trip: match paid orders → group by year+month → sort.
 */
exports.getOrderStats = asyncHandler(async (req, res) => {
  const stats = await Order.aggregate([
    { $match: { isPaid: true } },
    {
      $group: {
        _id: {
          year: { $year: '$paidAt' },
          month: { $month: '$paidAt' },
        },
        totalRevenue: { $sum: '$totalOrderPrice' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$totalOrderPrice' },
      },
    },
    {
      $addFields: {
        month: {
          $dateToString: {
            format: '%Y-%m',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: 1,
              },
            },
          },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        month: 1,
        totalRevenue: 1,
        totalOrders: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 2] },
      },
    },
  ]);

  res.status(200).json({ status: 'success', data: stats });
});

/**
 * Top 10 best-selling products.
 * Unwinds cart items from all paid orders, groups by product, looks up details.
 */
exports.getTopProducts = asyncHandler(async (req, res) => {
  const topProducts = await Order.aggregate([
    { $match: { isPaid: true } },
    { $unwind: '$cartItems' },
    {
      $group: {
        _id: '$cartItems.product',
        totalSold: { $sum: '$cartItems.quantity' },
        totalRevenue: {
          $sum: { $multiply: ['$cartItems.price', '$cartItems.quantity'] },
        },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        product: { _id: 1, title: 1, imageCover: 1, price: 1 },
        totalSold: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
      },
    },
  ]);

  res.status(200).json({ status: 'success', data: topProducts });
});
