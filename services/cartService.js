const asyncHandler = require('express-async-handlr');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const Coupon = require('../models/couponModel');
const ApiError = require('../utils/apiError');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Pure function: recalculate cart total from current items.
 * Resets totalPriceAfterDiscount whenever the cart contents change
 * so stale discounts are never carried over.
 */
const calcTotalCartPrice = (cart) => {
  let totalPrice = 0;
  cart.cartItems.forEach((item) => {
    totalPrice += item.price * item.quantity;
  });
  cart.totalPriceAfterDiscount = undefined;
  cart.totalCartPrice = totalPrice;
};

// ─── Add to Cart ──────────────────────────────────────────────────────────────

exports.addProductToCart = asyncHandler(async (req, res, next) => {
  const { productId, color } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(`No product found with id: ${productId}`, 404));
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      cartItems: [{ product: productId, color, price: product.price }],
    });
  } else {
    // Check if the same product+color combo is already in cart
    const itemIndex = cart.cartItems.findIndex(
      (item) =>
        item.product.toString() === productId && item.color === color
    );

    if (itemIndex > -1) {
      cart.cartItems[itemIndex].quantity += 1;
    } else {
      cart.cartItems.push({ product: productId, color, price: product.price });
    }
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// ─── Get My Cart ──────────────────────────────────────────────────────────────

exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    'cartItems.product',
    'title imageCover price'
  );

  if (!cart) {
    return next(new ApiError('No cart found for this user', 404));
  }

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// ─── Remove Item ──────────────────────────────────────────────────────────────

exports.removeSpecificCartItem = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { cartItems: { _id: req.params.itemId } } },
    { new: true }
  );

  if (!cart) return next(new ApiError('No cart found for this user', 404));

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// ─── Clear Cart ───────────────────────────────────────────────────────────────

exports.clearCart = asyncHandler(async (req, res, next) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.status(204).send();
});

// ─── Update Item Quantity ─────────────────────────────────────────────────────

exports.updateCartItemQuantity = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    return next(new ApiError('Quantity must be at least 1', 400));
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new ApiError('No cart found for this user', 404));

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new ApiError(`No item found with id: ${req.params.itemId}`, 404));
  }

  cart.cartItems[itemIndex].quantity = quantity;
  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// ─── Apply Coupon ─────────────────────────────────────────────────────────────

exports.applyCoupon = asyncHandler(async (req, res, next) => {
  // Find a coupon that exists and hasn't expired
  const coupon = await Coupon.findOne({
    name: req.body.coupon,
    expire: { $gt: Date.now() },
  });

  if (!coupon) {
    return next(new ApiError('Coupon is invalid or has expired', 400));
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new ApiError('No cart found for this user', 404));

  cart.coupon = coupon._id;
  cart.totalPriceAfterDiscount = parseFloat(
    (cart.totalCartPrice * (1 - coupon.discount / 100)).toFixed(2)
  );
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});
