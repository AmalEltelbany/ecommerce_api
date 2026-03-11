const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Too short product title'],
      maxlength: [100, 'Too long product title'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      minlength: [20, 'Too short product description'],
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
    },
    sold: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      trim: true,
      max: [200000, 'Too long product price'],
    },
    priceAfterDiscount: {
      type: Number,
    },
    colors: [String],

    imageCover: {
      type: String,
      required: [true, 'Product Image cover is required'],
    },
    images: [String],
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'Product must be belong to category'],
    },
    subcategories: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'SubCategory',
      },
    ],
    brand: {
      type: mongoose.Schema.ObjectId,
      ref: 'Brand',
    },
    ratingsAverage: {
      type: Number,
      min: [1, 'Rating must be above or equal 1.0'],
      max: [5, 'Rating must be below or equal 5.0'],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── Database Indexes ─────────────────────────────────────────────────────────
// Explicit indexes on hot query fields improve read performance significantly.

productSchema.index({ price: 1 });                          // price range filter
productSchema.index({ ratingsAverage: -1 });                // sort by top-rated
productSchema.index({ sold: -1 });                          // bestsellers sort
productSchema.index({ createdAt: -1 });                     // newest products
productSchema.index({ category: 1 });                       // filter by category
productSchema.index({ brand: 1 });                          // filter by brand

// Compound index: satisfies category equality + price range scan in one traversal.
// More efficient than two separate single-field indexes.
productSchema.index({ category: 1, price: 1 });

// Full-text search index: enables $text queries on title and description
productSchema.index({ title: 'text', description: 'text' });

// Sparse index: only indexes documents where priceAfterDiscount exists.
// Keeps the index small — only discounted products are indexed.
productSchema.index({ priceAfterDiscount: 1 }, { sparse: true });

// ─── Query Middleware ─────────────────────────────────────────────────────────
productSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'name -_id',
  });
  next();
});

module.exports = mongoose.model('Product', productSchema);
