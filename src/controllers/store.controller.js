const {z}=require('zod');const {getStoreSettings,getStoreStatus,updateStore}=require('../services/store.service');
async function status(req,res){res.json(await getStoreStatus());}
async function settings(req,res){res.json(await getStoreSettings());}
async function update(req,res){
  const p=z.object({isOpen:z.boolean().optional(),ordersEnabled:z.boolean().optional(),openingTime:z.string().regex(/^\d{2}:\d{2}$/).optional(),closingTime:z.string().regex(/^\d{2}:\d{2}$/).optional(),closingSoonMinutes:z.number().int().min(0).max(240).optional(),closingSoonMessage:z.string().min(1).max(200).optional(),closedMessage:z.string().min(1).max(200).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({message:'Invalid store settings.',errors:p.error.flatten()});
  const s=await updateStore(p.data,'cashier'),state=await getStoreStatus();req.app.get('io')?.emit('store:status',state);res.json({settings:s,status:state});
}
async function open(req,res){return update({...req,body:{...(req.body||{}),isOpen:true,ordersEnabled:true}},res);}
async function close(req,res){return update({...req,body:{...(req.body||{}),isOpen:false,ordersEnabled:false}},res);}
module.exports={status,settings,update,open,close};
