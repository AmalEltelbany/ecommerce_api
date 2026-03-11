const express = require('express');
const {
  addAddress,
  removeAddress,
  getMyAddresses,
} = require('../services/addressService');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getMyAddresses).post(addAddress);
router.delete('/:addressId', removeAddress);

module.exports = router;
