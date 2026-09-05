import express from 'express';
import { buildTransactions, USER } from './data.js';

const PORT = Number(process.env.PORT ?? 3001);
const TOKEN = process.env.API_TOKEN ?? 'interview-token-2026';
// Chance that any authenticated request fails with a 500. Set FAIL_RATE=0 to disable.
const FAIL_RATE = process.env.FAIL_RATE !== undefined ? Number(process.env.FAIL_RATE) : 0.2;
const MIN_LATENCY = Number(process.env.MIN_LATENCY_MS ?? 400);
const MAX_LATENCY = Number(process.env.MAX_LATENCY_MS ?? 1200);

const TRANSACTIONS = buildTransactions();

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, transactions: TRANSACTIONS.length, failRate: FAIL_RATE });
});

// Everything below requires the token.
app.use('/api', (req, res, next) => {
  if (req.get('x-access-token') !== TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Simulated latency + flaky backend. `?__fail=1` forces a failure.
app.use('/api', (req, res, next) => {
  const delay = MIN_LATENCY + Math.random() * Math.max(0, MAX_LATENCY - MIN_LATENCY);
  setTimeout(() => {
    if (req.query.__fail === '1' || Math.random() < FAIL_RATE) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    next();
  }, delay);
});

app.get('/api/user', (_req, res) => {
  res.json(USER);
});

// Without `limit`: the full array, newest first (the original contract).
// With `limit` (and optional `cursor`): { items, nextCursor } for the
// "requirements changed, the API paginates now" step.
app.get('/api/transactions', (req, res) => {
  const { limit, cursor } = req.query;
  if (limit === undefined) {
    return res.json(TRANSACTIONS);
  }
  const size = Math.min(Math.max(Number(limit) || 10, 1), 50);
  let start = 0;
  if (cursor) {
    const idx = TRANSACTIONS.findIndex((t) => t.id === cursor);
    if (idx === -1) return res.status(400).json({ error: 'Invalid cursor' });
    start = idx + 1;
  }
  const items = TRANSACTIONS.slice(start, start + size);
  const last = items[items.length - 1];
  const nextCursor = start + size < TRANSACTIONS.length && last ? last.id : null;
  res.json({ items, nextCursor });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Mock bank API on http://localhost:${PORT}/api  (fail rate ${FAIL_RATE}, ${TRANSACTIONS.length} transactions)`);
});
