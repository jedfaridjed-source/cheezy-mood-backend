function stamp() { const d=new Date(); return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`; }
function randomPart(){return Math.floor(1000+Math.random()*9000);}
function makeOrderNumber(){return `CM-${stamp()}-${randomPart()}`;}
function makeInvoiceNumber(){return `INV-${stamp()}-${randomPart()}`;}
module.exports={makeOrderNumber,makeInvoiceNumber};
