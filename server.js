const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config({ path: 'config.env' });

const logger = require('./utils/logger');
const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');
const dbConnection = require('./config/database');

// Routes
const categoryRoute = require('./routes/categoryRoute');
const subCategoryRoute = require('./routes/subCategoryRoute');
const brandRoute = require('./routes/brandRoute');
const productRoute = require('./routes/productRoute');
const authRoute = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const reviewRoute = require('./routes/reviewRoute');
const wishlistRoute = require('./routes/wishlistRoute');
const addressRoute = require('./routes/addressRoute');
const couponRoute = require('./routes/couponRoute');
const cartRoute = require('./routes/cartRoute');
const orderRoute = require('./routes/orderRoute');

// Connect to DB
dbConnection();

const app = express();

// ─── Security Middleware Stack (order matters) ────────────────────────────────

// Set security HTTP headers
app.use(helmet());

// CORS — allow configured origins, required for HttpOnly cookie exchange
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',
    credentials: true,
  })
);
app.options('*', cors());

// Cookie parser — needed for refresh token HttpOnly cookie
app.use(cookieParser());

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
// MUST be mounted BEFORE express.json() because Stripe requires raw body for
// signature verification. express.json() would parse the buffer and break it.
const { webhookCheckout } = require('./services/orderService');
app.post(
  '/api/v1/orders/webhook-checkout',
  express.raw({ type: 'application/json' }),
  webhookCheckout
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
// Morgan HTTP logs are piped through Winston so all logs go to the same sink
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
    skip: (req) => req.url === '/health', // skip health check noise in logs
  })
);
if (process.env.NODE_ENV === 'development') {
  logger.info(`mode: ${process.env.NODE_ENV}`);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Global limiter: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Stricter limiter for auth endpoints: 10 attempts per hour
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
// Brute-force protection: /verify-reset-code is the attack surface for
// guessing 6-digit reset codes; must be rate-limited as strictly as /login
app.use('/api/v1/auth/verify-reset-code', authLimiter);

// ─── Data Sanitization ────────────────────────────────────────────────────────

// Against NoSQL injection: { "$gt": "" } → stripped from body/params/query
app.use(mongoSanitize());

// Against XSS: <script>alert(1)</script> → escaped
app.use(xss());

// Against HTTP parameter pollution: ?sort=price&sort=name → uses last value
// Whitelist fields that legitimately accept multiple values
app.use(
  hpp({
    whitelist: [
      'price',
      'sold',
      'quantity',
      'ratingsAverage',
      'ratingsQuantity',
    ],
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Mount Routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/users', userRoute);
app.use('/api/v1/categories', categoryRoute);
app.use('/api/v1/subcategories', subCategoryRoute);
app.use('/api/v1/brands', brandRoute);
app.use('/api/v1/products', productRoute);
app.use('/api/v1/reviews', reviewRoute);
app.use('/api/v1/wishlist', wishlistRoute);
app.use('/api/v1/addresses', addressRoute);
app.use('/api/v1/coupons', couponRoute);
app.use('/api/v1/cart', cartRoute);
app.use('/api/v1/orders', orderRoute);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.all('*', (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalError);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  logger.info(`App running on port ${PORT}`);
});

// Handle unhandled promise rejections outside Express
process.on('unhandledRejection', (err) => {
  logger.error(`UnhandledRejection: ${err.name} | ${err.message}`);
  server.close(() => {
    logger.error('Shutting down...');
    process.exit(1);
  });
});

module.exports = app; // exported for testing with supertest
