# Cheezy Mood Backend

Central backend for preorder + cashier + stock + store status + pickup capacity.

## Run

1. Keep your existing `.env` inside `src/.env` (do not commit secrets).
2. `npm install`
3. `npm run dev`

## Main APIs

- `GET /api/health`
- `GET /api/store/status` public store status
- `PATCH /api/store/settings` cashier
- `POST /api/store/open` cashier
- `POST /api/store/close` cashier
- `GET /api/articles/availability` public availability
- `GET /api/articles` article list
- `POST /api/articles` cashier
- `PATCH /api/articles/:id` cashier
- `PATCH /api/articles/:id/stock` cashier
- `POST /api/orders` preorder
- `POST /api/orders/cashier` cashier direct sale
- `GET /api/orders` cashier
- `PATCH /api/orders/:id/status` cashier
- `GET /api/orders/:id/invoice` cashier
- `GET /api/slots?date=today`
- `GET /api/slots/next?preparationMinutes=30`

Cashier endpoints require `x-cashier-api-key` matching `CASHIER_API_KEY` in `.env`.
