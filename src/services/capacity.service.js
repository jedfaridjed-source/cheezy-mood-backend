const Order = require('../models/Order');
const StoreSettings = require('../models/StoreSettings');

const {
  minPreparationMinutes,
  slotMinutes
} = require('../config/env');

const {
  dateKeyFromZoned,
  addDaysKey,
  localDateTimeToUtc,
  zonedParts
} = require('../utils/time');


function normalizeDateKey(value) {
  if (!value || value === 'today') {
    return dateKeyFromZoned();
  }

  if (value === 'tomorrow') {
    return addDaysKey(dateKeyFromZoned(), 1);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  throw new Error(
    'Invalid date. Use today, tomorrow, or YYYY-MM-DD.'
  );
}


function hhmmMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}


function minutesToHhmm(value) {
  value = ((value % 1440) + 1440) % 1440;

  return (
    `${String(Math.floor(value / 60)).padStart(2, '0')}:` +
    `${String(value % 60).padStart(2, '0')}`
  );
}


function itemDepartmentMinutes(items) {

  const departments = {
    sandwich: 0,
    pasta: 0,
    fries: 0,
    general: 0
  };

  for (const item of items || []) {

    const department =
      item.department || 'general';

    const preparationMinutes =
      Math.max(
        0,
        Number(item.preparationMinutes || 5)
      );

    const quantity =
      Math.max(
        1,
        Number(item.quantity || 1)
      );

    departments[department] =
      (departments[department] || 0) +
      preparationMinutes * quantity;
  }

  return departments;
}


function estimatePreparationMinutes(items) {

  const departments =
    itemDepartmentMinutes(items);

  return Math.max(
    minPreparationMinutes,
    ...Object.values(departments),
    0
  );
}


async function getStore() {

  return StoreSettings
    .findOne({ key: 'main' })
    .lean();
}


async function getActiveOrders(dateKey) {

  const start =
    localDateTimeToUtc(dateKey, '00:00');

  const end =
    localDateTimeToUtc(dateKey, '23:59');

  return Order.find({
    pickupAt: {
      $gte: start,
      $lte: end
    },

    status: {
      $nin: [
        'cancelled',
        'rejected',
        'completed'
      ]
    }
  })
    .sort({
      pickupAt: 1,
      priority: -1,
      createdAt: 1
    })
    .lean();
}


/*
 * Schedule one department independently.
 *
 * IMPORTANT:
 * We only reject an order when the production
 * start time would be in the past.
 */
function scheduleDepartmentOrders(
  orders,
  department,
  nowMs
) {

  const relevant =
    orders
      .filter(order =>
        (order.items || []).some(
          item =>
            (item.department || 'general') === department
        )
      );

  const rows =
    relevant
      .map(order => ({
        order,
        duration:
          itemDepartmentMinutes(
            order.items
          )[department],

        pickup:
          new Date(order.pickupAt).getTime()
      }))
      .filter(row => row.duration > 0)
      .sort(
        (a, b) =>
          a.pickup - b.pickup ||
          (b.order.priority || 0) -
          (a.order.priority || 0) ||
          new Date(a.order.createdAt) -
          new Date(b.order.createdAt)
      );

  let next =
    Number.POSITIVE_INFINITY;

  const result =
    new Map();

  let feasible = true;

  for (let i = rows.length - 1; i >= 0; i--) {

    const row = rows[i];

    const latestStart =
      Math.min(
        row.pickup,
        next
      ) -
      row.duration * 60000;

    result.set(
      String(row.order._id),
      {
        startAt: new Date(latestStart),
        duration: row.duration,
        pickupAt: new Date(row.pickup)
      }
    );

    /*
     * A candidate is impossible only if its
     * production must already have started.
     */
    if (
      String(row.order._id) === 'candidate' &&
      latestStart < nowMs
    ) {
      feasible = false;
    }

    next = latestStart;
  }

  return {
    result,
    feasible
  };
}


async function scheduleCandidate(candidate) {

  const orders =
    await getActiveOrders(
      candidate.dateKey
    );

  const candidateOrder = {
    _id: 'candidate',

    pickupAt:
      candidate.pickupAt,

    createdAt:
      new Date(),

    priority:
      candidate.priority ||
      candidate.pickupAt.getTime(),

    items:
      candidate.items,

    status:
      'pending'
  };

  orders.push(candidateOrder);

  const now =
    Date.now();

  let feasible = true;

  let productionStartAt =
    candidate.pickupAt;

  const schedule = {};

  for (
    const department of [
      'sandwich',
      'pasta',
      'fries',
      'general'
    ]
  ) {

    const result =
      scheduleDepartmentOrders(
        orders,
        department,
        now
      );

    schedule[department] =
      result.result;

    feasible =
      feasible &&
      result.feasible;

    const candidateRow =
      result.result.get('candidate');

    if (candidateRow) {

      if (
        candidateRow.startAt.getTime() >
        productionStartAt.getTime()
      ) {
        productionStartAt =
          candidateRow.startAt;
      }
    }
  }

  return {
    feasible,
    productionStartAt,
    readyAt: candidate.pickupAt,
    schedule
  };
}


