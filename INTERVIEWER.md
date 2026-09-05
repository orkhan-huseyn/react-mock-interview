# Interviewer notes: Transactions Feed

For the interviewer only. Do not show the candidate.

The format mirrors what fintech live-coding rounds actually run: one realistic fetch-and-render
task against a mock bank API, extended step by step, with a requirements change
in the middle. No puzzles. The theory questions below are meant to be asked
*about the code he just wrote*, not as a separate quiz.

## Before the call

```bash
npm install
npm run dev
```

Open http://localhost:5173 and http://localhost:3001/api/health once to confirm
both are up. Decide whether to keep the 20% failure rate on. Keep it on: he
should notice his own UI erroring at random and react to it without being told.

Run through the mock API in the browser dev tools yourself first so you know
the shape. `README.md` documents it.

## Timing (60 min)

| Block | Minutes | What happens |
|---|---|---|
| Intro | 3 | Explain format. Ask him to think aloud. Tell him tasks arrive one at a time. |
| Task 1: fetch, render, type | 15 | Loading, error, empty, retry. Real API types, real UI state type. |
| Task 2: format, total, group by day | 13 | Intl, money, day boundary. Pure function, memo, ordering. |
| Task 3: search and filter, then the requirements change | 14 | Controlled input, debounce, derived state. Then the API paginates. |
| Task 4: tests | 10 | One pure test, one RTL test. |
| Wrap-up | 5 | Two internals questions from the bank, then feedback. |

You will not get through everything. Each task here is two of the smaller
tasks a real interview hands out one at a time, so finishing two of them
properly is on target. Cut tasks, not depth. A mid-level pass is Tasks 1 and 2
working with types, plus a reasonable answer to most theory questions. Getting
through the requirements change in Task 3 and writing tests in Task 4 is a
strong pass.

Interrupt with a question roughly every 3 to 4 minutes while he codes. That is
what the real interview feels like.

## What to say at the start

> "You have a running app and a mock bank API. The README has the contract.
> I'll give you the tasks one at a time. Talk me through what you're doing and
> why. I will interrupt with questions. It's fine to say 'let me finish this
> line first'. Correctness and clean code matter more than finishing everything.
> No AI tools."

---

## Task 1: Fetch, render and type it (15 min)

**Say:** "Fetch the current user and their transactions. Show the user's name
and a list of transactions with description, amount and date. Handle loading,
error and empty states. On error, let me retry. Type the API
responses properly, and type your component state so that it is impossible to
be in `loading` and `error` at the same time."

**Expect to see**

- Both requests fire on mount, ideally in parallel.
- `x-access-token` header set, and he found it in `src/config.ts` or the README
  without asking.
- `res.ok` checked. `fetch` does not reject on 4xx or 5xx.
- The error state actually shows up (the API fails 20% of the time, so it will).
- Retry re-runs the fetch, not a page reload.
- Cleanup in the effect: `AbortController` or at least an "ignore stale result" flag.
- Key by `tx.id`.
- A `Transaction` type with `amount: string`, `createdDate: number`, literal
  unions for `currency` and `state`.
- A discriminated union for UI state:
  `{ status: 'loading' } | { status: 'error'; error: string } | { status: 'success'; data: Transaction[] }`.
- Ideally a separate domain type where `amount` is already a number and
  `createdDate` is a `Date` or number, converted once at the API boundary.

**Red flags:** `any` on the response, `key={index}`, error swallowed with
`console.log`, loading never turns off on error, fetching inside the render
body, `useEffect` with a missing dependency he then silences.
`amount: number` typed against a string API "because it should
be a number". Three booleans `loading`, `error`, `data`. Casting with `as`
and calling it validation.

### Questions

**"Your effect ran twice. Look at the network tab. Why? Is that a bug in your code or in React?"**
StrictMode mounts, unmounts and remounts in dev to surface missing cleanup.
The two requests are fine only if his cleanup aborts the first one or ignores
its result. If he says "I'll remove StrictMode", push back: what production bug
is StrictMode simulating here? (Fast navigation away and back, or a parent
re-keying the component.)

