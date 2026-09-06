# Interviewer notes

Interviewer only. Do not show the candidate.

## Setup

```bash
npm install && npm run dev
```

Check http://localhost:5173 and http://localhost:3001/api/health. Keep the 20%
failure rate on. He should notice his UI erroring at random and fix it unprompted.

## Timing (60 min)

| Block | Min |
|---|---|
| Intro: format, think aloud, tasks arrive one at a time, no AI | 3 |
| Task 1: fetch, render, type | 15 |
| Task 2: format, total, group by day | 13 |
| Task 3: search and filter, then requirements change | 14 |
| Task 4: tests | 10 |
| Wrap-up: two internals questions, feedback | 5 |

Interrupt with a question every 3 to 4 minutes. Cut tasks, not depth.
**Mid pass:** Tasks 1 and 2 working with types, most theory answered.
**Strong pass:** survives the requirements change and writes tests.

## Traps in the data

- Two Uber rows at 23:59:30 and 00:00:45 across midnight (timezone, grouping)
- `-0.00` Card verification (renders `-£0.00`)
- Three `-0.10` Fee rows (float sum gives `-0.30000000000000004`)
- `Tesco` and `TESCO` (case-insensitive search)
- Two identical TfL rows 20s apart (key by id)
- `-899.00` EUR DECLINED (must not count in totals)
- `-12.5` with one decimal; four currencies; positive salary and refund

---

## Task 1: Fetch, render and type it (15 min)

**Say:** "Fetch the user and their transactions. Show the user's name and a list
with description, amount, date. Handle loading, error, empty. Let me retry on
error. Type the API responses, and type your state so `loading` and `error`
cannot be true at the same time."

**Good:** parallel requests, header from `src/config.ts`, `res.ok` checked,
retry without reload, abort or stale flag in cleanup, `key={tx.id}`,
literal unions for `currency` and `state`, discriminated union for UI state,
`amount` converted to number once at the boundary.

**Bad:** `any`, `key={index}`, error only logged, loading stuck after error,
three booleans for state, `as Transaction[]` called validation.

### Questions

- **Effect ran twice. Bug in your code or React?**
  StrictMode remount in dev. Fine only if cleanup aborts or ignores the first result. "Remove StrictMode" is wrong: it simulates fast navigation away and back.
- **React 18 no longer warns about setState after unmount. Why still abort?**
  Ordering. Retry twice and the older response can land last and win. Abort or "latest wins" fixes it. "Memory leak" alone is a memorised answer.
- **What does `fetch` actually reject with? What do you get on a 500?**
  Rejects only on network failure, CORS, abort. 500 resolves with `ok: false`. Abort gives `err.name === 'AbortError'`, which should not show an error banner.
- **Some interviewers dislike `try/catch` around the whole `await` block. Steelman that.**
  It catches a `TypeError` from a typo in the success path and reports it as a network error. Alternatives: `.catch` only on the request, or a `Result` type `{ ok: true, data } | { ok: false, error }` from the API layer. Have him sketch it.
- **`Promise.all`: user fails, transactions succeed. What is on screen?**
  Nothing. `all` rejects on the first failure and drops the other result. Separate state or `allSettled` if you want partial UI. Wrong answer: not knowing the result is lost.
- **`setLoading(false); setData(...)` in a `.then`. How many renders?**
  One in React 18 (batching everywhere). Two in 17 outside event handlers. Matters: with two renders there is a frame with `loading false` and `data null`.
- **Token is hardcoded. Where does it live in production, and why not `localStorage`?**
  XSS reads localStorage. httpOnly cookie, or in-memory token with refresh cookie. Trade-off of in-memory: lost on reload.
- **`(await res.json()) as Transaction[]`. What did `as` check at runtime?**
  Nothing. Ask him to write one type guard or name zod/valibot and say which layer it lives in.
- **How many places call `Number()` on `amount`?**
  Should be one, at the boundary.
