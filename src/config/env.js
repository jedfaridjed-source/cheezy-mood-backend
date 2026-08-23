require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5000),

  mongoUri: process.env.MONGO_URI,

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  cashierApiKey: process.env.CASHIER_API_KEY || '',

  timezone: process.env.RESTAURANT_TIMEZONE || 'Africa/Tunis',

  slotMinutes: Number(process.env.ORDER_SLOT_MINUTES || 15),

  capacityPerSlot: Number(
    process.env.PREPARATION_CAPACITY_MINUTES_PER_SLOT || 60
  ),

  minPreparationMinutes: Number(
    process.env.MIN_PREPARATION_MINUTES || 30
  ),

  openingTime: process.env.OPENING_TIME || '12:00',

  closingTime: process.env.CLOSING_TIME || '19:00'
};