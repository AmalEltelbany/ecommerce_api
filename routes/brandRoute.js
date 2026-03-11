const express = require('express');
const {
  getBrandValidator,
  createBrandValidator,
  updateBrandValidator,
  deleteBrandValidator,
} = require('../utils/validators/brandValidator');
const {
  getBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
} = require('../services/brandService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { uploadSingleImage, resizeImage } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router
  .route('/')
  .get(getBrands)
  .post(
    protect,
    restrictTo('admin', 'manager'),
    uploadSingleImage('image'),
    resizeImage('brands', 600, 600),
    createBrandValidator,
    createBrand
  );

router
  .route('/:id')
  .get(getBrandValidator, getBrand)
  .put(
    protect,
    restrictTo('admin', 'manager'),
    uploadSingleImage('image'),
    resizeImage('brands', 600, 600),
    updateBrandValidator,
    updateBrand
  )
  .delete(protect, restrictTo('admin'), deleteBrandValidator, deleteBrand);

module.exports = router;
