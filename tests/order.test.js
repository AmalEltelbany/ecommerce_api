const request = require('supertest');
const app = require('../server');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');

let userToken;
let cartId;
let productId;

const testUser = {
  name: 'Order Tester',
  email: 'order@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
};

const shippingAddress = {
  details: '123 Main Street',
  phone: '01012345678',
  city: 'Cairo',
  postalCode: '12345',
};

beforeEach(async () => {
  // Register user
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send(testUser);
  userToken = registerRes.body.accessToken;
  const userId = registerRes.body.data.user._id;

  // Create category + product
  const category = await Category.create({ name: 'Test Cat', slug: 'test-cat' });
  const product = await Product.create({
    title: 'Order Test Product',
    slug: 'order-test-product',
    description: 'A product used for order testing in our test suite',
    quantity: 50,
    price: 200,
    imageCover: 'cover.jpeg',
    category: category._id,
  });
  productId = product._id;

  // Create cart directly in DB
  const cart = await Cart.create({
    user: userId,
    cartItems: [{ product: productId, price: 200, quantity: 2 }],
    totalCartPrice: 400,
  });
  cartId = cart._id.toString();
});

describe('Order Endpoints', () => {
  describe('POST /api/v1/orders/:cartId (Cash)', () => {
    it('should create a cash order and clear the cart', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${cartId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.paymentMethodType).toBe('cash');
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.totalOrderPrice).toBe(400);

      // Cart should be cleared after order
      const cart = await Cart.findById(cartId);
      expect(cart).toBeNull();
    });

    it('should decrement product stock after order', async () => {
      await request(app)
        .post(`/api/v1/orders/${cartId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      const product = await Product.findById(productId);
      expect(product.quantity).toBe(48); // 50 - 2
      expect(product.sold).toBe(2);
    });

    it('should return 404 for non-existent cart', async () => {
      const fakeId = new require('mongoose').Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/orders/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(404);
    });

    it('should return 403 when called with admin or manager role', async () => {
      // Managers cannot create orders (user role only)
      const managerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Manager',
          email: 'mgr@example.com',
          password: 'password123',
          passwordConfirm: 'password123',
        });
      // Manually set role to manager
      await User.findByIdAndUpdate(managerRes.body.data.user._id, { role: 'manager' });

      // Re-login to get a fresh token with updated role
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'mgr@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .post(`/api/v1/orders/${cartId}`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ shippingAddress });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/orders/my-orders', () => {
    it('should return orders for the authenticated user', async () => {
      // Create an order first
      await request(app)
        .post(`/api/v1/orders/${cartId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ shippingAddress });

      const res = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toBe(1);
      expect(res.body.data[0].totalOrderPrice).toBe(400);
    });
  });
});
