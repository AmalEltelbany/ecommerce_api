const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  uploadUserPhoto,
  resizeUserPhoto,
  getMe,
  updateMe,
  changeMyPassword,
  deactivateMe,
} = require('../services/userService');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── User Self-Service ────────────────────────────────────────────────────────
router.get('/me', getMe, getUser);
router.patch('/update-me', uploadUserPhoto, resizeUserPhoto, updateMe);
router.patch('/change-my-password', changeMyPassword);
router.delete('/deactivate-me', deactivateMe);

// ─── Admin Only ───────────────────────────────────────────────────────────────
router.use(restrictTo('admin'));

router.route('/').get(getUsers).post(uploadUserPhoto, resizeUserPhoto, createUser);
router.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

module.exports = router;
