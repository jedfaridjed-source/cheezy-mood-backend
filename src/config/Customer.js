const {getAvailability,findFirstAvailableSlot,normalizeDateKey}=require('../services/capacity.service');
async function availability(req,res){try{res.json(await getAvailability(req.query.date||'today'));}catch(e){res.status(400).json({message:e.message});}}
async function nextAvailable(req,res){try{const slot=await findFirstAvailableSlot(Number(req.query.preparationMinutes||30));res.json(slot||null);}catch(e){res.status(400).json({message:e.message});}}
module.exports={availability,nextAvailable};
