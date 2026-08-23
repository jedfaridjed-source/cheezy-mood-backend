const { timezone, slotMinutes, openingTime, closingTime } = require('../config/env');

function zonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second)
  };
}

function dateKeyFromZoned(date = new Date()) {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addDaysKey(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function localDateTimeToUtc(dateKey, hhmm) {
  // Tunisia is UTC+1 in the restaurant's operating timezone. Keep conversion centralized.
  // If timezone rules ever change, this helper should be replaced with a timezone library.
  const [h, m] = hhmm.split(':').map(Number);
  const utc = new Date(`${dateKey}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
  utc.setUTCHours(utc.getUTCHours() - 1);
  return utc;
}

function buildSlots(dateKey) {
  const slots = [];
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  for (let mins = openH * 60 + openM; mins <= closeH * 60 + closeM; mins += slotMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push({
      date: dateKey,
      time: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
      pickupAt: localDateTimeToUtc(dateKey, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    });
  }
  return slots;
}

module.exports = { zonedParts, dateKeyFromZoned, addDaysKey, localDateTimeToUtc, buildSlots };
