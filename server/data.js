// Deterministic mock data. Same seed => same list every run, so the
// interviewer can rely on the traps being there.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = [
  { description: 'Tesco', currency: 'GBP', min: 3, max: 80 },
  { description: 'Pret A Manger', currency: 'GBP', min: 3, max: 12 },
  { description: 'TfL Travel Charge', currency: 'GBP', min: 2.8, max: 9.6 },
  { description: 'Spotify', currency: 'GBP', min: 10.99, max: 10.99 },
  { description: 'Bolt', currency: 'EUR', min: 4, max: 30 },
  { description: 'Lidl', currency: 'EUR', min: 5, max: 60 },
  { description: 'Amazon', currency: 'USD', min: 8, max: 140 },
  { description: 'Netflix', currency: 'USD', min: 15.49, max: 15.49 },
  { description: 'Allegro', currency: 'PLN', min: 20, max: 400 },
  { description: 'Żabka', currency: 'PLN', min: 4, max: 45 },
];

const STATES = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'DECLINED'];

const DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

export function buildTransactions() {
  const rand = mulberry32(20260905);
  const today = startOfToday();
  const items = [];
  let seq = 1;

  const push = (tx) => {
    items.push({ id: `tx-${pad(seq++, 4)}`, ...tx });
  };

  // 55 random card payments over the last 30 days.
  for (let i = 0; i < 55; i++) {
    const m = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
    const daysAgo = Math.floor(rand() * 30);
    const msIntoDay = Math.floor(rand() * DAY);
    const amount = m.min + rand() * (m.max - m.min);
    push({
      amount: `-${amount.toFixed(2)}`,
      createdDate: today - daysAgo * DAY + msIntoDay,
      currency: m.currency,
      description: m.description,
      state: STATES[Math.floor(rand() * STATES.length)],
    });
  }

  // Incoming money.
  push({ amount: '3200.00', createdDate: today - 27 * DAY + 9 * 3600e3, currency: 'GBP', description: 'Salary - Acme Ltd', state: 'COMPLETED' });
  push({ amount: '42.99', createdDate: today - 6 * DAY + 14 * 3600e3, currency: 'USD', description: 'Refund: Amazon', state: 'COMPLETED' });
  push({ amount: '150.00', createdDate: today - 2 * DAY + 19 * 3600e3, currency: 'EUR', description: 'Transfer from Jonas K.', state: 'PENDING' });

  // --- Deliberate traps -----------------------------------------------------

  // Day boundary: 23:59:30 yesterday and 00:00:45 today, same merchant.
  push({ amount: '-6.40', createdDate: today - 30e3, currency: 'GBP', description: 'Uber', state: 'COMPLETED' });
  push({ amount: '-6.40', createdDate: today + 45e3, currency: 'GBP', description: 'Uber', state: 'COMPLETED' });

  // Negative zero. Number('-0.00') is -0 and Intl prints "-£0.00".
  push({ amount: '-0.00', createdDate: today - 4 * DAY + 11 * 3600e3, currency: 'GBP', description: 'Card verification', state: 'COMPLETED' });

  // One decimal place instead of two.
  push({ amount: '-12.5', createdDate: today - 1 * DAY + 13 * 3600e3, currency: 'GBP', description: 'Boots', state: 'COMPLETED' });

  // Same merchant, different casing (search must be case-insensitive).
  push({ amount: '-23.10', createdDate: today - 3 * DAY + 18 * 3600e3, currency: 'GBP', description: 'TESCO', state: 'COMPLETED' });

  // Two legitimately identical rows within the same minute (key by id, not by content).
  push({ amount: '-2.80', createdDate: today - 1 * DAY + 8 * 3600e3 + 12 * 60e3, currency: 'GBP', description: 'TfL Travel Charge', state: 'COMPLETED' });
  push({ amount: '-2.80', createdDate: today - 1 * DAY + 8 * 3600e3 + 12 * 60e3 + 20e3, currency: 'GBP', description: 'TfL Travel Charge', state: 'COMPLETED' });

  // A declined spend that must not count in totals.
  push({ amount: '-899.00', createdDate: today - 5 * DAY + 20 * 3600e3, currency: 'EUR', description: 'Apple Store', state: 'DECLINED' });

  // Float trap: these three sum to 0.30 only if you are careful.
  push({ amount: '-0.10', createdDate: today - 8 * DAY + 10 * 3600e3, currency: 'GBP', description: 'Fee', state: 'COMPLETED' });
  push({ amount: '-0.10', createdDate: today - 8 * DAY + 10 * 3600e3 + 60e3, currency: 'GBP', description: 'Fee', state: 'COMPLETED' });
  push({ amount: '-0.10', createdDate: today - 8 * DAY + 10 * 3600e3 + 120e3, currency: 'GBP', description: 'Fee', state: 'COMPLETED' });

  // API contract: newest first.
  items.sort((a, b) => b.createdDate - a.createdDate);
  return items;
}

export const USER = {
  id: 'usr-7f3a',
  firstName: 'Ahmad',
  lastName: 'Candidate',
  iban: 'LT12 3250 0123 4567 8901',
  currency: 'GBP',
  state: 'ACTIVE',
};
