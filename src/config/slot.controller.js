require('dotenv').config();
module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  cashierFrontendUrl: process.env.CASHIER_FRONTEND_URL || 'http://localhost:4300',
  cashierApiKey: process.env.CASHIER_API_KEY || '',
  timezone: process.env.RESTAURANT_TIMEZONE || 'Africa/Tunis',
  slotMinutes: Number(process.env.ORDER_SLOT_MINUTES || 15),
  capacityPerSlot: Number(process.env.PREPARATION_CAPACITY_MINUTES_PER_SLOT || 60),
  minPreparationMinutes: Number(process.env.MIN_PREPARATION_MINUTES || 5),
  openingTime: process.env.OPENING_TIME || '12:00',
  closingTime: process.env.CLOSING_TIME || '21:00',
  closingSoonMinutes: Number(process.env.CLOSING_SOON_MINUTES || 60)
};
