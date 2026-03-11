const express = require('express');
const {
  getProductValidator,
  createProductValidator,
  updateProductValidator,
  deleteProductValidator,
} = require('../utils/validators/productValidator');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/productService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { uploadMixOfImages, resizeMixOfImages } = require('../middlewares/uploadMiddleware');
const { cacheMiddleware, invalidateCache } = require('../middlewares/cacheMiddleware');

// Nested review route: /products/:productId/reviews
const reviewRoute = require('./reviewRoute');

const router = express.Router();

router.use('/:productId/reviews', reviewRoute);

router
  .route('/')
  .get(cacheMiddleware('products', 300), getProducts)
  .post(
    protect,
    restrictTo('admin', 'manager'),
    invalidateCache('products'),
    uploadMixOfImages([
      { name: 'imageCover', maxCount: 1 },
      { name: 'images', maxCount: 5 },
    ]),
    resizeMixOfImages,
    createProductValidator,
    createProduct
  );

router
  .route('/:id')
  .get(getProductValidator, getProduct)
  .put(
    protect,
    restrictTo('admin', 'manager'),
    uploadMixOfImages([
      { name: 'imageCover', maxCount: 1 },
      { name: 'images', maxCount: 5 },
    ]),
    resizeMixOfImages,
    updateProductValidator,
    updateProduct
  )
  .delete(protect, restrictTo('admin'), deleteProductValidator, deleteProduct);

module.exports = router;
