const Order=require('../models/Order');
const StoreSettings=require('../models/StoreSettings');
const {minPreparationMinutes,slotMinutes}=require('../config/env');
const {dateKeyFromZoned,addDaysKey,localDateTimeToUtc,zonedParts}=require('../utils/time');

function normalizeDateKey(v){if(v==='today'||!v)return dateKeyFromZoned();if(v==='tomorrow')return addDaysKey(dateKeyFromZoned(),1);if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;throw new Error('Invalid date. Use today, tomorrow, or YYYY-MM-DD.');}
function hhmmMinutes(v){const [h,m]=v.split(':').map(Number);return h*60+m;}
function minutesToHhmm(v){v=((v%1440)+1440)%1440;return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;}
function itemDepartmentMinutes(items){
  const d={sandwich:0,pasta:0,fries:0,general:0};
  for(const i of items||[]){const dep=i.department||'general';d[dep]=(d[dep]||0)+Math.max(0,Number(i.preparationMinutes||5))*Math.max(1,Number(i.quantity||1));}
  return d;
}
function estimatePreparationMinutes(items){const d=itemDepartmentMinutes(items);return Math.max(minPreparationMinutes,Math.max(...Object.values(d),0));}
async function getStore(){return StoreSettings.findOne({key:'main'}).lean();}
async function getActiveOrders(dateKey){
  const start=localDateTimeToUtc(dateKey,'00:00'), end=localDateTimeToUtc(dateKey,'23:59');
  return Order.find({pickupAt:{$gte:start,$lte:end},status:{$nin:['cancelled','rejected','completed']}}).sort({pickupAt:1,priority:-1,createdAt:1}).lean();
}
function scheduleDepartmentOrders(orders,department,nowMs){
  const relevant=orders.filter(o=>(o.items||[]).some(i=>(i.department||'general')===department));
  const rows=relevant.map(o=>({o,duration:itemDepartmentMinutes(o.items)[department],pickup:new Date(o.pickupAt).getTime()}))
    .filter(x=>x.duration>0).sort((a,b)=>a.pickup-b.pickup || (b.o.priority||0)-(a.o.priority||0) || new Date(a.o.createdAt)-new Date(b.o.createdAt));
  let next=Infinity; const result=new Map(); let feasible=true;
  for(let i=rows.length-1;i>=0;i--){
    const r=rows[i];
    const latestStart=Math.min(r.pickup,next)-r.duration*60000;
    result.set(String(r.o._id),{startAt:new Date(latestStart),duration:r.duration,pickupAt:new Date(r.pickup)});
    if(latestStart<nowMs) feasible=false;
    next=latestStart;
  }
  return {result,feasible};
}
async function scheduleCandidate(candidate){
  const orders=await getActiveOrders(candidate.dateKey);
  const candidateObj={_id:'candidate',pickupAt:candidate.pickupAt,createdAt:new Date(),priority:candidate.priority||candidate.pickupAt.getTime(),items:candidate.items,status:'pending'};
  orders.push(candidateObj);
  const now=Date.now();
  const all={};let feasible=true;let latestStart=0;
  for(const dep of ['sandwich','pasta','fries','general']){
    const s=scheduleDepartmentOrders(orders,dep,now);all[dep]=s.result;feasible=feasible&&s.feasible;
    const row=s.result.get('candidate');if(row)latestStart=Math.max(latestStart,row.startAt.getTime());
  }
  return {feasible,productionStartAt:latestStart?new Date(latestStart):candidate.pickupAt,readyAt:candidate.pickupAt,schedule:all};
}
async function findNextAvailableSlot(dateInput,requiredMinutes,items=[]){
  const dateKey=normalizeDateKey(dateInput), s=await getStore();
  const open=hhmmMinutes(s?.openingTime||'12:00'), close=hhmmMinutes(s?.closingTime||'21:00');
  const nowParts=zonedParts(), today=dateKeyFromZoned(); const nowMinutes=nowParts.hour*60+nowParts.minute;
  const minimumMinutes=dateKey===today?Math.max(open,nowMinutes+minPreparationMinutes):open;
  const prepItems=items.length?items:[{department:'general',preparationMinutes:requiredMinutes,quantity:1}];
  for(let t=Math.ceil(minimumMinutes/slotMinutes)*slotMinutes;t<=close;t+=slotMinutes){
    const pickupAt=localDateTimeToUtc(dateKey,minutesToHhmm(t));
    if(pickupAt.getTime()<=Date.now())continue;
    const test=await scheduleCandidate({dateKey,pickupAt,items:prepItems,priority:pickupAt.getTime()});
    if(test.feasible)return {date:dateKey,time:minutesToHhmm(t),pickupAt,productionStartAt:test.productionStartAt,readyAt:test.readyAt,preparationMinutes:estimatePreparationMinutes(prepItems)};
  }
  return null;
}
async function getAvailability(dateInput){
  const dateKey=normalizeDateKey(dateInput),s=await getStore(),out=[];
  const open=hhmmMinutes(s?.openingTime||'12:00'),close=hhmmMinutes(s?.closingTime||'21:00');
  const nowParts=zonedParts(), today=dateKeyFromZoned(), min= dateKey===today ? Math.max(open,nowParts.hour*60+nowParts.minute+minPreparationMinutes) : open;
  for(let t=Math.ceil(min/slotMinutes)*slotMinutes;t<=close;t+=slotMinutes){
    const time=minutesToHhmm(t), pickupAt=localDateTimeToUtc(dateKey,time);
    out.push({date:dateKey,time,pickupAt,available:true,remainingPreparationMinutes:60});
  }
  // Availability for a generic 5-minute job; order creation performs exact feasibility.
  const active=await getActiveOrders(dateKey);
  for(const slot of out){
    const departments={sandwich:0,pasta:0,fries:0,general:0};
    active.filter(o=>Math.abs(new Date(o.pickupAt)-slot.pickupAt)<slotMinutes*60000).forEach(o=>{const d=itemDepartmentMinutes(o.items);for(const k of Object.keys(departments))departments[k]+=d[k];});
    slot.departmentUsage=departments;slot.usedPreparationMinutes=Object.values(departments).reduce((a,b)=>a+b,0);
    slot.remainingPreparationMinutes=Math.max(0,60-slot.usedPreparationMinutes);
  }
  return out;
}
async function findFirstAvailableSlot(requiredMinutes,items=[]){
  const today=dateKeyFromZoned(),tomorrow=addDaysKey(today,1);
  return await findNextAvailableSlot(today,requiredMinutes,items)||await findNextAvailableSlot(tomorrow,requiredMinutes,items);
}
module.exports={normalizeDateKey,getAvailability,findNextAvailableSlot,findFirstAvailableSlot,estimatePreparationMinutes,itemDepartmentMinutes,scheduleCandidate};
