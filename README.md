# Live Portfolio

React Native take-home for Liquide: a stock portfolio that stays correct and smooth while prices tick ~20 times a second.

- React Native 0.88 (bare CLI, New Architecture), TypeScript strict
- **Tested on:** Android emulator
- Tools: I used an AI assistant along the way (scaffolding, test cases, README draft). The design decisions and trade-offs below are mine and I'm happy to walk through any of them.

## Run it

Needs Node ≥ 22.13 and the Android setup from the [React Native docs](https://reactnative.dev/docs/set-up-your-environment).

```bash
npm install
npm start          # Metro
npm run android    # second terminal, with an emulator running
```

```bash
npm test           # unit + rule tests
npm run typecheck  # strict, plus noUncheckedIndexedAccess
npm run lint       # `any` is an error
```

## How it's organised

```
src/
  domain/    pure functions: paise money, ₹ formatting, P&L, averages, order validation, tick merge
  data/      OHLC API client, bundled holdings CSV, the 25 symbols
  feed/      PriceFeed interface + SimulatedFeed (connect / disconnect / onTick)
  state/     PriceStore (live prices), portfolioStore (holdings, watchlist, orders), market service, hooks
  ui/        theme, rows, summary card, tick chart, loading / empty / error / paused states
  screens/   Portfolio, Watchlist, Add symbol, Stock detail, Buy/Sell sheet
  app/       services.ts – the one place everything is wired together
```

Flow: the OHLC API gives a snapshot → `PriceStore`; the feed pushes ticks → `PriceStore`; screens read `PriceStore` + `portfolioStore` and run the `domain/` functions.

## State and re-renders

I split state by how often it changes.

**Prices (hot) – `state/priceStore.ts`.** A small store outside React with a listener set per symbol. Components read it through `useSyncExternalStore` (`useQuote(symbol)`). A tick for TCS only wakes up components showing TCS, so the work per tick doesn't grow with the list. Notifications are flushed once per animation frame, so several ticks in one frame give one commit. Late ticks are dropped by comparing `seq` per symbol.

**Holdings / watchlist / orders (cold) – Zustand with `persist` on AsyncStorage.** These only change on user actions. A trade updates holdings and order history in one `set()`, so Summary and rows can't disagree.

What that means on screen:
- The holdings list (FlashList) gets **symbol strings** as data. Each `HoldingRow` is memoised, gets only `symbol` and a stable callback, and subscribes to its own quote. A tick re-renders one row; the screen and list don't re-render.
- **Summary** needs every price, so it recomputes at most 4×/s instead of on every tick.
- **Sorting by value or P&L** is recomputed at most once a second, and keeps the same array when the order didn't change. Re-sorting on every tick would re-render the list constantly and make rows jump while you scroll.
- The "prices paused" banner is driven by tick arrival time (no tick for 1.5 s), not by the simulator, so it works the same with a real socket.

Why not Context or one big Redux/Zustand store for prices: Context re-renders every consumer; a single store with selectors works but runs every row's selector on every tick. Per-symbol subscriptions do constant work per tick.

To check in the React DevTools Profiler: press `j` in Metro → Profiler → record a few seconds on Portfolio. Commits should show only `HoldingRowView` for the ticked symbols, plus `SummaryCardView` about 4 times a second.

**Swapping in a real socket:** write a class implementing `PriceFeed` and change one line in `src/app/services.ts`. `onSnapshot` (re-basing the simulator on fresh REST prices) is simulator-only.

## Money

- All money is **integer paise**. Floats appear only at the edges (API JSON, tick payloads) and are converted once.
- A holding stores **total invested**, not the average price. A buy adds exactly `qty × fill price`; the average is derived and only rounded for display. A sell keeps the average and reduces invested proportionally, rounded to the paisa.
- **Totals reconcile:** row values are exact integers and Summary adds up those same integers, so Summary ₹ figures equal the sum of the rows as displayed. Percentages are recomputed from the totals, so they are *not* the sum of row percentages.
- The displayed average is rounded to the paisa, so after a buy at a different price, `qty × shown average` can be off from invested by under `qty/2` paise. P&L always uses the exact invested amount.
- Orders fill at the last price at the moment you confirm. Buy/Sell is disabled when there's no price.

### Holdings with no price (OLDCO)

Unknown values are `null` end to end and shown as `--`; they're never turned into 0.

**Summary shows totals for priced holdings only, plus a visible note:** *"1 holding not included, no price: OLDCO (₹12,375.00 invested)"*.

Reasoning: including OLDCO's invested amount without a value would show a ₹12,375 loss that hasn't happened; counting it at 0 would be a fake price. Keeping value, invested and P&L over the same set keeps them consistent (value − invested = P&L), and the note makes the exclusion obvious instead of silent. The same rule applies per field: no previous close → today's P&L for that row is `--` and it's left out of today's total.

Today's P&L is `qty × (ltp − prevClose)`. Shares bought in-app today are treated as held since the previous close; fixing that needs per-lot tracking.

## Tick simulator

`src/feed/SimulatedFeed.ts`, behind the `PriceFeed` interface:
- ~20 ticks/s; each moves one symbol by up to ±0.2 % on a 5-paise grid and may change high, low and volume. Only changed fields are sent.
- `seq` increases per symbol. ~2 % of ticks are held back and a newer tick for that symbol (carrying all fields) goes first, so the late one really arrives out of order and gets ignored.
- About once a minute it goes quiet for 5 s.
- Symbols the API didn't price (OLDCO) are never simulated.
- Paused when the app goes to the background.

The API is called once on start and on pull-to-refresh, never polled. It returns 201, the list is at `message.data`, and unknown symbols are just missing. A failed refresh keeps the last prices and shows a banner; a failed first load shows an error with Retry.

## Tests

`npm test` – 82 tests. `src/__tests__/brief.test.ts` runs the real simulator and store together for two simulated minutes and checks the rules from the brief: tick rate, partial ticks, late ticks ignored, the silence, OLDCO never priced or counted, and Summary matching the displayed rows after trades. The other suites cover formatting, paise maths, averages, validation, sorting, API parsing, the store and the simulator.

## Libraries

| | Why |
|---|---|
| React Navigation (native stack + tabs) | typed routes, native transitions |
| FlashList v2 | view recycling for the live holdings list |
| Zustand + persist, AsyncStorage | small API for the persisted state |
| Gesture Handler + Reanimated | swipe-to-remove on the watchlist |
| react-native-svg | the tick chart is one path; a chart library wasn't needed |

## Skipped / next

- Stretch goals not done: price flash, reconnect with backoff + catch-up fetch, limit orders, orders history screen (orders are already persisted), dev menu for the simulator.
- Per-lot tracking for an exact intraday today's P&L.
- Render-count tests with React Native Testing Library to lock in the re-render behaviour.
- Watchlist uses a plain FlatList with `removeClippedSubviews` off: with swipeable rows on Android New Architecture it hit a "child already has a parent" crash.

## Time spent

Roughly TIME_SPENT_HOURS hours.
