const Order = require('../models/Order');
const { capacityPerSlot, minPreparationMinutes } = require('../config/env');
const { buildSlots, dateKeyFromZoned, addDaysKey, zonedParts } = require('../utils/time');

function normalizeDateKey(value) {
  if (value === 'today' || !value) return dateKeyFromZoned();
  if (value === 'tomorrow') return addDaysKey(dateKeyFromZoned(), 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error('Invalid date. Use today, tomorrow, or YYYY-MM-DD.');
}

function roundUpToSlot(minutes, slotMinutes) {
  return Math.ceil(minutes / slotMinutes) * slotMinutes;
}

function effectivePreparationMinutes(order) {
  return Math.max(minPreparationMinutes, Number(order.preparationMinutes || 30));
}

async function getSlotUsage(dateKey) {
  const start = buildSlots(dateKey)[0]?.pickupAt;
  const slots = buildSlots(dateKey);
  const end = slots[slots.length - 1]?.pickupAt;
  if (!start || !end) return [];

  const orders = await Order.find({
    pickupAt: { $gte: start, $lte: new Date(end.getTime() + 60 * 60 * 1000) },
    status: { $nin: ['cancelled', 'rejected', 'completed'] }
  }).lean();

  return slots.map(slot => {
    const usage = orders
      .filter(o => Math.abs(new Date(o.pickupAt).getTime() - slot.pickupAt.getTime()) < 8 * 60 * 1000)
      .reduce((sum, o) => sum + effectivePreparationMinutes(o) * Number(o.items.reduce((q, i) => q + i.quantity, 0)), 0);
    return {
      date: dateKey,
      time: slot.time,
      pickupAt: slot.pickupAt,
      usedPreparationMinutes: usage,
      capacityMinutes: capacityPerSlot,
      available: usage < capacityPerSlot
    };
  });
}

async function getAvailability(dateInput) {
  const dateKey = normalizeDateKey(dateInput);
  const usage = await getSlotUsage(dateKey);
  const now = new Date();
  const minAllowed = new Date(now.getTime() + minPreparationMinutes * 60 * 1000);
  return usage.map(slot => ({
    ...slot,
    available: slot.available && slot.pickupAt >= minAllowed,
    remainingPreparationMinutes: Math.max(0, capacityPerSlot - slot.usedPreparationMinutes)
  }));
}

async function findNextAvailableSlot(dateInput, requiredMinutes) {
  const dateKey = normalizeDateKey(dateInput);
  const usage = await getAvailability(dateKey);
  const required = Math.max(minPreparationMinutes, Number(requiredMinutes || 30));
  const found = usage.find(slot => slot.available && slot.remainingPreparationMinutes >= required);
  return found || null;
}

async function findFirstAvailableSlot(requiredMinutes) {
  const today = dateKeyFromZoned();
  const tomorrow = addDaysKey(today, 1);
  return (await findNextAvailableSlot(today, requiredMinutes)) || (await findNextAvailableSlot(tomorrow, requiredMinutes));
}

function estimatePreparationMinutes(items) {
  // MVP rule: every quantity unit consumes 15 minutes of kitchen capacity, with a 30-minute minimum.
  const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return Math.max(minPreparationMinutes, units * 15);
}

module.exports = { normalizeDateKey, getAvailability, findNextAvailableSlot, findFirstAvailableSlot, estimatePreparationMinutes, roundUpToSlot };
