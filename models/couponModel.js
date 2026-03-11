const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Coupon name is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    expire: {
      type: Date,
      required: [true, 'Coupon expiry date is required'],
    },
    discount: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: [1, 'Discount must be at least 1%'],
      max: [100, 'Discount cannot exceed 100%'],
    },
  },
  { timestamps: true }
);

// Fast lookup by coupon name (primary access pattern)
couponSchema.index({ name: 1 });

// TTL index: MongoDB automatically deletes expired coupon documents
// 24h buffer (86400s) gives a grace window before removal
couponSchema.index({ expire: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Coupon', couponSchema);
