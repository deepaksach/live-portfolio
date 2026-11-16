# Live Portfolio (React Native take-home)

A small stock portfolio app that stays correct and smooth while prices tick ~20 times a second.

**Tested on:** Android emulator (Pixel, API 35) · React Native 0.88.1 (bare CLI, New Architecture) · TypeScript strict.

## Install and run

Requirements: Node ≥ 22.13, JDK and Android SDK per the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment), an emulator or device.

```bash
npm install
npm start            # Metro
npm run android      # in a second terminal
```

Checks:

```bash
npm test             # unit tests (domain, data, feed, state)
npm run typecheck    # tsc --noEmit, strict + noUncheckedIndexedAccess
npm run lint         # ESLint, `any` is an error
```

## Structure

```
src/
  domain/   Pure functions: paise money, INR formatting, P&L, averages, order validation, tick merge  (+ tests)
  data/     OHLC API client (defensive parsing), seed holdings CSV, symbol list                    (+ tests)
  feed/     PriceFeed interface + SimulatedFeed (connect / disconnect / onTick)                    (+ tests)
  state/    PriceStore (hot, live quotes), portfolioStore (cold, persisted), market service, hooks (+ tests)
  ui/       Theme (light/dark), rows, summary card, tick chart, shared loading/empty/error/paused states
  screens/  Portfolio, Watchlist, Add symbol, Stock detail, Buy/Sell sheet
  app/      services.ts: the single place the app is wired together
```

Data flow: `OHLC API ──snapshot──▶ PriceStore ◀──ticks── PriceFeed`, then `PriceStore + portfolioStore ──▶ domain functions ──▶ UI`.

## State and re-render approach

The key decision is to split state by how often it changes.

**Hot state (prices) – `state/priceStore.ts`, a small custom store outside React.**
- One `Map<symbol, Quote>` and one listener set **per symbol**. A tick for TCS only notifies components showing TCS: O(1) work per tick, independent of list size.
- Components read it with `useSyncExternalStore` (`useQuote(symbol)`), which is tear-free under concurrent rendering.
- Notifications are **batched to one flush per animation frame**, so several ticks within a frame cause one React commit.
- Unchanged symbols keep the same `Quote` object, so React bails out for them.
- Late / out-of-order ticks are dropped by comparing `seq` with the last applied `seq` for that symbol (kept across REST refreshes).

**Cold state (holdings, watchlist, orders) – Zustand + `persist` (AsyncStorage).** It changes only on user actions; selectors keep subscribers narrow. A buy/sell updates holdings and the order history in a single `set()`, so Summary and rows can never disagree.

**How the list avoids re-rendering:**
- The list's `data` is an array of **symbol strings**, not quotes. Rows (`HoldingRow`, `React.memo`) receive only `symbol` + a stable `onPress` and subscribe to their own quote. A tick re-renders exactly one row; the list itself does not re-render.
- **Summary** depends on every price, so it reads a throttled version counter and recomputes at most **4×/s** (`useThrottledPriceVersion(250)`).
- **Sort by value/P&L** would reorder constantly under live prices, which costs renders and makes rows jump under the user's finger. The order is recomputed at most **once a second**, and the same array is returned if the order did not change, so FlashList is not touched.
- FlashList v2 recycles row views for the holdings list. The watchlist (≤ 25 rows, swipe actions) uses a plain FlatList so swipe state cannot leak into recycled rows.
- Verified with the React DevTools Profiler: on a tick, only the row(s) for the ticked symbol(s) commit; `PortfolioScreen` and the list do not.

**Why not Redux / all-Zustand / Context for prices?** Context re-renders every consumer on every change. A single Zustand/Redux store works with selectors, but every tick runs every row's selector (O(n) per tick, ~500 selector calls/s here). The per-symbol store does O(1) per tick and is ~120 lines that are easy to read.

**Feed status ("prices paused")** is derived from tick arrival time in the store (no accepted tick for 1.5 s), not from the simulator. It would work unchanged with a real socket.

**Swapping in a real socket:** implement `PriceFeed` (`connect`, `disconnect`, `onTick`) and change one line in `src/app/services.ts`. `onSnapshot` (re-basing the simulator on REST data) is simulator-only and would be dropped.

## Money and correctness

