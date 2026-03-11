const express = require('express');
const {
  createSubCategory,
  getSubCategory,
  getSubCategories,
  updateSubCategory,
  deleteSubCategory,
  setCategoryIdToBody,
  createFilterObj,
} = require('../services/subCategoryService');
const {
  createSubCategoryValidator,
  getSubCategoryValidator,
  updateSubCategoryValidator,
  deleteSubCategoryValidator,
} = require('../utils/validators/subCategoryValidator');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// mergeParams: allows access to :categoryId from the parent category router
const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(createFilterObj, getSubCategories)
  .post(
    protect,
    restrictTo('admin', 'manager'),
    setCategoryIdToBody,
    createSubCategoryValidator,
    createSubCategory
  );

router
  .route('/:id')
  .get(getSubCategoryValidator, getSubCategory)
  .put(
    protect,
    restrictTo('admin', 'manager'),
    updateSubCategoryValidator,
    updateSubCategory
  )
  .delete(
    protect,
    restrictTo('admin'),
    deleteSubCategoryValidator,
    deleteSubCategory
  );

module.exports = router;
