const express = require('express');
const {
  addProductToCart,
  getLoggedUserCart,
  removeSpecificCartItem,
  clearCart,
  updateCartItemQuantity,
  applyCoupon,
} = require('../services/cartService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// All cart operations require authentication — cart is user-specific
router.use(protect, restrictTo('user'));

router.route('/').get(getLoggedUserCart).post(addProductToCart).delete(clearCart);
router.put('/apply-coupon', applyCoupon);
router
  .route('/:itemId')
  .patch(updateCartItemQuantity)
  .delete(removeSpecificCartItem);

module.exports = router;
