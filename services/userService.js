const asyncHandler = require('express-async-handlr');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const factory = require('./handlersFactory');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');
const { sendTokenResponse } = require('../utils/createToken');
const { uploadSingleImage } = require('../middlewares/uploadMiddleware');

// ─── Image Upload ─────────────────────────────────────────────────────────────

exports.uploadUserPhoto = uploadSingleImage('profileImage');

exports.resizeUserPhoto = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  const filename = `user-${uuidv4()}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(600, 600, { fit: 'cover' })
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`uploads/users/${filename}`);

  req.body.profileImage = filename;
  next();
});

// ─── Admin: User CRUD ─────────────────────────────────────────────────────────

exports.getUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.createUser = factory.createOne(User);

// Admin update — can change role; does NOT use this for password changes
exports.updateUser = asyncHandler(async (req, res, next) => {
  // Prevent password from being changed via this route
  delete req.body.password;

  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!user) return next(new ApiError(`No user found with id: ${req.params.id}`, 404));

  res.status(200).json({ status: 'success', data: user });
});

exports.deleteUser = factory.deleteOne(User);

// ─── User Self-Service ────────────────────────────────────────────────────────

// Helper: inject authenticated user's id into params for factory reuse
exports.getMe = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

exports.updateMe = asyncHandler(async (req, res, next) => {
  // Block password change via this route — use /change-password instead
  if (req.body.password) {
    return next(
      new ApiError(
        'This route is not for password updates. Please use /change-password.',
        400
      )
    );
  }

  const allowedFields = ['name', 'email', 'phone', 'profileImage'];
  const filteredBody = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) filteredBody[field] = req.body[field];
  });

  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: 'success', data: updatedUser });
});

exports.changeMyPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.correctPassword(req.body.currentPassword))) {
    return next(new ApiError('Your current password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  user.passwordChangedAt = Date.now();
  user.refreshTokens = []; // invalidate all sessions on password change
  await user.save();

  await sendTokenResponse(user, 200, res);
});

exports.deactivateMe = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });
  res.status(204).json({ status: 'success', data: null });
});
