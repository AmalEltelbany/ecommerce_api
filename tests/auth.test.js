const request = require('supertest');
const app = require('../server');

const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
};

describe('Auth Endpoints', () => {
  // ─── Register ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return access token + refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.data.user).toHaveProperty('email', testUser.email);
      expect(res.body.data.user).not.toHaveProperty('password');
      // Refresh token must be in a cookie, not in body
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken/);
    });

    it('should return 400 when password and passwordConfirm do not match', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, passwordConfirm: 'wrong' });

      expect(res.status).toBe(400);
    });

    it('should return 400 on duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const res = await request(app).post('/api/v1/auth/register').send(testUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Duplicate/i);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'noname@example.com' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Login ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nobody@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── Refresh Token ──────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should issue a new access token given a valid refresh token cookie', async () => {
      // Register to get refresh token cookie
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      const cookie = registerRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 401 when no refresh token cookie is provided', async () => {
      const res = await request(app).post('/api/v1/auth/refresh-token');
      expect(res.status).toBe(401);
    });
  });

  // ─── Protected Routes ────────────────────────────────────────────────────────

  describe('Auth Middleware (protect)', () => {
    it('should return 401 when no Bearer token is provided', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 for an invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('should return 200 for a valid token', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      const { accessToken } = registerRes.body;

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ─── RBAC ────────────────────────────────────────────────────────────────────

  describe('Role-based access control (restrictTo)', () => {
    it('should return 403 when a user tries to access admin-only route', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      const { accessToken } = registerRes.body;

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
