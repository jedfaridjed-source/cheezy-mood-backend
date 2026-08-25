const router=require('express').Router();const {availability,nextAvailable}=require('../controllers/slot.controller');
router.get('/',availability);router.get('/next',nextAvailable);module.exports=router;
