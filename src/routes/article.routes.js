const router=require('express').Router();const c=require('../controllers/article.controller');const auth=require('../middleware/cashierAuth');
router.get('/',c.list);router.get('/availability',c.availability);router.post('/',auth,c.create);router.patch('/:id',auth,c.update);router.patch('/:id/stock',auth,c.adjustStock);module.exports=router;
