const express = require('express');
const {
  getCategoryValidator,
  createCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator,
} = require('../utils/validators/categoryValidator');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../services/categoryService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { uploadSingleImage, resizeImage } = require('../middlewares/uploadMiddleware');
const { cacheMiddleware, invalidateCache } = require('../middlewares/cacheMiddleware');
const subcategoriesRoute = require('./subCategoryRoute');

const router = express.Router();

// Nested route: /categories/:categoryId/subcategories
router.use('/:categoryId/subcategories', subcategoriesRoute);

router
  .route('/')
  .get(cacheMiddleware('categories', 600), getCategories)
  .post(
    protect,
    restrictTo('admin', 'manager'),
    invalidateCache('categories'),
    uploadSingleImage('image'),
    resizeImage('categories', 600, 600),
    createCategoryValidator,
    createCategory
  );

router
  .route('/:id')
  .get(getCategoryValidator, getCategory)
  .put(
    protect,
    restrictTo('admin', 'manager'),
    uploadSingleImage('image'),
    resizeImage('categories', 600, 600),
    updateCategoryValidator,
    updateCategory
  )
  .delete(protect, restrictTo('admin'), deleteCategoryValidator, deleteCategory);

module.exports = router;
