require('dotenv').config();



const http = require('http'); 
const express = require('express'); 
const cors = require('cors'); 
const helmet = require('helmet'); 
const morgan = require('morgan'); 
const { Server } = require('socket.io');
const { connectDatabase } = require('./config/db'); 
const { port, frontendUrl, cashierFrontendUrl } = require('./config/env');
const orderRoutes = require('./routes/order.routes'), customerRoutes = require('./routes/customer.routes'), slotRoutes = require('./routes/slot.routes'), storeRoutes = require('./routes/store.routes'), articleRoutes = require('./routes/article.routes');
const app = express(), server = http.createServer(app);
const allowedOrigins = [frontendUrl, cashierFrontendUrl, 'http://localhost:4200', 'http://localhost:4300'].filter(Boolean);
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], credentials: true } });



app.use(cors({ origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); console.log('CORS blocked:', origin); return cb(new Error(`CORS blocked: ${origin}`)); }, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Cashier-Api-Key'] }));
app.use(helmet()); app.use(express.json({ limit: '500kb' })); app.use(morgan('dev')); app.set('io', io);
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cheezy-mood-backend', time: new Date().toISOString() }));
app.use('/api/orders', orderRoutes); app.use('/api/customers', customerRoutes); app.use('/api/slots', slotRoutes); app.use('/api/store', storeRoutes); app.use('/api/articles', articleRoutes);
app.use((err, _req, res, _next) => { console.error(err); res.status(err.status || 500).json({ message: err.message || 'Internal server error.', code: err.code }); });
io.on('connection', socket => { console.log(`Socket connected: ${socket.id}`); socket.on('cashier:join', () => socket.join('cashier')); socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`)); });

connectDatabase().then(() => server.listen(port, '0.0.0.0', () => console.log(`Cheezy Mood backend listening on port ${port}`))).catch(err => { console.error('Startup failed:', err); process.exit(1); });
