const mongoose = require('mongoose');

// Set env vars before app loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test-secret-key-min-32-characters-long';
process.env.JWT_EXPIRE_TIME = '15m';
process.env.JWT_REFRESH_EXPIRE_DAYS = '30';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';

// Mock Redis client so tests don't require a real Redis instance
jest.mock('../config/redisClient', () => ({
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
}));

// Mock nodemailer so tests don't send real emails
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue(undefined));

let mongoServer;

beforeAll(async () => {
  // Use an in-process MongoDB instance — no real DB needed
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean all collections between tests for isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
