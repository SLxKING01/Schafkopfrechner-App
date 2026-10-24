# Mobile usability repairs — 2026-10-24

Base: `master` at `ef4596a49316dbe4f69037d29192e75542d2ca58`. The original AUDIT.md was not present in the repository; scope follows the five findings supplied in the conversation.

## Changes

- Referenced offline players cannot be deleted. Their names remain available to balances, statistics and history. Unused players can still be deleted. Previously missing participant IDs remain in balance calculations, so their debts/credits no longer silently disappear; their original names cannot be recovered automatically.
- Replacing/resetting a modern table archives its players, rounds, balances and payment status in persisted local state. Archive access is available from dashboard and settlement. Archived payments can be marked paid without modifying the current table. Archived tables retain their original rounds and settlement information; creating a new table does not reopen the old one.
- Offline overview and closing screen use a single vertical scroll container instead of several competing nested lists. All sections and actions can participate in the scroll flow.
- Dashboard and statistics use locally stored table/round data, with honest empty states. No fabricated personal win rates, amounts, participants, recent games or payments remain in these screens. Personal attribution is intentionally absent until a profile is linked to a player.
- New Sauspiel/Rufspiel entries require two winners and two losers. Both input screens support a second winner. `amount` remains the total transferred by the losing party; it is split between winners and losers in cents. Older single-winner entries keep their original meaning; no partner is guessed retrospectively. History and offline player statistics support both winners. Existing modern loser rounding order remains stable.
- Round validation rejects unknown and duplicate participant IDs. Payments on a still-active table cannot be marked paid. The native SecureStore key no longer contains an unsupported colon. TypeScript excludes generated `dist` output, which otherwise caused a compiler stack overflow after exporting the web build.

## Verification

- Jest: 32 tests passed across 9 suites, including player deletion/reload, missing historical participants, both winning parties, offline edits, invalid participants, archive replacement/reset/rehydration and archived payment isolation.
- TypeScript: `npx tsc --noEmit` passed.
- Lint: `npm run lint` passed.
- Web compilation: `npx expo export --platform web` passed.
- No database migration, production data mutation, merge or deployment performed.

## Pending visual/device acceptance

No browser or real-device success is claimed. Local Playwright could not launch because Chromium was absent; downloading Chromium failed with an invalid/truncated archive.

1. At widths 360, 390 and 430, including 390 × 568, scroll the offline overview from top to bottom. Reach undo, edit, delete and close actions with populated balances, payouts and games. Repeat closing screen with many players.
2. Try deleting winner and loser of an offline game: deletion is unavailable, names and payouts remain correct after reload. An unused player remains deletable.
3. Enter a Sauspiel in each UI: A/B win, C/D lose, total €10 → +€5/+€5/−€5/−€5. Reverse parties and inspect history, statistics and settlement. One-winner Rufspiel must not save. Old entries must keep their recorded amounts.
4. Finish a modern table with an unpaid settlement, start another, reload, then open archive from dashboard. Confirm old names/rounds/amounts/payment status. Mark an archived payment paid; confirm new-table balances/payment status do not change.
5. Inspect dashboard/statistics with empty and populated local data. No sample numbers or invented personal attribution. Dashboard settlement action opens the actual settlement screen. A running table cannot have payments marked paid.
6. On iOS/Android, test persistence, background/foreground, keyboard opening/closing and reachability of the round save action. Browser emulation does not establish native keyboard correctness.

Archives are stored locally on the device, using the existing persistence approach. This change does not implement cross-device/cloud archive synchronization; the repository's existing sync services remain stubs.
