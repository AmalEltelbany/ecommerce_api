const express = require('express');
// eslint-disable-next-line import/no-extraneous-dependencies
const multer = require('multer');

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

const upload = multer({ dest: 'uploads/categories' });
const subcategoriesRoute = require('./subCategoryRoute');

const router = express.Router();

router.use('/:categoryId/subcategories', subcategoriesRoute);

router
  .route('/')
  .get(getCategories)
  .post(upload.single('image') ,(req,res,next)=>{
    console.log(req.file);
    next();
  },createCategoryValidator, createCategory);
router
  .route('/:id')
  .get(getCategoryValidator, getCategory)
  .put(updateCategoryValidator, updateCategory)
  .delete(deleteCategoryValidator, deleteCategory);

module.exports = router;
