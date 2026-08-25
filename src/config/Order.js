const {z}=require('zod');
const mongoose=require('mongoose');
const Order=require('../models/Order');
const Article=require('../models/Article');
const Customer=require('../models/Customer');
const {upsertCustomer}=require('./customer.controller');
const {makeOrderNumber,makeInvoiceNumber}=require('../utils/orderNumber');
const {normalizeDateKey,findNextAvailableSlot,findFirstAvailableSlot,estimatePreparationMinutes,scheduleCandidate}=require('../services/capacity.service');
const {localDateTimeToUtc}=require('../utils/time');
const {assertOrdersEnabled}=require('../services/store.service');

const itemSchema=z.object({
  name:z.string().min(1),base:z.string().optional(),extras:z.array(z.string()).optional(),
  articleId:z.string().optional(),department:z.enum(['sandwich','pasta','fries','general']).optional(),
  preparationMinutes:z.number().min(0).optional(),
  stockRequirements:z.array(z.object({articleId:z.string(),quantity:z.number().positive()})).optional(),
  quantity:z.number().int().min(1).max(50),unitPrice:z.number().min(0),totalPrice:z.number().min(0)
});
const preorderSchema=z.object({
  customer:z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(6).max(30)}),
  items:z.array(itemSchema).min(1),total:z.number().min(0),note:z.string().max(500).optional(),
  pickupDate:z.string().optional(),pickupTime:z.string().regex(/^\d{2}:\d{2}$/).optional()
});
const cashierSchema=z.object({
  customer:z.object({name:z.string().trim().min(1).max(100).default('Walk-in Customer'),phone:z.string().trim().max(30).optional().default('')}).optional(),
  items:z.array(itemSchema).min(1),total:z.number().min(0),note:z.string().max(500).optional(),
  pickupDate:z.string().optional(),pickupTime:z.string().regex(/^\d{2}:\d{2}$/).optional(),
  paymentMethod:z.enum(['cash','card','online','unknown']).default('cash')
});

function money(n){return Math.round(Number(n)*100)/100;}
async function enrichAndConsumeStock(items){
  const totals=new Map(), articleCache=new Map();
  for(const item of items){
    if(item.articleId){
      if(!mongoose.isValidObjectId(item.articleId))throw Object.assign(new Error('Invalid article id.'),{status:400});
      const a=await Article.findById(item.articleId).lean();if(!a||!a.active)throw Object.assign(new Error(`Article unavailable: ${item.name}`),{status:409,code:'ARTICLE_UNAVAILABLE'});
      articleCache.set(String(a._id),a);
    }
    for(const r of item.stockRequirements||[]){
      if(!mongoose.isValidObjectId(r.articleId))throw Object.assign(new Error('Invalid stock article id.'),{status:400});
      const a=articleCache.get(r.articleId)||await Article.findById(r.articleId).lean();
      if(!a||!a.active)throw Object.assign(new Error('One of the selected extras is unavailable.'),{status:409,code:'OUT_OF_STOCK'});
      articleCache.set(String(a._id),a);
      totals.set(String(a._id),(totals.get(String(a._id))||0)+Number(r.quantity)*item.quantity);
    }
  }
  const changed=[];
  try{
    for(const [id,qty] of totals){
      const a=await Article.findOneAndUpdate(
        {_id:id,active:true,$or:[{unlimitedStock:true},{stock:{$gte:qty}}]},
        {$inc:{stock:-qty}},{new:true}
      );
      if(!a)throw Object.assign(new Error('One or more selected articles just went out of stock.'),{status:409,code:'OUT_OF_STOCK'});
      changed.push({id,qty});
    }
  }catch(e){
    for(const c of changed)await Article.findByIdAndUpdate(c.id,{$inc:{stock:c.qty}});
    throw e;
  }
  const normalized=items.map(i=>{
    let cost=0;
    if(i.articleId)cost+=articleCache.get(String(i.articleId))?.cost||0;
    for(const r of i.stockRequirements||[])cost+=(articleCache.get(String(r.articleId))?.cost||0)*Number(r.quantity);
    return {...i,base:i.base||'',extras:i.extras||[],department:i.department||'general',preparationMinutes:Number(i.preparationMinutes||5),stockRequirements:i.stockRequirements||[],unitPrice:money(i.unitPrice),totalPrice:money(i.totalPrice),cost:money(cost)};
  });
  for(const c of changed)require('../server').emitStockChanged?.(c.id);
  return normalized;
}

