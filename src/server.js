const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const { connectDatabase } = require('./config/db');
const { port, frontendUrl } = require('./config/env');
const orderRoutes = require('./routes/order.routes');
const customerRoutes = require('./routes/customer.routes');
const slotRoutes = require('./routes/slot.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: frontendUrl, methods: ['GET', 'POST', 'PATCH'] } });
app.set('io', io);

app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cheezy-mood-backend', time: new Date().toISOString() }));
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/slots', slotRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('cashier:join', () => socket.join('cashier'));
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

connectDatabase()
  .then(() => app.listen(port, '0.0.0.0', () => {
  console.log(`Cheezy Mood backend listening on port ${port}`);
}))
  .catch(err => { console.error('Startup failed:', err); process.exit(1); });
