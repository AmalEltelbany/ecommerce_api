const express = require('express');
const {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
} = require('../services/wishlistService');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getMyWishlist).post(addToWishlist);
router.delete('/:productId', removeFromWishlist);

module.exports = router;
