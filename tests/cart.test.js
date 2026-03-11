const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

let accessToken;
let productId;

const testUser = {
  name: 'Cart Tester',
  email: 'cart@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
};

beforeEach(async () => {
  // Register and get token
  const res = await request(app).post('/api/v1/auth/register').send(testUser);
  accessToken = res.body.accessToken;

  // Create a category and product directly in DB for speed
  const category = await Category.create({ name: 'Electronics', slug: 'electronics' });
  const product = await Product.create({
    title: 'Test Product',
    slug: 'test-product',
    description: 'A test product description for testing purposes here',
    quantity: 100,
    price: 99.99,
    imageCover: 'test-cover.jpeg',
    category: category._id,
  });
  productId = product._id.toString();
});

describe('Cart Endpoints', () => {
  describe('POST /api/v1/cart', () => {
    it('should add a product to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, color: 'red' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.numOfCartItems).toBe(1);
      expect(res.body.data.cartItems[0].price).toBe(99.99);
      expect(res.body.data.totalCartPrice).toBe(99.99);
    });

    it('should increment quantity when same product+color added again', async () => {
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, color: 'red' });

      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, color: 'red' });

      expect(res.status).toBe(200);
      expect(res.body.numOfCartItems).toBe(1); // still 1 item
      expect(res.body.data.cartItems[0].quantity).toBe(2); // quantity incremented
      expect(res.body.data.totalCartPrice).toBe(199.98);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .send({ productId, color: 'red' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/cart', () => {
    it('should return the user cart', async () => {
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cartItems).toHaveLength(1);
    });

    it('should return 404 when user has no cart', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/cart', () => {
    it('should clear the entire cart', async () => {
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      const res = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(204);
    });
  });
});
