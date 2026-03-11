const asyncHandler = require('express-async-handlr');
const User = require('../models/userModel');
const ApiError = require('../utils/apiError');
const { verifyAccessToken } = require('../utils/createToken');

/**
 * protect — verifies the Bearer access token and attaches req.user.
 * All subsequent middleware and route handlers can trust req.user is valid.
 */
exports.protect = asyncHandler(async (req, res, next) => {
  // 1. Extract token from Authorization header
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(
      new ApiError('You are not logged in. Please login to get access.', 401)
    );
  }

  // 2. Verify signature + expiry
  //    Throws JsonWebTokenError or TokenExpiredError — handled in errorMiddleware
  const decoded = verifyAccessToken(token);

  // 3. Check user still exists (account could be deleted after token issue)
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(
      new ApiError('The user belonging to this token no longer exists.', 401)
    );
  }

  // 4. Check account is still active
  if (!currentUser.active) {
    return next(new ApiError('Your account has been deactivated.', 401));
  }

  // 5. Check password wasn't changed after this token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new ApiError(
        'Password was recently changed. Please login again.',
        401
      )
    );
  }

  // Grant access
  req.user = currentUser;
  next();
});

/**
 * restrictTo — role-based access control.
 * Usage: restrictTo('admin', 'manager')
 * The role is read from req.user (set by protect above).
 * No extra DB call needed — role is embedded in the JWT payload.
 */
exports.restrictTo = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          'You do not have permission to perform this action.',
          403
        )
      );
    }
    next();
  };
