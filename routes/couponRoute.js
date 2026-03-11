const express = require('express');
const {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../services/couponService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// Admin / manager only
router.use(protect, restrictTo('admin', 'manager'));

router.route('/').get(getCoupons).post(createCoupon);
router.route('/:id').get(getCoupon).patch(updateCoupon).delete(deleteCoupon);

module.exports = router;
