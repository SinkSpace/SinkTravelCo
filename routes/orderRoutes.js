// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/order/:id', orderController.showOrder);

module.exports = router;
