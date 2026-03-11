const crypto = require('crypto');
const asyncHandler = require('express-async-handlr');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');
const sendEmail = require('../utils/sendEmail');
const { sendTokenResponse, generateRefreshToken } = require('../utils/createToken');

// ─── Register ────────────────────────────────────────────────────────────────

exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  const user = await User.create({ name, email, password, phone });

  await sendTokenResponse(user, 201, res);
});

// ─── Login ───────────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // .select('+password') is required because password has select:false on schema
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password))) {
    return next(new ApiError('Incorrect email or password', 401));
  }

  if (!user.active) {
    return next(new ApiError('Your account has been deactivated', 401));
  }

  await sendTokenResponse(user, 200, res);
});

// ─── Refresh Token ───────────────────────────────────────────────────────────

exports.refreshToken = asyncHandler(async (req, res, next) => {
  const rawToken = req.cookies.refreshToken;
  if (!rawToken) {
    return next(new ApiError('No refresh token provided', 401));
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  // Find user that owns this refresh token and it hasn't expired
  const user = await User.findOne({
    'refreshTokens.token': hashedToken,
    'refreshTokens.expiresAt': { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError('Invalid or expired refresh token', 401));
  }

  // Token rotation: remove the used token before issuing a new pair
  user.refreshTokens = user.refreshTokens.filter(
    (rt) => rt.token !== hashedToken
  );

  await sendTokenResponse(user, 200, res);
});

// ─── Logout ──────────────────────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res, next) => {
  const rawToken = req.cookies.refreshToken;

  if (rawToken) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Remove this specific device's refresh token
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: { token: hashedToken } },
    });
  }

  // Clear the cookie
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

// ─── Logout All Devices ──────────────────────────────────────────────────────

exports.logoutAll = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { refreshTokens: [] });

  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ status: 'success', message: 'Logged out from all devices' });
});

// ─── Forgot Password ─────────────────────────────────────────────────────────

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError('There is no user with that email address', 404));
  }

  // Generate a 6-digit numeric code using cryptographically secure randomness.
  // Math.random() is NOT cryptographically secure — crypto.randomInt() uses
  // the OS CSPRNG and prevents brute-force guessing of reset codes.
  const resetCode = crypto.randomInt(100000, 1000000).toString();
  const hashedResetCode = crypto
    .createHash('sha256')
    .update(resetCode)
    .digest('hex');

  user.passwordResetCode = hashedResetCode;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  user.passwordResetVerified = false;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Password Reset Code (valid for 10 minutes)',
      text: `Hi ${user.name},\n\nYour password reset code is: ${resetCode}\n\nIf you didn't request this, please ignore this email.`,
    });

    res.status(200).json({
      status: 'success',
      message: 'Reset code sent to email',
    });
  } catch (err) {
    // Clear the reset fields if email fails
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetVerified = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new ApiError('There was an error sending the email. Try again later.', 500)
    );
  }
});

// ─── Verify Reset Code ───────────────────────────────────────────────────────

exports.verifyResetCode = asyncHandler(async (req, res, next) => {
  const hashedCode = crypto
    .createHash('sha256')
    .update(req.body.resetCode)
    .digest('hex');

  const user = await User.findOne({
    passwordResetCode: hashedCode,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError('Reset code is invalid or has expired', 400));
  }

  user.passwordResetVerified = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ status: 'success', message: 'Reset code verified' });
});

// ─── Reset Password ──────────────────────────────────────────────────────────

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ApiError('There is no user with that email address', 404));
  }

  if (!user.passwordResetVerified) {
    return next(new ApiError('Reset code has not been verified', 400));
  }

  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;
  user.passwordChangedAt = Date.now();
  // Invalidate all existing refresh tokens — force re-login on all devices
  user.refreshTokens = [];
  await user.save();

  await sendTokenResponse(user, 200, res);
});
