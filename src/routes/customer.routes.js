const router = require('express').Router();
const { getCustomerHistory } = require('../controllers/customer.controller');
const { getCurrentCustomerOrders } = require('../controllers/order.controller');

router.get('/:phone/orders', getCurrentCustomerOrders);
router.get('/:phone/history', getCustomerHistory);

module.exports = router;
