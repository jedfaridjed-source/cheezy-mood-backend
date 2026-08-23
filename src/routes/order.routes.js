const router = require('express').Router();
const controller = require('../controllers/order.controller');
const cashierAuth = require('../middleware/cashierAuth');





router.post('/', controller.createOrder);
router.get('/', cashierAuth, controller.listOrders);
router.patch('/:id/status', cashierAuth, controller.updateStatus);
router.get('/:id/invoice', cashierAuth, controller.getInvoice);

module.exports = router;
