const { timezone } = require('../config/env');
function zonedParts(date=new Date()){
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return {year:+parts.year,month:+parts.month,day:+parts.day,hour:+parts.hour,minute:+parts.minute,second:+parts.second};
}
function dateKeyFromZoned(date=new Date()){const p=zonedParts(date);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;}
function addDaysKey(k,n){const d=new Date(`${k}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function localDateTimeToUtc(dateKey,hhmm){
  const [h,m]=hhmm.split(':').map(Number);
  // Africa/Tunis is UTC+1 for the restaurant. Centralized for easy replacement if DST rules ever change.
  return new Date(`${dateKey}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`.replace('Z','+01:00'));
}
module.exports={zonedParts,dateKeyFromZoned,addDaysKey,localDateTimeToUtc};
