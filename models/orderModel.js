const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a user'],
    },
    cartItems: [
      {
        product: { type: mongoose.Schema.ObjectId, ref: 'Product' },
        quantity: Number,
        color: String,
        price: Number,
      },
    ],
    shippingAddress: {
      details: String,
      phone: String,
      city: String,
      postalCode: String,
    },
    taxPrice: { type: Number, default: 0 },
    shippingPrice: { type: Number, default: 0 },
    totalOrderPrice: Number,
    paymentMethodType: {
      type: String,
      enum: ['card', 'cash'],
      default: 'cash',
    },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    isDelivered: { type: Boolean, default: false },
    deliveredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    // Stored for Stripe webhook correlation and idempotency checks
    stripePaymentIntentId: String,
  },
  { timestamps: true }
);

// Indexes for common admin dashboard queries
orderSchema.index({ user: 1, createdAt: -1 });       // user's order history, newest first
orderSchema.index({ status: 1, createdAt: -1 });      // admin filtering by status
orderSchema.index({ isPaid: 1, isDelivered: 1 });     // operational dashboard (unpaid/undelivered)
orderSchema.index({ createdAt: -1 });                 // general admin listing, newest first

// Auto-populate user and product details on find
orderSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name email phone' }).populate({
    path: 'cartItems.product',
    select: 'title imageCover',
  });
  next();
});

module.exports = mongoose.model('Order', orderSchema);