- **`Number('12.50abc')` vs `parseFloat('12.50abc')`. Which one at a boundary?**
  `NaN` vs `12.5`. Want the strict one so garbage fails loudly.
- **API adds `state: 'REVERTED'` next week. Where does it break, and how could TS have told you?**
  Silent empty render in a `switch`. Exhaustive `never` check or `Record<State, ...>`.
- **Why is `id` a string when it looks numeric?**
  `JSON.parse` gives doubles, precision lost above 2^53. Same reason `amount` is a string.

---

## Task 2: Format, total and group by day (13 min)

**Say:** "Format amounts in their own currency and dates human-readably. Group by
calendar day, newest first, keep API order inside a day, show a per-day spend
total. Only completed outgoing transactions count."

**Good:** `Intl.NumberFormat` created once per currency, `Intl.DateTimeFormat`,
declined and positive excluded, asks what to do with four currencies (answer:
one total per currency), pure `groupByDay()` outside the component, `useMemo`,
output is an array or `Map`, notices `-£0.00`.

**Bad:** `amount + ' ' + currency`, `parseFloat` sum shown raw, grouping in
JSX, `.sort()` on state, `Object.keys` assumed ordered, no question about
mixed currencies.

### Questions

- **Sum the three Fee rows. What do you get?**
  `-0.30000000000000004`. Money is integer minor units. Then: JPY has 0 decimals, some have 3. Where does that table live?
- **`(1.005).toFixed(2)`?**
  `"1.00"`. Binary 1.00499... Never round money with `toFixed`.
- **Why does Card verification show `-£0.00`?**
  `Number('-0.00')` is `-0`. Normalise at the boundary or use `signDisplay`. `Object.is(-0, 0)` is false.
- **Two Uber rows at £6.40. Which day is each on? Whose timezone?**
  Machine local time. Lithuanian IBAN, London merchant, UTC server. The choice belongs in one place. "Just use UTC" means purchases at 22:00 land on the wrong day for the user.
- **`new Intl.NumberFormat` inside the row component. Cost?**
  Expensive, loads locale data. Hoist or cache per currency. Then: how do you know it matters rather than guess? (Profiler.)
- **Object keyed by epoch day number instead of `'2026-09-05'`. Order of `Object.keys`?**
  Integer-like keys enumerate ascending first regardless of insertion. `Map` keeps insertion order for everything.
- **You `.sort()`ed the state array. What did you do to the previous render?**
  Mutated what its props point to. Same reference, so no re-render and no memo recompute. Use `toSorted()` or copy.
- **Is `sort` stable? Do you rely on it?**
  Stable since ES2019. Break ties by `id` anyway.
- **Retry returns the same 69 rows. Does `useMemo` recompute?**
  Yes, new reference. Ask when that would matter.
- **Other reason for `useMemo` besides speed?**
  Referential stability for memoised children and dependency arrays.
- **Does `useMemo` guarantee no recompute?**
  No. Documented as a hint. Code must be correct without it.

---

## Task 3: Search and filter, then the requirements change (14 min)

**Say:** "Add a text box filtering by description, case-insensitive, debounced,
and a dropdown for state. Filters compose with grouping and totals."

**Good:** raw text in state, separate debounced value for filtering, input
never lags, filtered list derived in render or `useMemo`, matches `TESCO`,
asks whether totals should reflect the filter.

**Bad:** debouncing the displayed value, `useEffect` that sets `filtered`
state, `setTimeout` in the body with no cleanup.

### Questions

- **Filtered list in state, updated in an effect. Renders per keystroke, and what is on screen between them?**
  Two renders, one frame of stale list next to new query. Derived data is computed, not stored. Most common mid-level mistake.
- **Timer in `useRef`. Why not `let` or `useState`?**
  `let` is recreated each render so `clearTimeout` misses. `useState` re-renders on every timer id. `useRef` survives renders without causing them.
