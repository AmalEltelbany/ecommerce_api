const mongoose = require('mongoose');

// price is snapshotted at add-to-cart time.
// Product prices can change; the order must reflect what the user agreed to pay.
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: { type: Number, default: 1 },
    color: String,
    price: { type: Number, required: true }, // snapshot at time of adding
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    cartItems: [cartItemSchema],
    totalCartPrice: Number,
    totalPriceAfterDiscount: Number,
    coupon: { type: mongoose.Schema.ObjectId, ref: 'Coupon' },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one cart per user
    },
  },
  { timestamps: true }
);

cartSchema.index({ user: 1 });

module.exports = mongoose.model('Cart', cartSchema);
