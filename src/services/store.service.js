const StoreSettings = require('../models/StoreSettings');
const { openingTime: envOpening, closingTime: envClosing, closingSoonMinutes: envSoon } = require('../config/env');
const { zonedParts } = require('../utils/time');
async function getStoreSettings(){
  let s=await StoreSettings.findOne({key:'main'});
  if(!s) s=await StoreSettings.create({key:'main',openingTime:envOpening,closingTime:envClosing,closingSoonMinutes:envSoon});
  return s;
}
function mins(v){const [h,m]=v.split(':').map(Number);return h*60+m;}
async function getStoreStatus(){
  const s=await getStoreSettings(), p=zonedParts(), now=p.hour*60+p.minute, open=mins(s.openingTime), close=mins(s.closingTime);
  const within=now>=open&&now<close;
  const minutesToClose=within?close-now:Math.max(0,close-now);
  const enabled=Boolean(s.ordersEnabled&&s.isOpen&&within);
  const reason=enabled&&(minutesToClose<=s.closingSoonMinutes)?'CLOSING_SOON':(enabled?'OPEN':'CLOSED');
  return {isOpen:Boolean(s.isOpen&&within),ordersEnabled:enabled,reason,openingTime:s.openingTime,closingTime:s.closingTime,minutesToClose,closingSoonMinutes:s.closingSoonMinutes,
    message:reason==='CLOSING_SOON'?s.closingSoonMessage:(reason==='CLOSED'?s.closedMessage:null)};
}
async function assertOrdersEnabled(){
  const status=await getStoreStatus();
  if(!status.ordersEnabled){const e=new Error(status.message);e.status=409;e.code=status.reason==='CLOSING_SOON'?'ORDERS_CLOSING_SOON':'ORDERS_CLOSED';e.details=status;throw e;}
  return status;
}
async function updateStore(patch,by='cashier'){return StoreSettings.findOneAndUpdate({key:'main'},{$set:{...patch,updatedBy:by}},{new:true,upsert:true,setDefaultsOnInsert:true});}
module.exports={getStoreSettings,getStoreStatus,assertOrdersEnabled,updateStore};
