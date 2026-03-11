module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000,
  collectCoverageFrom: [
    'services/**/*.js',
    'middlewares/**/*.js',
    '!middlewares/uploadMiddleware.js', // requires actual files/buffers
  ],
  coverageThreshold: {
    global: { lines: 60 },
  },
  // Suppress console noise during tests
  silent: false,
  verbose: true,
};