**"React 18+ no longer warns about setState on an unmounted component. So why bother aborting?"**
Two reasons that have nothing to do with the warning: wasted work and, more
importantly, ordering. If the effect re-runs (retry pressed twice, token
changes), the *older* response can arrive *last* and overwrite the newer one.
Abort or a "latest request wins" check fixes that. If he only says "memory
leak", he has memorised the answer, not understood it.

**"You catch the error and store it. What does `fetch` actually reject with, and what do you get when the server returns 500?"**
`fetch` rejects only on network failure, CORS failure, or abort. A 500 resolves
with `ok: false`. He must throw or branch on `res.ok` himself. Follow-up: what
is `err.name` when the request was aborted, and should that show an error
banner? (`AbortError`, and no.)

**"Some interviewers dislike `try/catch` around the whole `await` block. Steelman that."**
This is real feedback candidates have received, so get his honest take. The strong answer:
`try/catch` around the whole block catches *everything*, including a `TypeError`
from a typo in the success path, and reports it to the user as "network error".
Programming errors and expected failures get mixed. Alternatives: `.then` on the
success path with `.catch` only around the request, or a small `Result`-style
return (`{ ok: true, data } | { ok: false, error }`) from the API layer so the
component never sees an exception at all. Ask him to sketch the `Result` type.

**"You fetch user and transactions with `Promise.all`. The user call fails, the transactions call succeeds. What does the screen show and is that what you want?"**
`Promise.all` rejects on the first rejection and discards the other result. He
might want the transactions to render anyway with a fallback header, which
means separate state per request or `Promise.allSettled`. There is no single
right answer. There is a wrong one: not knowing that the successful result is
thrown away.

**"Inside your `.then` you call `setLoading(false)` and `setData(...)`. How many renders?"**
One. React 18 batches all updates in the same tick, including inside promises,
timeouts and native handlers. In React 17 that was two renders because batching
only worked inside React event handlers. Then ask: does it matter for
correctness here? (It can: with two renders there is a frame where
`loading === false` and `data === null`, and a naive `data.length` crashes.)

**"The token is hardcoded in the bundle. Where does it live in the real app, and why is `localStorage` the wrong answer for a bank?"**
Any script that runs on the page can read `localStorage`, so one XSS leaks the
session. `httpOnly`, `Secure`, `SameSite` cookie, or an in-memory access token
with a refresh cookie. Bonus: what is the trade-off of in-memory? (Lost on
reload, needs a silent refresh.)

#### Once the types are in

**"`const data = (await res.json()) as Transaction[]`. What did that `as` check at runtime?"**
Nothing. `res.json()` returns `any`, the cast is a promise to the compiler, not
a check. Ask what would happen if `amount` arrived as a number tomorrow: nothing
until `amount.startsWith` blows up somewhere unrelated. Ask him to write a
type guard for one field, or name a library he would use (zod, valibot) and say
where in the layers it would sit.

**"You typed `amount` as a string because the API sends a string. Where in your code does it become a number, and how many places call `Number()` on it?"**
One place, at the boundary, is the answer. If `parseFloat` is sprinkled across
components, that is a maintainability point for the feedback.

**"`Number('12.50abc')` vs `parseFloat('12.50abc')`. Which one do you want at an API boundary and why?"**
`Number` gives `NaN`, `parseFloat` gives `12.5`. At a boundary you want the
strict one so garbage fails loudly instead of becoming a plausible number.

**"Next week the API adds `state: 'REVERTED'`. Where does your code break, and how could TypeScript have told you before the user did?"**
Exhaustive `switch` with a `never` check in the default branch, or a
`Record<State, ...>` lookup that fails to compile when a member is missing.
If he renders a `switch` without default handling, the new state renders
nothing silently. That is the worst outcome for a bank.

