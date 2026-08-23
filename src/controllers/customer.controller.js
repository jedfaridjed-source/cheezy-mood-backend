const Customer = require('../models/Customer');
const Order = require('../models/Order');

async function upsertCustomer({ name, phone }) {
  return Customer.findOneAndUpdate(
    { phone },
    { $set: { name, phone } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function getCustomerHistory(req, res) {
  const customer = await Customer.findOne({ phone: req.params.phone }).lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  const orders = await Order.find({ customer: customer._id }).sort({ createdAt: -1 }).lean();
  res.json({ customer, orders });
}

module.exports = { upsertCustomer, getCustomerHistory };
