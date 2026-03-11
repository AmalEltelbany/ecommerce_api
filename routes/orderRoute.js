const express = require('express');
const {
  createCashOrder,
  checkoutSession,
  getAllOrders,
  getOrder,
  getMyOrders,
  updateOrderToPaid,
  updateOrderToDelivered,
  getOrderStats,
  getTopProducts,
} = require('../services/orderService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

// User routes
router.post('/:cartId', restrictTo('user'), createCashOrder);
router.get('/checkout-session/:cartId', restrictTo('user'), checkoutSession);
router.get('/my-orders', restrictTo('user'), getMyOrders);

// Admin / manager routes
router.get('/', restrictTo('admin', 'manager'), getAllOrders);
router.get('/stats', restrictTo('admin'), getOrderStats);
router.get('/top-products', restrictTo('admin'), getTopProducts);
router.get('/:id', restrictTo('admin', 'manager'), getOrder);
router.patch('/:id/pay', restrictTo('admin', 'manager'), updateOrderToPaid);
router.patch('/:id/deliver', restrictTo('admin', 'manager'), updateOrderToDelivered);

module.exports = router;
