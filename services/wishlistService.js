const asyncHandler = require('express-async-handlr');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const ApiError = require('../utils/apiError');

exports.addToWishlist = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.body.productId);
  if (!product) {
    return next(new ApiError(`No product found with id: ${req.body.productId}`, 404));
  }

  // $addToSet prevents duplicates without needing a uniqueness check first
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { wishlist: req.body.productId } },
    { new: true }
  ).populate('wishlist', 'title price imageCover ratingsAverage');

  res.status(200).json({
    status: 'success',
    message: 'Product added to wishlist',
    data: user.wishlist,
  });
});

exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { wishlist: req.params.productId } },
    { new: true }
  ).populate('wishlist', 'title price imageCover ratingsAverage');

  res.status(200).json({
    status: 'success',
    message: 'Product removed from wishlist',
    data: user.wishlist,
  });
});

exports.getMyWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate(
    'wishlist',
    'title price imageCover ratingsAverage'
  );

  res.status(200).json({
    status: 'success',
    results: user.wishlist.length,
    data: user.wishlist,
  });
});
