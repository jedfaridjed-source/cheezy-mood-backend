const { cashierApiKey } = require('../config/env');
function cashierAuth(req, res, next) {
  if (!cashierApiKey) return res.status(503).json({ message: 'Cashier API key is not configured.' });
  const key = req.get('x-cashier-api-key');
  if (!key || key !== cashierApiKey) return res.status(401).json({ message: 'Unauthorized cashier request.' });
  next();
}
module.exports = cashierAuth;