**"Why is `id` a string in a banking API when it looks like it could be a number?"**
`JSON.parse` turns numbers into doubles. Anything above 2^53 loses precision.
IDs, account numbers and amounts are strings in serious financial APIs for
this reason. Follow up: is that also why `amount` is a string? (Yes.)

---

## Task 2: Format, total and group by day (13 min)

**Say:** "Format amounts as currency according to their own currency, and format
the date in a human-readable way. Then group the list by calendar day, newest
day first, with a per-day spend total. Keep the API order inside each day.
Only completed outgoing transactions count as spend."

**Expect to see**

- `Intl.NumberFormat` with `style: 'currency'`, created once per currency, not
  once per row per render.
- `Intl.DateTimeFormat` or `toLocaleDateString`, not manual string slicing.
- Filtering out `DECLINED` and positive amounts before summing.
- He notices that totals across four currencies cannot be a single number.
  He should ask you what to do. Tell him: "one total per currency".
- He notices `-0.00` on the "Card verification" row renders as `-£0.00`.
- A pure function `groupByDay(transactions): DayGroup[]` outside the component.
- `useMemo` around the call, with the right dependency.
- Output as an array of groups, or a `Map`, not a plain object keyed by date.

**Red flags:** `amount + ' ' + currency`. Summing with `parseFloat` and
displaying `0.30000000000000004`. Not asking about mixed currencies.
Grouping inline in JSX. `transactions.sort(...)` mutating state.
`Object.keys(groups)` and assuming insertion order.

### Questions

**"Add up the three 'Fee' rows. What does your code get?"**
`-0.1 + -0.1 + -0.1` is `-0.30000000000000004`. Ask how banks store money.
Integer minor units (pence, cents) is the standard answer. Then ask: JPY has no
minor units and some currencies have three. Where does that knowledge live?
(A per-currency exponent table, or `Intl.NumberFormat(...).resolvedOptions()`.)

**"`(1.005).toFixed(2)`?"**
`"1.00"`, not `"1.01"`, because 1.005 is really 1.00499999... in binary. This is
why you do not round with `toFixed` for money.

**"Why does 'Card verification' show `-£0.00`?"**
`Number('-0.00')` is `-0`. `Intl` formats negative zero with a sign. Fix by
normalising at the boundary (`amount === 0 ? 0 : amount`, or `signDisplay`
options). Bonus: `Object.is(-0, 0)` is `false`, `-0 === 0` is `true`.

**"There are two Uber rows at £6.40. Which day does each fall on? Whose timezone is that?"**
One is 23:59:30 yesterday, one is 00:00:45 today, in the *machine's* local
time. The IBAN says the account is Lithuanian, the merchant might be in London,
the server stores UTC. He should say the grouping depends on which timezone
you pick and that the choice belongs in one place. If he says "just use UTC",
ask how the user feels seeing a purchase at 22:00 filed under the wrong day.

**"You create `new Intl.NumberFormat(...)` inside the row component. How expensive is that?"**
Surprisingly expensive; it loads locale data. With 69 rows re-rendered on every
keystroke that adds up. Hoist to module scope, cache per currency in a `Map`, or
`useMemo`. Then: "how would you find out whether it actually matters here,
rather than guessing?" (React Profiler, Performance tab.)

#### Once the grouping is in

**"You grouped into an object keyed by day. If your key is the epoch day number instead of `'2026-09-05'`, what order does `Object.keys` give you?"**
Integer-like string keys are enumerated in ascending numeric order *before*
other keys, regardless of insertion order. Date-string keys keep insertion
order. This is a real bug people ship. `Map` preserves insertion order for all
keys, which is one reason to prefer it.

**"You called `.sort()` on the array you got from state. What did you just do to React's previous render?"**
Mutated the array that the previous render's props point to. React compares
by reference, so the sort does not trigger a re-render on its own, and any
`useMemo` depending on `transactions` will not recompute. Use `toSorted()`
(ES2023) or copy first.