/*
 * Find a real available pickup slot.
 */
async function findNextAvailableSlot(
  dateInput,
  requiredMinutes,
  items = []
) {

  const dateKey =
    normalizeDateKey(dateInput);

  const store =
    await getStore();

  const opening =
    hhmmMinutes(
      store?.openingTime || '11:00'
    );

  const closing =
    hhmmMinutes(
      store?.closingTime || '23:30'
    );

  const nowParts =
    zonedParts();

  const today =
    dateKeyFromZoned();

  let minimumMinute =
    opening;

  if (dateKey === today) {

    const nowMinutes =
      nowParts.hour * 60 +
      nowParts.minute;

    minimumMinute =
      Math.max(
        opening,
        nowMinutes +
        minPreparationMinutes
      );
  }

  const preparationItems =
    items.length
      ? items
      : [
          {
            department: 'general',
            preparationMinutes:
              requiredMinutes,
            quantity: 1
          }
        ];

  const firstSlot =
    Math.ceil(
      minimumMinute / slotMinutes
    ) * slotMinutes;

  for (
    let minute = firstSlot;
    minute <= closing;
    minute += slotMinutes
  ) {

    const time =
      minutesToHhmm(minute);

    const pickupAt =
      localDateTimeToUtc(
        dateKey,
        time
      );

    if (
      pickupAt.getTime() <=
      Date.now()
    ) {
      continue;
    }

    const test =
      await scheduleCandidate({
        dateKey,
        pickupAt,
        items: preparationItems,
        priority: pickupAt.getTime()
      });

    if (test.feasible) {

      return {
        date: dateKey,
        time,
        pickupAt,
        productionStartAt:
          test.productionStartAt,
        readyAt:
          test.readyAt,
        preparationMinutes:
          estimatePreparationMinutes(
            preparationItems
          )
      };
    }
  }

  return null;
}


/*
 * THIS IS THE IMPORTANT PART.
 *
 * Availability now uses the exact same
 * production-capacity test as order creation.
 *
 * Therefore the frontend will NEVER show
 * a slot that the POST /orders endpoint
 * will immediately reject.
 */
async function getAvailability(dateInput) {

  const dateKey =
    normalizeDateKey(dateInput);

  const store =
    await getStore();

  const opening =
    hhmmMinutes(
      store?.openingTime || '11:00'
    );

  const closing =
    hhmmMinutes(
      store?.closingTime || '23:30'
    );

  const nowParts =
    zonedParts();

  const today =
    dateKeyFromZoned();

  let minimumMinute =
    opening;

  if (dateKey === today) {

    const nowMinutes =
      nowParts.hour * 60 +
      nowParts.minute;

    minimumMinute =
      Math.max(
        opening,
        nowMinutes +
        minPreparationMinutes
      );
  }

  const slots = [];

  const firstSlot =
    Math.ceil(
      minimumMinute / slotMinutes
    ) * slotMinutes;

  for (
    let minute = firstSlot;
    minute <= closing;
    minute += slotMinutes
  ) {

    const time =
      minutesToHhmm(minute);

    const pickupAt =
      localDateTimeToUtc(
        dateKey,
        time
      );

    /*
     * Use a generic 5-minute preparation
     * job to determine whether the slot itself
     * is structurally possible.
     */
    const test =
      await scheduleCandidate({
        dateKey,
        pickupAt,
        items: [
          {
            department: 'general',
            preparationMinutes: 5,
            quantity: 1
          }
        ],
        priority: pickupAt.getTime()
      });

    slots.push({
      date: dateKey,
      time,
      pickupAt,
      available: test.feasible,
      productionStartAt:
        test.productionStartAt
    });
  }

  return slots;
}


async function findFirstAvailableSlot(
  requiredMinutes,
  items = []
) {

  const today =
    dateKeyFromZoned();

  const tomorrow =
    addDaysKey(
      today,
      1
    );

  return (
    await findNextAvailableSlot(
      today,
      requiredMinutes,
      items
    )
  ) || (
    await findNextAvailableSlot(
      tomorrow,
      requiredMinutes,
      items
    )
  );
}


module.exports = {
  normalizeDateKey,
  getAvailability,
  findNextAvailableSlot,
  findFirstAvailableSlot,
  estimatePreparationMinutes,
  itemDepartmentMinutes,
  scheduleCandidate
};