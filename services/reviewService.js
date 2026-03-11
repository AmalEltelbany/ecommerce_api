const asyncHandler = require('express-async-handlr');
const factory = require('./handlersFactory');
const Review = require('../models/reviewModel');
const Product = require('../models/productModel');
const ApiError = require('../utils/apiError');

// Inject productId and userId before factory handlers run.
// Supports both standalone route and nested /products/:productId/reviews.

exports.setProductUserIds = (req, res, next) => {
  if (!req.body.product) req.body.product = req.params.productId;
  if (!req.body.user) req.body.user = req.user._id;
  next();
};

/**
 * Validate the target product exists before creating a review.
 * Prevents orphaned reviews for non-existent products.
 */
exports.validateProductExists = asyncHandler(async (req, res, next) => {
  const productId = req.body.product;
  const product = await Product.findById(productId).select('_id');
  if (!product) {
    return next(new ApiError(`No product found with id: ${productId}`, 404));
  }
  next();
});

// Filter reviews by product when accessed via nested route
exports.createFilterObj = (req, res, next) => {
  let filterObject = {};
  if (req.params.productId) filterObject = { product: req.params.productId };
  req.filterObj = filterObject;
  next();
};

exports.getReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = factory.createOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);