**"Is `Array.prototype.sort` stable? If two transactions share a `createdDate`, do you rely on that?"**
Stable since ES2019. The two TfL rows are 20 seconds apart, so not equal, but
ask how he would break a tie deterministically anyway (by `id`).

**"Your `useMemo` depends on `transactions`. You press retry, the API returns the same 69 rows. Does the memo recompute?"**
Yes. New array reference, even if the contents are identical. Ask when that
matters and what the fix would be if it did (structural sharing, a stable
cache keyed by response, or simply not caring because grouping 69 items is
microseconds).

**"You said `useMemo` is for performance. What is the other reason you might need it here?"**
Referential stability. If the grouped array is passed to a memoised child or
used in another hook's dependency list, a new array every render defeats both.

**"Does `useMemo` guarantee it will not recompute?"**
No. React documents it as a hint and may discard memoised values. Code must be
correct without it.

---

## Task 3: Search and filter, then the requirements change (14 min)

**Say:** "Add a text box that filters by description, case-insensitive, and a
dropdown for state. Debounce the text box. Filters should compose with the
grouping and totals."

**Expect to see**

- Controlled input with raw text in state, and a *separate* debounced value
  used for filtering. The input itself must not lag.
- Filtering derived during render or in `useMemo`, not copied into another
  `useState` via `useEffect`.
- Search matches `TESCO` and `Tesco`.
- He notices totals now reflect the filter and asks whether that is intended.

**Red flags:** Debouncing the value the input displays. A `useEffect` that
sets `filtered` state. `setTimeout` in the component body with no cleanup.

### Questions

**"You stored the filtered list in state and update it in an effect. Walk me through how many renders one keystroke causes and what the user sees between them."**
Render with new query and stale filtered list, commit, effect runs, setState,
second render with correct list. One frame of inconsistent UI and double the
work. Derived data should be computed, not stored. This is the single most
common mid-level mistake and interviewers ask about it.

**"Your debounce hook holds the timer in a `useRef`. Why not a `let` in the component body or a `useState`?"**
A `let` is recreated on every render so `clearTimeout` never clears the right
one. `useState` would trigger a render every time the timer id changes. `useRef`
is the mutable box that survives renders without causing them.

**"Your debounced callback reads `transactions`. It fires 300ms later. Which `transactions` does it see?"**
The one captured when the callback was created, from that render's closure.
If a retry landed in between, it is stale. He should either derive from
state in render instead of inside the callback, or use a functional update.
This is the stale closure question, but asked about his own code.

**"Filter then group, or group then filter? Does it change the daily total?"**
It changes what the total *means*. Filter first and the day total is "spend
matching your search". Group first and filter inside groups and you can show
"3 of 12 transactions, day total £84". Neither is wrong. Not noticing that
the product question exists is.

**"Could `useDeferredValue` replace your debounce?"**
Partly. `useDeferredValue` lets React render the input immediately and the
expensive filtered list at lower priority, and it interrupts that render if
another keystroke arrives. It does not delay a *network* request, so for
server-side search you still need debounce or abort. Strong candidates know
these solve different problems. Bonus: what does React 18 do with the
in-progress render when a new keystroke arrives? (Throws it away and starts
over, without committing.)

**"Now imagine the filter is server-side. Type `a`, then quickly delete it. Two requests. The empty one resolves first. What is on screen?"**
The results for `a`, because that response arrived last. Fix: abort the
previous request, or track a request counter and ignore responses that are not
the latest. Ask which he prefers and why (abort also saves bandwidth, counter
works with any promise).

### Midway: the requirements change

About six minutes in, once search and filter work, interrupt him.

**Say it like a product manager:** "Change of plan. The list is going to have
thousands of rows, so the backend team made it paginated. Pass `?limit=20` and
you get `{ items, nextCursor }`. Add a Load more button. Everything you built
should keep working."

