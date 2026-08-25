const router=require('express').Router();const c=require('../controllers/store.controller');const auth=require('../middleware/cashierAuth');
router.get('/status',c.status);router.get('/settings',auth,c.settings);router.patch('/settings',auth,c.update);router.post('/open',auth,c.open);router.post('/close',auth,c.close);module.exports=router;
