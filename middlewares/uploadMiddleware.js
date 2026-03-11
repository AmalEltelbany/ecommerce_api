const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const asyncHandler = require('express-async-handlr');
const ApiError = require('../utils/apiError');

// ─── Cloudinary Config ────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer Setup ─────────────────────────────────────────────────────────────

// Memory storage: file is a Buffer in req.file.buffer.
// Sharp processes the Buffer → avoids temp file on disk.
const multerStorage = multer.memoryStorage();

// Only allow images — reject everything else with an operational error
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new ApiError('Not an image. Please upload image files only.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// ─── Upload Helpers ───────────────────────────────────────────────────────────

exports.uploadSingleImage = (fieldName) => upload.single(fieldName);
exports.uploadMixOfImages = (arrayOfFields) => upload.fields(arrayOfFields);

// ─── Image Processing ─────────────────────────────────────────────────────────

/**
 * Upload a buffer to Cloudinary (production) or write to disk (development).
 * Returns the public URL / filename string.
 */
const saveProcessedImage = async (buffer, folder, filename) => {
  if (process.env.NODE_ENV === 'production') {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: filename.replace('.jpeg', '') },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });
    return result.secure_url;
  }

  // Development: write to local uploads directory
  const filePath = path.join('uploads', folder, filename);
  await fs.writeFile(filePath, buffer);
  return filename;
};

/**
 * resizeImage — single image middleware factory.
 * Usage: resizeImage('categories', 600, 600)
 * Sets req.body.image to the saved filename / URL.
 */
exports.resizeImage = (folder, width = 600, height = 600) =>
  asyncHandler(async (req, res, next) => {
    if (!req.file) return next();

    const filename = `${folder}-${uuidv4()}-${Date.now()}.jpeg`;

    const buffer = await sharp(req.file.buffer)
      .resize(width, height, { fit: 'cover' })
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toBuffer();

    req.body.image = await saveProcessedImage(buffer, folder, filename);
    next();
  });

/**
 * resizeMixOfImages — handles products with imageCover + images[].
 * Sets req.body.imageCover and req.body.images.
 */
exports.resizeMixOfImages = asyncHandler(async (req, res, next) => {
  if (!req.files) return next();

  // 1. Process cover image
  if (req.files.imageCover) {
    const filename = `product-cover-${uuidv4()}-${Date.now()}.jpeg`;
    const buffer = await sharp(req.files.imageCover[0].buffer)
      .resize(2000, 1333, { fit: 'cover' })
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toBuffer();
    req.body.imageCover = await saveProcessedImage(buffer, 'products', filename);
  }

  // 2. Process gallery images in parallel
  if (req.files.images) {
    req.body.images = await Promise.all(
      req.files.images.map(async (file, index) => {
        const filename = `product-${uuidv4()}-${Date.now()}-${index}.jpeg`;
        const buffer = await sharp(file.buffer)
          .resize(800, 800, { fit: 'cover' })
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer();
        return saveProcessedImage(buffer, 'products', filename);
      })
    );
  }

  next();
});
