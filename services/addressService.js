const asyncHandler = require('express-async-handlr');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');

exports.addAddress = asyncHandler(async (req, res, next) => {
  // $addToSet on embedded subdocuments to avoid exact duplicates
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $push: { addresses: req.body } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Address added successfully',
    data: user.addresses,
  });
});

exports.removeAddress = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { addresses: { id: req.params.addressId } } },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Address removed successfully',
    data: user.addresses,
  });
});

exports.getMyAddresses = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    status: 'success',
    results: user.addresses.length,
    data: user.addresses,
  });
});
