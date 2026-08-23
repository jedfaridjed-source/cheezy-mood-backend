function stamp() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function randomPart() {
  return Math.floor(1000 + Math.random() * 9000);
}

function makeOrderNumber() {
  return `CM-${stamp()}-${randomPart()}`;
}

function makeInvoiceNumber() {
  return `INV-${stamp()}-${randomPart()}`;
}

module.exports = { makeOrderNumber, makeInvoiceNumber };
