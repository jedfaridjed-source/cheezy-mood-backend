const router=require('express').Router();const c=require('../controllers/order.controller');const auth=require('../middleware/cashierAuth');
router.post('/',c.createOrder);
router.post('/cashier',auth,c.createCashierOrder);
router.get('/',auth,c.listOrders);
router.get('/dashboard',auth,c.dashboard);
router.patch('/:id/status',auth,c.updateStatus);
router.get('/:id/invoice',auth,c.getInvoice);
module.exports=router;
