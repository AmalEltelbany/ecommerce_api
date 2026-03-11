const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, prettyPrint, colorize, simple } =
  format;

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProduction ? 'warn' : 'debug',
  format: isProduction
    ? // Production: structured JSON for log aggregators (Datadog, CloudWatch, etc.)
      combine(timestamp(), errors({ stack: true }), json())
    : // Development: human-readable colorized output
      combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        simple()
      ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
  // Don't crash on uncaught exceptions — log them instead
  exceptionHandlers: [new transports.File({ filename: 'logs/exceptions.log' })],
  rejectionHandlers: [new transports.File({ filename: 'logs/rejections.log' })],
});

module.exports = logger;
