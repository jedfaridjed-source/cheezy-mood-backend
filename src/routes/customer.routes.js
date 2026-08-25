const router = require('express').Router();
const controller = require('../controllers/customer.controller');

router.get('/:phone/profile', controller.getCustomerProfile);
router.patch('/:phone/profile', controller.updateCustomerProfile);
router.get('/:phone/orders/:orderId/invoice', controller.getCustomerInvoice);
router.get('/:phone/orders', require('../controllers/order.controller').getCurrentCustomerOrders);
router.get('/:phone/history', controller.getCustomerHistory);

module.exports = router;