This is deliberate. Candidates report interviewers changing requirements mid-task.
Watch how he reacts: does he complain, does he ask clarifying questions, does
he read the README for the new shape?

**Expect to see**

- Types updated for the page shape. TypeScript should immediately show him
  every place that assumed an array.
- Appending with a functional update: `setItems(prev => [...prev, ...page.items])`.
- Button disabled while loading; `nextCursor === null` hides it.
- He realises the daily totals are now wrong for the last day on screen, and
  says so.

### Questions after the change

**"TypeScript broke in three places when the shape changed. Where would TypeScript *not* have caught this?"**
At runtime. If he had not updated the type and the API had just started
returning an object, TS would be happy and `data.map` would throw. Types
describe intent, not reality. This loops back to validation at the boundary.

**"You wrote `setItems([...items, ...page.items])`. When does that lose data?"**
When two Load more responses land before a re-render, or when the click handler
captured an older `items`. The functional form reads the latest state. Ask him
to describe a concrete sequence of events where the non-functional version
drops a page.

**"Click Load more twice, quickly. Two requests with the same cursor. What ends up in the list?"**
Duplicates. Fixes: disable the button while in flight, guard with a ref, or
dedupe by `id` when merging. Ask which he would do and whether the dedupe is a
fix or a bandage.

**"A new transaction arrives on the server between page 1 and page 2. With offset pagination, what do you see? With this cursor design?"**
Offset: the last item of page 1 appears again as the first item of page 2,
because everything shifted by one. Cursor by id: no duplicate, because
"everything after tx-0017" is unaffected by inserts at the top. Ask when
cursor pagination is worse (jump to page 7, sorting by a mutable column).

**"Your daily total for the earliest day on screen: is it right?"**
No. The day may continue on the next page. Either the UI says "so far", the
server provides totals, or you fetch by day. He should notice the problem; the
fix is a product decision.

---

## Task 4: Tests (10 min)

**Say:** "Write two tests. One for your grouping function. One for the component:
mock the network, check loading appears, then rows appear, then that a failure
shows the error and retry works."

**Expect to see**

- Pure function test with hand-built fixtures, including a day-boundary pair
  and a `DECLINED` row.
- `vi.spyOn(globalThis, 'fetch')` or `vi.stubGlobal`, returning a
  `Response`-like object with `ok`, `json`.
- `screen.getByText(/loading/i)` immediately, then `await screen.findByText(...)`.
- Queries by role and text, not by class or test id.

**Red flags:** Testing implementation details (`expect(setState)...`). Snapshot
of the whole tree. `await new Promise(r => setTimeout(r, 1000))` in a test.

### Questions

**"Name five edge cases for `groupByDay` without looking at the data."**
Empty input, single item, two items straddling midnight, unsorted input,
declined items excluded from totals but present in the list, `-0`, mixed
currency, identical timestamps. Four or more is good.

**"Your mock returns `amount: '12.50'`. Next week the backend sends a number and production breaks. Your test still passes. What did the test prove?"**
It proved the component works *with the shape you assumed*. Mocks encode
assumptions. Mitigations: type the mock with the same `Transaction` type so at
least the two drift together, a contract test against the real API, or
runtime validation that fails the test when the fixture is wrong.

**"`getByText`, `queryByText`, `findByText`. Which one throws, which one returns null, which one is async, and why did you need the async one after the fetch?"**
`getBy` throws if missing, `queryBy` returns null, `findBy` polls with
`waitFor` up to 1000ms. After a mocked fetch the state update happens in a
microtask after the `await`, so the row is not in the DOM on the same tick.

**"You want to test the debounce. You reach for `vi.useFakeTimers()`. What breaks?"**
`findBy*` and `waitFor` use real `setTimeout` internally to poll, so with fake
timers they hang unless you pass `advanceTimers: vi.advanceTimersByTime` in
the config or advance manually. Also `userEvent.setup({ advanceTimers })`.
Very few mid-level candidates know this; a strong one has hit it.

