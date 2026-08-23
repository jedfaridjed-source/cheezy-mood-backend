const { z } = require('zod');
const Order = require('../models/Order');
const { upsertCustomer } = require('./customer.controller');
const { makeOrderNumber, makeInvoiceNumber } = require('../utils/orderNumber');
const { normalizeDateKey, findNextAvailableSlot, estimatePreparationMinutes, getAvailability } = require('../services/capacity.service');
const { localDateTimeToUtc } = require('../utils/time');

const createSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().min(6).max(30) }),
  items: z.array(z.object({
    name: z.string().min(1), base: z.string().min(1), extras: z.array(z.string()).optional(),
    quantity: z.number().int().min(1).max(50), unitPrice: z.number().min(0), totalPrice: z.number().min(0)
  })).min(1),
  total: z.number().min(0),
  note: z.string().max(500).optional(),
  pickupDate: z.string().optional(),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

function money(n) { return Math.round(Number(n) * 100) / 100; }

async function createOrder(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid order.', errors: parsed.error.flatten() });
  const data = parsed.data;

  const subtotal = money(data.items.reduce((sum, item) => sum + Number(item.totalPrice), 0));
  const total = money(data.total);
  if (Math.abs(subtotal - total) > 0.01) return res.status(400).json({ message: 'Order total does not match item totals.' });

  const preparationMinutes = estimatePreparationMinutes(data.items);
  const requestedDate = normalizeDateKey(data.pickupDate || 'today');
  const requestedSlot = data.pickupTime ? await findNextAvailableSlot(requestedDate, preparationMinutes) : null;

  // if (!requestedSlot || requestedSlot.time !== data.pickupTime) {
  //   const fallback = requestedSlot || null;
  //   const availability = await getAvailability(requestedDate);
  //   return res.status(409).json({
  //     code: 'PICKUP_SLOT_UNAVAILABLE',
  //     message: 'This pickup time is full. Please choose another available time.',
  //     requested: { date: requestedDate, time: data.pickupTime },
  //     preparationMinutes,
  //     suggestedSlot: fallback ? { date: requestedDate, time: fallback.time } : null,
  //     availableSlots: availability.filter(s => s.available).map(s => ({ date: s.date, time: s.time }))
  //   });
  // }

  const customer = await upsertCustomer(data.customer);
  const order = await Order.create({
    orderNumber: makeOrderNumber(),
    invoiceNumber: makeInvoiceNumber(),
    customer: customer._id,
    customerSnapshot: data.customer,
    source: 'preorder',
    items: data.items.map(i => ({ ...i, extras: i.extras || [], unitPrice: money(i.unitPrice), totalPrice: money(i.totalPrice) })),
    subtotal, total, note: data.note,
    pickupAt: localDateTimeToUtc(requestedDate, data.pickupTime),
    pickupDateLabel: data.pickupDate === 'tomorrow' ? 'tomorrow' : 'today',
    preparationMinutes,
    status: 'pending',
    createdBy: 'customer',
    statusHistory: [{ status: 'pending', by: 'customer' }]
  });

  const populated = await Order.findById(order._id).populate('customer', 'name phone').lean();
  req.app.get('io')?.emit('preorder:new', populated);
  res.status(201).json(populated);
}

async function listOrders(req, res) {
  const { status, from, to, source } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (from || to) filter.pickupAt = {};
  if (from) filter.pickupAt.$gte = new Date(from);
  if (to) filter.pickupAt.$lte = new Date(to);
  const orders = await Order.find(filter).populate('customer', 'name phone').sort({ pickupAt: 1, createdAt: -1 }).lean();
  res.json(orders);
}

async function getCurrentCustomerOrders(req, res) {
  const customer = await require('../models/Customer').findOne({ phone: req.params.phone }).lean();
  if (!customer) return res.json({ current: [], history: [] });
  const orders = await Order.find({ customer: customer._id }).sort({ createdAt: -1 }).lean();
  const currentStatuses = ['pending', 'accepted', 'preparing', 'ready'];
  res.json({ current: orders.filter(o => currentStatuses.includes(o.status)), history: orders });
}

async function updateStatus(req, res) {
  const allowed = ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'rejected'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status.' });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  order.status = req.body.status;
  order.statusHistory.push({ status: req.body.status, by: 'cashier', note: req.body.note || '' });
  await order.save();
  const populated = await Order.findById(order._id).populate('customer', 'name phone').lean();
  req.app.get('io')?.emit('order:updated', populated);
  res.json(populated);
}

async function getInvoice(req, res) {
  const order = await Order.findById(req.params.id).populate('customer', 'name phone').lean();
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json({
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    issuedAt: order.createdAt,
    customer: order.customer,
    pickupAt: order.pickupAt,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus
  });
}

module.exports = { createOrder, listOrders, getCurrentCustomerOrders, updateStatus, getInvoice };
