# Cheezy Mood Backend — Step 1

Node.js + Express + MongoDB + Socket.IO backend for the Cheezy Mood preorder app.

## What this backend handles

- Customer profile: name + phone.
- Current orders.
- Complete order history.
- Preorder creation.
- Pickup-time availability controlled by the backend (the frontend is not trusted for capacity).
- Preparation-time/capacity calculation.
- Reject a full pickup slot and return available alternatives.
- Cashier order list.
- Cashier order status updates.
- Real-time `preorder:new` event with Socket.IO.
- Invoice/order number generation and invoice data endpoint.

## Important business rule

The first MVP capacity rule is deliberately simple:

- Each order unit consumes 15 preparation minutes.
- Minimum preparation time is 30 minutes.
- Each 15-minute pickup slot has 60 preparation minutes of capacity.
- Cancelled/rejected/completed orders do not consume active capacity.

This is a starting rule. Once we connect the real Cashier app, we should replace it with your actual kitchen capacity by department (sandwich / pasta / fries) so a busy sandwich order does not unnecessarily block a pasta slot.

## Install

```bash
npm install
copy .env.example .env
```

Edit `.env` with your MongoDB connection and a strong cashier API key.

## Run

```bash
npm run dev
```

Health check:

`GET http://localhost:5000/api/health`

## Main endpoints

### Public customer endpoints

`POST /api/orders`

`GET /api/customers/:phone/orders`

`GET /api/customers/:phone/history`

`GET /api/slots?date=today`

`GET /api/slots?date=tomorrow`

`GET /api/slots/next?preparationMinutes=45`

### Cashier endpoints

Send header:

`x-cashier-api-key: YOUR_CASHIER_API_KEY`

`GET /api/orders`

`PATCH /api/orders/:id/status`

`GET /api/orders/:id/invoice`

### Socket.IO

The cashier can connect to Socket.IO and emit:

`cashier:join`

New preorder event:

`preorder:new`

Order update event:

`order:updated`

## Next step

Connect the Angular preorder frontend to this API, then build the Cheezy Mood Cashier Angular app against the same API.

For the final production system, use HTTPS, a managed MongoDB instance, a proper cashier/admin authentication system, and server-side menu/pricing validation instead of trusting prices sent by the browser.