**"Your loading assertion passed once and failed once. What could cause that?"**
If he awaited anything before asserting loading, the mock may have already
resolved (a `mockResolvedValue` resolves in a microtask). Assert loading
synchronously right after `render`. Ask what `act()` is actually doing here.

**"What in this app would you deliberately *not* unit test?"**
Intl output (locale dependent, tested by the browser vendor), styling, the
exact debounce interval. Integration or e2e for the real API. Saying "test
everything" is a red flag.

---

## Internals question bank

Ask two or three of these at the end, or whenever he is waiting on a slow
request. Each is tied to something in the code.

**"Between your `setState` inside `.then` and the pixels changing, what happens? Name the phases and say where `useEffect` runs."**
Update scheduled on the fiber, lane assigned. Render phase: React calls the
component, reconciles the new element tree against the current fiber tree,
marks effects. This phase is interruptible in concurrent mode and can run
twice in StrictMode. Commit phase: DOM mutations, then `useLayoutEffect`
synchronously, then browser paints, then `useEffect` runs as a passive effect
after paint. Bonus: which phase must be pure and why? (Render, because it can
be discarded or repeated.)

**"Put your `useMemo` inside `if (state.status === 'success')`. What breaks, and *why* does React care?"**
Hooks are stored as a linked list on the fiber in call order. React has no
names for them, only positions. A conditional hook shifts every hook after it
onto the wrong slot. Asking "why" separates memorised rules from understanding.

**"You wrapped `TransactionRow` in `React.memo` and pass `onSelect={() => ...}`. Faster?"**
No. `memo` does a shallow compare of props and a new arrow function every
render fails it. `useCallback` fixes the function, but then: are the `tx`
objects stable across renders? If `groupByDay` creates new row objects,
`memo` fails again. This chain shows whether he understands referential
equality end to end rather than knowing "memo makes it faster".

**"You switch from the flat list to the grouped list and back. Same keys. Does React reuse the DOM nodes?"**
No. Keys are compared among siblings under the same parent. Moving an element
to a different parent (a day group) unmounts and remounts it. State in
`TransactionRow` is lost. Ask how he would keep row-level state across that
change (lift it up, key by id in a map).

**"Why does React need keys at all if it already has the fiber tree?"**
Without keys React matches children by index. Insert one at the top and every
row's props change, every row's state stays with the wrong data. Keys tell
React which fiber is which across renders. Follow up: why is `Math.random()`
as a key the worst option? (New key every render, full remount every time.)

**"Your `onChange` receives `e`. Is that the native event? Where is the actual listener attached?"**
Synthetic event wrapping the native one, normalised across browsers. Since
React 17 listeners attach to the root container, not `document`. Bonus: why did
that change matter? (Multiple React versions on one page, `e.stopPropagation()`
interop with non-React code.)

**"`fetch().then(setState)` is a microtask. `setTimeout(() => setState(), 0)` is a macrotask. Both are queued by the same click. What order do they run in, and are they batched together?"**
All microtasks drain before the next macrotask, so the fetch callback, if
already resolved, runs first. React 18 batches within each callback but not
across the microtask and the timeout, so two renders. This is the event loop
question, asked in a way that cannot be answered from a blog post.

**"Your component logged twice in dev. Is your render pure? What would make it impure?"**
StrictMode double-invokes render to catch impurity. Impure examples: mutating
a prop, `Date.now()` or `Math.random()` in render, pushing to an outer array,
calling `.sort()` on a prop. Pure means same inputs, same output, no side
effects. Ask why React insists on this (concurrent rendering can discard or
replay a render).

**"Does `useState`'s setter cause a re-render if you set the same value?"**
No, `Object.is` bail-out. Caveat: React may still render the component once
more before bailing out in some cases. Then: `setItems([...items])` with
identical contents, re-render or not? (Yes, new reference.)

