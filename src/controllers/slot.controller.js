const { getAvailability, findFirstAvailableSlot } = require('../services/capacity.service');

async function availability(req, res) {
  const slots = await getAvailability(req.query.date || 'today');
  res.json({ date: req.query.date || 'today', slots });
}

async function nextAvailable(req, res) {
  const requiredMinutes = Number(req.query.preparationMinutes || 30);
  const slot = await findFirstAvailableSlot(requiredMinutes);
  res.json({ slot });
}

module.exports = { availability, nextAvailable };