- All money is **integer paise**. Floats exist only at the edges (API JSON, tick wire format) and are converted once with `Math.round(x * 100)`. No float arithmetic on money anywhere else.
- Holdings store **total invested cost**, not average price. A buy adds exactly `qty × fill`; the average is derived (`invested / qty`, rounded to the paisa for display only). This avoids drift from repeatedly re-averaging.
- A sell keeps the average price and reduces invested cost proportionally, rounded to the paisa (`round(invested × remaining / qty)`). Selling everything removes the row.
- Simulated prices move on a 5-paise tick grid, like NSE.
- **Totals reconcile:** every row value is an exact integer, and Summary totals are sums of those same integers, so Summary ₹ values equal the sum of the rows as displayed, to the paisa. Percentages are recomputed from totals (summing row percentages would be wrong), so they are not the sum of row percentages.
- The average price shown is rounded to the paisa, so `qty × displayed average` can differ from the invested amount by less than `qty / 2` paise after a buy at a different price. P&L uses the exact invested amount.
- Orders fill at the last price **at the moment of confirming** (read from the store), not at the price rendered a frame earlier. Buying/selling is disabled when there is no price.

### Missing prices (OLDCO)

`null` means unknown everywhere and is never replaced by 0. Anything that depends on a missing price shows `--`.

**Summary choice:** all four Summary figures (current value, invested, total P&L, today's P&L) cover **priced holdings only**, and the card shows a visible line: *"1 holding not included, no price: OLDCO (₹12,375.00 invested)"*.

Why: if OLDCO's invested amount were included while its value is unknown, total P&L would show a ₹12,375 loss that has not happened. If it were counted at zero, that would be a faked price. Keeping all four numbers over the same set of holdings keeps them consistent with each other (value − invested = P&L), and the note makes the exclusion explicit rather than silent.

The same rule applies per field: a holding with a price but no previous close shows `--` for today's P&L and is left out of today's total only.

### Today's P&L

`qty × (ltp − prevClose)` per holding. Known simplification: shares bought today through the sheet are treated as if held since the previous close. Fixing it needs per-lot tracking (see "Next").

## Tick simulator

`src/feed/SimulatedFeed.ts`, behind the `PriceFeed` interface:
- ~20 ticks/s across all priced symbols; each tick moves one symbol by up to ±0.2 % and may change `high`, `low`, `volume`. Only changed fields are sent.
- `seq` increases per symbol. ~2 % of ticks are held back 0.3–1 s while a newer tick for that symbol (carrying all fields, so nothing is lost) goes first; the held one then arrives out of order and is ignored by the store.
- Roughly once a minute (45–75 s) the feed is silent for 5 s, which drives the "prices paused" banner.
- Symbols without a price from the API (OLDCO) are never simulated: the simulator does not invent prices.
- The feed is paused when the app goes to the background and resumed when it returns.

The API is called once at start and on pull-to-refresh, never polled. A failed refresh keeps the last prices and shows a banner; a failed first load shows an error with Retry.

## Tests

`npm test` covers: INR formatting (Indian grouping, negatives, `--`), paise conversion and rounding, row metrics, Summary reconciliation with an unpriced holding, average price after buys, sells, quantity validation, sorting with unpriced rows, tick merging and late-tick rejection, OHLC parsing (missing/zero fields), the seed CSV, simulator rate / partial ticks / late ticks / silence, price store per-symbol notification and batching, and holdings consistency after trades.

## Library choices

| Library | Why |
|---|---|
| React Navigation (native stack + bottom tabs) | Standard, typed routes; native transitions. |
| FlashList v2 | View recycling keeps the live list smooth while scrolling. |
| Zustand + persist | Minimal API for cold state with selectors and persistence. |
| AsyncStorage | Persists the watchlist, holdings and orders across restarts. |
| Gesture Handler + Reanimated | Swipe-to-remove on the watchlist runs on the UI thread. |
| react-native-svg | Tiny hand-built line chart: one path, no heavy chart dependency. |

## What I skipped / next with another day

- **Stretch goals:** price flash on the UI thread (Reanimated shared value per row), reconnect with backoff + catch-up REST fetch, limit orders, orders history screen (orders are already persisted), dev menu for tick rate / force disconnect (`SimulatedFeed.forceSilence` exists).
- Per-lot tracking for an exact intraday today's P&L.
- Component tests with React Native Testing Library (render counts per tick as a regression test for re-render isolation).
- A schema migration for persisted state beyond `version: 1`.

## Time spent

About _X_ hours.