**"Explain what `await` does to the rest of your function, in event loop terms."**
Everything after `await` is wrapped in a continuation and queued as a
microtask when the promise settles. The synchronous part before the first
`await` runs immediately. Ask: does `await` on a non-promise value still yield?
(Yes, still a microtask tick.)

**"`structuredClone(transactions)` vs `[...transactions]` vs `JSON.parse(JSON.stringify(...))`. Which do you want when copying before sort, and what does each cost?"**
Spread is a shallow copy and enough for sort. `structuredClone` is deep and
handles `Date`, `Map`. JSON round trip drops `undefined`, `Date` becomes
string, and dies on cycles. Copying more than you need is a code smell.

---

## Networking questions

Drop one or two in while a request is in flight.

**"Remove the Vite proxy and call `http://localhost:3001/api/user` directly. What happens and why?"**
CORS preflight, because `x-access-token` is a non-simple header. The browser
sends `OPTIONS` first. The mock has no CORS headers, so the real request never
goes. Ask what the server must return (`Access-Control-Allow-Origin`,
`Access-Control-Allow-Headers`). Then: why does `Content-Type: application/json`
alone trigger a preflight? (Only three content types are "simple".)

**"The API returns 401 while he is on the page because the token expired. Where in your code does that get handled once for the whole app, not per component?"**
A single fetch wrapper or interceptor that maps 401 to "log out" or "refresh
and retry". If every component handles it, one will forget.

**"Two tabs open, both refresh the token at the same moment. What goes wrong?"**
Refresh token rotation: the second refresh uses an already-consumed token and
gets rejected, logging out that tab. Mitigations: `BroadcastChannel` or
`localStorage` event to share the new token, or a lock. This is beyond
mid-level; a good answer is a bonus, not a requirement.

**"The user clicks Retry five times in a second. What reaches the server, and what should?"**
Five requests unless you disable or abort. Then: for a `POST /transfer`, what
stops the bank moving money five times? Idempotency key header, and the server
deduplicating on it. Banks care about this one.

**"The browser gets the same `GET /api/transactions` twice in ten seconds. What does HTTP caching do without any headers? With `Cache-Control: max-age=60`? With `ETag`?"**
No headers: heuristic caching, usually none for API responses. `max-age`: served
from cache with no request. `ETag`: conditional request, `304` if unchanged,
still a round trip but no body. Then: how does React Query's `staleTime`
relate to this? (Separate layer, in memory, does not know about HTTP cache.)

---

## Scoring

Rate each 1 to 4. Mid-level pass is mostly 3s, no 1s.

| Area | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Problem solving | Stuck without hints | Needs hints, follows them | Solves independently, asks good clarifying questions | Anticipates the next requirement |
| JavaScript | Confused by async, closures | Knows the rules, cannot explain why | Explains event loop and closures against own code | Predicts behaviour of unfamiliar combinations |
| React | Effects for derived state, index keys | Correct patterns, vague on internals | Explains render/commit, batching, referential equality | Reasons about concurrent rendering and fibers |
| TypeScript | `any`, casts as validation | Types the shapes | Discriminated unions, boundary conversion | Exhaustiveness, runtime validation, types that prevent bugs |
| Data processing | Mutation, float sums | Correct with hints | Pure functions, money as integers, order guarantees | Timezone and multi-currency handled without being told |
| Networking | Does not check `ok` | Handles happy path and error | Abort, retry, race conditions | Caching, idempotency, auth flow |
| Testing | No tests or snapshot only | One happy path test | Pure unit plus RTL with async queries | Knows mock limitations and fake timer pitfalls |
| Communication | Silent | Narrates after the fact | Explains intent before typing, flags trade-offs | Pushes back on requirements with reasons |

## Feedback to give him afterwards

Be concrete. "You handled the error state without being told" beats "good
job". Pick the two lowest scores and give him the exact question he missed and
the answer, so he can go and read about it. Remind him that in the real thing
the interviewer will type in the same editor and may edit his code to break it.
