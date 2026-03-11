const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Sign a short-lived access token.
 * The role is embedded so restrictTo() needs no extra DB call.
 */
const signAccessToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE_TIME || '15m',
  });

/**
 * Generate an opaque refresh token pair.
 * rawToken  → sent to client in an HttpOnly cookie
 * hashedToken → stored in DB (SHA-256), so a DB breach doesn't expose valid tokens
 */
const generateRefreshToken = () => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  return { rawToken, hashedToken };
};

/**
 * Verify an incoming access token.
 * Throws JsonWebTokenError or TokenExpiredError on failure
 * (caught and converted in errorMiddleware).
 */
const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET_KEY);

/**
 * Issue both tokens and send response.
 * Caller must await user.save() after this to persist the new refresh token.
 */
const sendTokenResponse = async (user, statusCode, res) => {
  const accessToken = signAccessToken(user._id, user.role);
  const { rawToken, hashedToken } = generateRefreshToken();

  const refreshExpiry = new Date(
    Date.now() +
      parseInt(process.env.JWT_REFRESH_EXPIRE_DAYS || 30, 10) *
        24 *
        60 *
        60 *
        1000
  );

  // Persist hashed refresh token in DB
  user.refreshTokens.push({ token: hashedToken, expiresAt: refreshExpiry });
  await user.save({ validateBeforeSave: false });

  // Refresh token in HttpOnly cookie — JS cannot read it (XSS-safe)
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: refreshExpiry,
  });

  // Strip sensitive fields before responding
  user.password = undefined;
  user.refreshTokens = undefined;

  res.status(statusCode).json({
    status: 'success',
    accessToken,
    data: { user },
  });
};

module.exports = {
  signAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  sendTokenResponse,
};
