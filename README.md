# Transactions Feed

Live coding exercise. React 19 + TypeScript + Vite on the front, an Express mock
bank API behind it.

## Run

```bash
npm install
npm run dev        # starts API on :3001 and the app on http://localhost:5173
npm test           # vitest in watch mode
npm run typecheck  # tsc --noEmit
```

`npm run dev` runs both processes. The app proxies `/api/*` to the mock server,
so in the browser you call `/api/transactions`, not `http://localhost:3001/...`.

The API is flaky on purpose: about 1 in 5 requests returns a 500, and every
request takes 0.4 to 1.2 seconds. To calm it down:

```bash
FAIL_RATE=0 MIN_LATENCY_MS=100 MAX_LATENCY_MS=200 npm run dev
```

## API

Every request needs the header `x-access-token: interview-token-2026`
(see `src/config.ts`). Without it you get `401 { "error": "Unauthorized" }`.

### `GET /api/user`

```json
{
  "id": "usr-7f3a",
  "firstName": "Ahmad",
  "lastName": "Candidate",
  "iban": "LT12 3250 0123 4567 8901",
  "currency": "GBP",
  "state": "ACTIVE"
}
```

### `GET /api/transactions`

Returns an array, newest first.

```json
[
  {
    "id": "tx-0042",
    "amount": "-12.50",
    "createdDate": 1757016045000,
    "currency": "GBP",
    "description": "Tesco",
    "state": "COMPLETED"
  }
]
```

- `amount` is a string. Negative is money out, positive is money in.
- `createdDate` is epoch milliseconds.
- `currency` is one of `GBP`, `EUR`, `USD`, `PLN`.
- `state` is one of `COMPLETED`, `PENDING`, `DECLINED`.

### `GET /api/transactions?limit=20&cursor=<id>`

When `limit` is present the response shape changes to a page:

```json
{ "items": [ ... ], "nextCursor": "tx-0017" }
```

`nextCursor` is `null` on the last page. Pass it back as `cursor` to get the
next page.

### Extras

- `GET /api/health` needs no token and never fails.
- Add `?__fail=1` to any request to force a 500.