async function createOrderInternal({data,source,createdBy,req}){
  await assertOrdersEnabled();
  const subtotal=money(data.items.reduce((s,i)=>s+Number(i.totalPrice),0)),total=money(data.total);
  if(Math.abs(subtotal-total)>0.01)throw Object.assign(new Error('Order total does not match item totals.'),{status:400});
  const requestedDate=normalizeDateKey(data.pickupDate||'today');
  const preliminaryItems=data.items.map(i=>({...i,department:i.department||'general',preparationMinutes:Number(i.preparationMinutes||5),quantity:i.quantity}));
  const prep=estimatePreparationMinutes(preliminaryItems);
  let slot=null;
  if(data.pickupTime){
    const candidateAt=localDateTimeToUtc(requestedDate,data.pickupTime);
    const test=await scheduleCandidate({dateKey:requestedDate,pickupAt:candidateAt,items:preliminaryItems,priority:candidateAt.getTime()});
    if(!test.feasible)throw Object.assign(new Error('This pickup time is unavailable because the production queue is full.'),{status:409,code:'PICKUP_SLOT_UNAVAILABLE',details:{requested:{date:requestedDate,time:data.pickupTime},preparationMinutes:prep}});
    slot={date:requestedDate,time:data.pickupTime,pickupAt:candidateAt,productionStartAt:test.productionStartAt};
  }else{
    slot=await findNextAvailableSlot(requestedDate,prep,preliminaryItems);
    if(!slot)throw Object.assign(new Error('No pickup time is available.'),{status:409,code:'NO_PICKUP_SLOT'});
    data.pickupTime=slot.time;
  }
  const customerData=data.customer||{name:'Walk-in Customer',phone:''};
  let customer=null;if(customerData.phone)customer=await upsertCustomer({name:customerData.name,phone:customerData.phone});
  const normalizedItems=await enrichAndConsumeStock(data.items);
  const pickupAt=slot.pickupAt;
  const schedule=await scheduleCandidate({dateKey:requestedDate,pickupAt,items:normalizedItems,priority:pickupAt.getTime()});
  const readyAt=new Date(pickupAt.getTime());
  const productionStartAt=schedule.productionStartAt||new Date(Math.max(Date.now(),pickupAt.getTime()-prep*60000));
  const order=await Order.create({
    orderNumber:makeOrderNumber(),invoiceNumber:makeInvoiceNumber(),customer:customer?._id,customerSnapshot:customerData,
    source,items:normalizedItems,subtotal,total,note:data.note,pickupAt,pickupDateLabel:data.pickupDate==='tomorrow'?'tomorrow':'today',
    preparationMinutes:prep,readyAt,productionStartAt,priority:pickupAt.getTime(),
    status:source==='cashier'?'accepted':'pending',paymentStatus:source==='cashier'?'paid':'unpaid',
    paymentMethod:source==='cashier'?data.paymentMethod:'unknown',createdBy,
    statusHistory:[{status:source==='cashier'?'accepted':'pending',by:createdBy}]
  });
  const populated=await Order.findById(order._id).populate('customer','name phone').lean();
  const io=req.app.get('io');io?.emit('order:new',populated);io?.emit(source==='cashier'?'cashier:order:new':'preorder:new',populated);io?.emit('production:queue',populated);
  return populated;
}
async function createOrder(req,res){try{const p=preorderSchema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid order.',errors:p.error.flatten()});res.status(201).json(await createOrderInternal({data:p.data,source:'preorder',createdBy:'customer',req}));}catch(e){res.status(e.status||500).json({message:e.message,code:e.code,details:e.details});}}
async function createCashierOrder(req,res){try{const p=cashierSchema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid cashier order.',errors:p.error.flatten()});res.status(201).json(await createOrderInternal({data:p.data,source:'cashier',createdBy:'cashier',req}));}catch(e){res.status(e.status||500).json({message:e.message,code:e.code,details:e.details});}}
async function listOrders(req,res){
  const {status,from,to,source,limit}=req.query,f={};
  if(status)f.status=status;if(source)f.source=source;if(from||to)f.pickupAt={};if(from)f.pickupAt.$gte=new Date(from);if(to)f.pickupAt.$lte=new Date(to);
  const rows=await Order.find(f).populate('customer','name phone').sort({pickupAt:1,priority:-1,createdAt:1}).limit(Math.min(500,Number(limit)||200)).lean();res.json(rows);
}
async function getCurrentCustomerOrders(req,res){const c=await Customer.findOne({phone:req.params.phone}).lean();if(!c)return res.json({current:[],history:[]});const orders=await Order.find({customer:c._id}).sort({createdAt:-1}).lean();const current=['pending','accepted','preparing','ready'];res.json({current:orders.filter(o=>current.includes(o.status)),history:orders});}
async function updateStatus(req,res){
  const allowed=['pending','accepted','preparing','ready','completed','cancelled','rejected'];if(!allowed.includes(req.body.status))return res.status(400).json({message:'Invalid status.'});
  const order=await Order.findById(req.params.id);if(!order)return res.status(404).json({message:'Order not found.'});
  order.status=req.body.status;order.statusHistory.push({status:req.body.status,by:'cashier',note:req.body.note||''});
  if(req.body.status==='completed'&&order.paymentStatus==='unpaid')order.paymentStatus='paid';
  await order.save();const p=await Order.findById(order._id).populate('customer','name phone').lean();req.app.get('io')?.emit('order:updated',p);req.app.get('io')?.emit('production:queue',p);res.json(p);
}
async function getInvoice(req,res){const o=await Order.findById(req.params.id).populate('customer','name phone').lean();if(!o)return res.status(404).json({message:'Order not found.'});const cost=o.items.reduce((s,i)=>s+(i.cost||0)*i.quantity,0);res.json({invoiceNumber:o.invoiceNumber,orderNumber:o.orderNumber,issuedAt:o.createdAt,customer:o.customer||o.customerSnapshot,pickupAt:o.pickupAt,readyAt:o.readyAt,productionStartAt:o.productionStartAt,items:o.items,subtotal:o.subtotal,total:o.total,cost:money(cost),grossProfit:money(o.total-cost),grossMargin:o.total?money((o.total-cost)/o.total*100):0,status:o.status,paymentStatus:o.paymentStatus,paymentMethod:o.paymentMethod});}
async function dashboard(req,res){
  const todayStart=new Date();todayStart.setHours(0,0,0,0);const tomorrow=new Date(todayStart);tomorrow.setDate(tomorrow.getDate()+1);
  const [orders,articles]=await Promise.all([Order.find({createdAt:{$gte:todayStart,$lt:tomorrow},status:{$nin:['cancelled','rejected']}}).lean(),Article.find().lean()]);
  const revenue=orders.reduce((s,o)=>s+o.total,0),cost=orders.reduce((s,o)=>s+o.items.reduce((x,i)=>x+(i.cost||0)*i.quantity,0),0);
  res.json({ordersCount:orders.length,revenue:money(revenue),cost:money(cost),grossProfit:money(revenue-cost),grossMargin:revenue?money((revenue-cost)/revenue*100):0,pending:orders.filter(o=>['pending','accepted'].includes(o.status)).length,preparing:orders.filter(o=>o.status==='preparing').length,ready:orders.filter(o=>o.status==='ready').length,lowStock:articles.filter(a=>a.active&&!a.unlimitedStock&&a.stock<=a.minimumStock).length});
}
module.exports={createOrder,createCashierOrder,listOrders,getCurrentCustomerOrders,updateStatus,getInvoice,dashboard};
