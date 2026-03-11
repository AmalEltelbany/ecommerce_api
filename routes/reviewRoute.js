const express = require('express');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  setProductUserIds,
  createFilterObj,
  validateProductExists,
} = require('../services/reviewService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// mergeParams: true allows access to :productId from parent router
// (when mounted as /products/:productId/reviews)
const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(createFilterObj, getReviews)
  .post(protect, restrictTo('user'), setProductUserIds, validateProductExists, createReview);

router
  .route('/:id')
  .get(getReview)
  .patch(protect, restrictTo('user', 'admin'), updateReview)
  .delete(protect, restrictTo('user', 'admin'), deleteReview);

module.exports = router;