- **Debounced callback reads `transactions` 300ms later. Which one does it see?**
  The one captured at creation. Stale if a retry landed. Derive in render or use functional updates.
- **Filter then group, or group then filter?**
  Changes what the day total means. Neither is wrong. Not noticing the product question is.
- **Could `useDeferredValue` replace the debounce?**
  Partly. It deprioritises the list render and abandons it on the next keystroke. It does not delay a network request. Different problems.
- **Server-side search: type `a`, delete it, empty response arrives first. What is on screen?**
  Results for `a`. Abort previous, or request counter and ignore non-latest.

### Midway: the requirements change

About six minutes in, once filtering works:

**Say, like a PM:** "Change of plan. Thousands of rows, so the backend paginated
it. `?limit=20` returns `{ items, nextCursor }`. Add Load more. Everything you
built keeps working."

Watch the reaction: complains, asks clarifying questions, reads the README?

**Good:** page type added and TS points at every array assumption, functional
append `setItems(prev => [...prev, ...page.items])`, button disabled in flight,
hidden when `nextCursor` is null, notices the earliest day total is now wrong.

- **TS broke in three places. Where would TS not have caught it?**
  Runtime. If the type had not been updated, `data.map` throws. Types describe intent.
- **`setItems([...items, ...page.items])`. When does it lose data?**
  Two responses before a re-render, or a handler that captured old `items`. Make him describe the sequence.
- **Click Load more twice fast. What is in the list?**
  Duplicates. Disable button, in-flight ref, or dedupe by id. Which is a fix and which a bandage?
- **New transaction inserted on the server between pages. Offset vs this cursor?**
  Offset repeats the last item. Cursor by id is unaffected. When is cursor worse? (Jump to page 7, sort by mutable column.)
- **Is the earliest day total on screen correct?**
  No, the day continues on the next page. "So far", server totals, or fetch by day.

---

## Task 4: Tests (10 min)

**Say:** "Two tests. One for `groupByDay`. One for the component: mock the
network, assert loading, then rows, then error and retry."

**Good:** fixtures include a midnight pair and a DECLINED row, `vi.spyOn(globalThis, 'fetch')`
or `vi.stubGlobal`, `getByText(/loading/i)` sync then `await findByText`,
queries by role and text.

**Bad:** asserting on setState, whole-tree snapshot, `setTimeout` sleeps.

### Questions

- **Five edge cases for `groupByDay`, without looking at the data.**
  Empty, single, midnight pair, unsorted input, declined in list but not total, `-0`, mixed currency, equal timestamps. Four is good.
- **Mock sends `amount: '12.50'`. Backend switches to a number, prod breaks, test passes. What did it prove?**
  That it works with the assumed shape. Type the mock with the real `Transaction` type, contract test, or runtime validation.
- **`getBy` vs `queryBy` vs `findBy`. Why async after the fetch?**
  Throws, returns null, polls up to 1s. State update lands in a microtask after `await`.
- **`vi.useFakeTimers()` to test the debounce. What breaks?**
  `findBy` and `waitFor` poll with real `setTimeout` and hang. Pass `advanceTimers` to `waitFor` config and `userEvent.setup`.
- **Loading assertion passes once, fails once. Why?**
  He awaited something before asserting, and `mockResolvedValue` resolved in a microtask. Assert synchronously after `render`.
- **What would you not unit test here?**
  Intl output, styling, exact debounce interval. "Everything" is a red flag.

---

## Internals bank (pick 2 or 3)

- **From `setState` in your `.then` to pixels. Phases, and where does `useEffect` run?**
  Schedule on fiber. Render phase: call component, reconcile, mark effects, interruptible, doubled in StrictMode. Commit: DOM mutations, `useLayoutEffect` sync, paint, then `useEffect`. Render must be pure because it can be discarded.
- **Put `useMemo` inside `if (status === 'success')`. What breaks and why does React care?**
  Hooks are a linked list on the fiber indexed by call order. No names, only positions.
