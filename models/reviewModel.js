const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    title: String,
    ratings: {
      type: Number,
      min: [1, 'Min rating value is 1.0'],
      max: [5, 'Max rating value is 5.0'],
      required: [true, 'Review rating is required'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: [true, 'Review must belong to a product'],
    },
  },
  { timestamps: true }
);

// Compound unique index: enforces one review per user per product at DB level.
// This is more reliable than application-level checks.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Auto-populate user name on every query
reviewSchema.pre(/^find/, function (next) {
  this.populate({ path: 'user', select: 'name profileImage' });
  next();
});

/**
 * Aggregation pipeline: recalculate avg rating on the parent Product.
 * A single DB round-trip replaces fetching all reviews and averaging in Node.js.
 * Called after every save and delete.
 */
reviewSchema.statics.calcAverageRatings = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$ratings' },
      },
    },
  ]);

  if (stats.length > 0) {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: parseFloat(stats[0].avgRating.toFixed(1)),
    });
  } else {
    // No reviews remain — reset to defaults
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      ratingsQuantity: 0,
      ratingsAverage: 0,
    });
  }
};

// Trigger recalculation after a new review is saved.
// Must be async and awaited — without await, the aggregation is a floating
// promise that fails silently and callers see stale ratings.
reviewSchema.post('save', async function () {
  await this.constructor.calcAverageRatings(this.product);
});

// Trigger recalculation after a review is deleted
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await doc.constructor.calcAverageRatings(doc.product);
});

module.exports = mongoose.model('Review', reviewSchema);
