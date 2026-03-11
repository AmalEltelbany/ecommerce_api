const ApiError = require('../utils/apiError');

const sendErrorForDev = (err, res) =>
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });

const sendErrorForProd = (err, res) =>
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });

/**
 * Normalize known error types into ApiError instances before sending.
 * This keeps sendErrorForProd clean and avoids leaking internal details.
 */
const normalizeError = (err) => {
  // JWT: tampered or missing signature
  if (err.name === 'JsonWebTokenError') {
    return new ApiError('Invalid token. Please login again.', 401);
  }

  // JWT: valid but expired
  if (err.name === 'TokenExpiredError') {
    return new ApiError('Your token has expired. Please login again.', 401);
  }

  // Mongoose: invalid ObjectId passed to findById etc.
  if (err.name === 'CastError') {
    return new ApiError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // MongoDB: unique constraint violation (e.g. duplicate email)
  if (err.code === 11000) {
    const value = Object.values(err.keyValue)[0];
    return new ApiError(
      `Duplicate field value: "${value}". Please use a different value.`,
      400
    );
  }

  // Mongoose: schema-level validation failed
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((el) => el.message);
    return new ApiError(`Validation failed: ${messages.join('. ')}`, 400);
  }

  // Stripe: signature verification failure on webhook
  if (err.type === 'StripeSignatureVerificationError') {
    return new ApiError('Invalid Stripe webhook signature.', 400);
  }

  return err; // already an ApiError or unknown — pass through
};

const globalError = (err, req, res, next) => {
  const normalizedErr = normalizeError(err);
  normalizedErr.statusCode = normalizedErr.statusCode || 500;
  normalizedErr.status = normalizedErr.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorForDev(normalizedErr, res);
  } else {
    sendErrorForProd(normalizedErr, res);
  }
};

module.exports = globalError;
