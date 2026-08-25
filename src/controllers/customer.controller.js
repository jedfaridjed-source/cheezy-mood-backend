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

async function getCustomerProfile(req, res) {
  const customer = await Customer.findOne({ phone: req.params.phone }).lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  const orders = await Order.find({ customer: customer._id }).sort({ createdAt: -1 }).lean();
  res.json({ customer, orders });
}

async function updateCustomerProfile(req, res) {
  const name = String(req.body.name || '').trim();
  const profilePicture = req.body.profilePicture == null ? undefined : String(req.body.profilePicture);
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  if (profilePicture && profilePicture.length > 280000) return res.status(400).json({ message: 'Profile picture is too large.' });
  const update = { name };
  if (profilePicture !== undefined) update.profilePicture = profilePicture;
  const customer = await Customer.findOneAndUpdate({ phone: req.params.phone }, { $set: update }, { new: true }).lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  res.json(customer);
}

async function getCustomerInvoice(req, res) {
  const customer = await Customer.findOne({ phone: req.params.phone }).lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });
  const order = await Order.findOne({ _id: req.params.orderId, customer: customer._id }).lean();
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json({
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    issuedAt: order.createdAt,
    customer: order.customerSnapshot || customer,
    pickupAt: order.pickupAt,
    readyAt: order.readyAt,
    productionStartAt: order.productionStartAt,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod
  });
}

module.exports = { upsertCustomer, getCustomerHistory, getCustomerProfile, updateCustomerProfile, getCustomerInvoice };
