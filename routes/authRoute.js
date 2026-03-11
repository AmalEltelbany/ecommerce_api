const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} = require('../services/authService');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyResetCodeValidator,
  resetPasswordValidator,
} = require('../utils/validators/authValidator');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);
router.post('/verify-reset-code', verifyResetCodeValidator, verifyResetCode);
router.put('/reset-password', resetPasswordValidator, resetPassword);

module.exports = router;