- **`React.memo` on `TransactionRow` with `onSelect={() => ...}`. Faster?**
  No, new function fails shallow compare. `useCallback` fixes that. Then: are `tx` objects stable? If `groupByDay` creates new objects, memo fails again.
- **Flat list to grouped and back, same keys. DOM reused?**
  No. Keys match siblings under the same parent. New parent means remount and lost row state.
- **Why keys at all if React has the fiber tree?**
  Without keys it matches by index. Insert at top and every row gets the wrong data. `Math.random()` key remounts everything every render.
- **Is `e` in `onChange` the native event? Where is the listener attached?**
  Synthetic wrapper. Root container since React 17, not `document`. Change mattered for multiple React roots and `stopPropagation` interop.
- **`fetch().then(setState)` and `setTimeout(() => setState(), 0)` queued by one click. Order, and batched together?**
  Microtasks drain first. Batched within each callback, not across, so two renders.
- **Component logged twice in dev. Is your render pure? What makes it impure?**
  StrictMode double invoke. Mutating props, `Date.now()`, pushing to outer arrays, `.sort()` on a prop. Concurrent rendering can discard or replay renders.
- **Setter with the same value. Re-render?**
  No, `Object.is` bail-out. `setItems([...items])` with same contents: yes, new reference.
- **What does `await` do to the rest of the function?**
  Continuation queued as microtask when settled. Code before the first `await` runs sync. `await` on a non-promise still yields.
- **`structuredClone` vs spread vs JSON round trip before sort?**
  Spread is shallow and enough. `structuredClone` deep, handles Date and Map. JSON drops `undefined`, stringifies Date, dies on cycles.

## Networking (drop in while a request loads)

- **Remove the Vite proxy and call `localhost:3001` directly. What happens?**
  Preflight because `x-access-token` is non-simple. No CORS headers on the mock, so the request never goes. Server needs `Allow-Origin` and `Allow-Headers`. `Content-Type: application/json` alone also triggers preflight.
- **Token expires and the API returns 401. Where is that handled once for the whole app?**
  Single fetch wrapper or interceptor mapping 401 to logout or refresh-and-retry.
- **Two tabs refresh the token at the same moment.**
  Rotation rejects the second. Share via `BroadcastChannel` or storage event, or a lock. Bonus, not required.
- **Retry clicked five times in a second. What reaches the server, and for `POST /transfer`, what stops five transfers?**
  Five requests unless disabled or aborted. Idempotency key header, server dedupes. Banks care about this one.
- **Same GET twice in ten seconds. No headers, `max-age=60`, `ETag`?**
  Heuristic, usually none for APIs. Served from cache, no request. Conditional request, 304, no body. React Query `staleTime` is a separate in-memory layer.

---

## Scoring (1 to 4, mid pass is mostly 3s, no 1s)

| Area | 2 | 3 | 4 |
|---|---|---|---|
| Problem solving | Needs hints | Independent, good clarifying questions | Anticipates next requirement |
| JavaScript | Knows rules, cannot explain | Explains event loop and closures on own code | Predicts unfamiliar combinations |
| React | Correct patterns, vague internals | Render/commit, batching, referential equality | Concurrent rendering, fibers |
| TypeScript | Types the shapes | Discriminated unions, boundary conversion | Exhaustiveness, runtime validation |
| Data | Correct with hints | Pure functions, integer money, order guarantees | Timezone and multi-currency unprompted |
| Networking | Happy path plus error | Abort, retry, races | Caching, idempotency, auth flow |
| Testing | One happy path | Pure unit plus async RTL | Mock limits, fake timer pitfalls |
| Communication | Narrates after the fact | Explains intent before typing | Pushes back with reasons |

**Feedback:** be concrete. Pick his two lowest areas, give him the exact
question he missed and the answer. Warn him the real interviewer may edit his
code live to break it.
