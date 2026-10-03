# Play: the machines, the games and the verse

What was added to the website so that ideas can be handled, not only read. Everything here follows the site's data-honesty rule: **nothing fabricated is presented as real**. Every chart in these pages is generated and says so; every figure is either arithmetic the visitor can check or a plainly labelled example; nothing predicts a market.

## Where things are

| Page | What it holds | Code |
|---|---|---|
| `/labs/workshop` | Candle forge, leverage tightrope, guess the candle, pip reels, sixty seconds | `src/components/labs/workshop/` |
| `/labs/engine-room` | Margin-call countdown, swap clock, slippage in slow motion, compounding staircase, correlation dance, marbles | `src/components/labs/engine/Machines.tsx` |
| `/labs/forces` | Tug of war, lever room, shockwave, liquidity tide | `src/components/labs/forces/Models.tsx` |
| `/labs/scale` | The Long Scroll: a tick to a decade | `src/components/labs/scale/` |
| `/labs/cinema` | The floor at night, order in flight, spread canyon, storm chart, gravity wells, the city in time-lapse | `src/components/labs/cinema/Pieces.tsx` |
| `/labs/mind` | Spot the coin flips, the patience game, the bias detector, the headline game | `src/components/labs/mind/Games.tsx` |
| `/academy/practice` | Build the order, fix the trade, flashcard duel, mistake museum, certificate | `src/components/academy/practice/` |
| `/verse` | Weekly riddle, alphabet, finish the rhyme, proverb wall, riddle hunt | `src/components/verse/Verse.tsx` |
| Home | Daily riddle, weekly verse, the chart the sequence resolves into | `src/components/play/`, `src/components/home/SequenceChart.tsx` |
| My desk | Passport, constellation | `src/components/play/` |

A page that is a row of machines is built with `MachinePage` (`src/components/labs/MachinePage.tsx`): it takes the words and the machines and supplies the rest.

## How a machine is made

A machine is a client component: a `Figure` canvas (`src/components/figures/Figure.tsx`), ordinary controls beneath it (buttons, a range input) and one sentence in an `aria-live` paragraph that says what the canvas is showing. The canvas is decoration for assistive technology; the sentence carries the meaning.

- `Stage`, `Slider` and `Note` are in `src/components/labs/kit.tsx`.
- The canvas redraws every frame while on screen. Under reduced motion or low visual effects it draws one still frame, so a machine passes `rev` (a number that changes with its controls) to have that frame drawn again.
- On a phone a canvas is never shallower than about 4:3 (the kit does this).
- `Figure` ignores touch on purpose, so a finger scrolls the page. A machine that must be dragged (the order builder) lays its own element over the canvas and also offers sliders that do the same thing.
- Seeded randomness comes from `src/components/labs/workshop/rng.ts`. A new seed per round is drawn in the browser on a click, never during rendering.
- The timetable (which FX windows and which exchanges are open at an hour) is `src/components/labs/timetable.ts`, read from `src/lib/sessions.ts`: the same table the clocks use.

## Words

| What | Where |
|---|---|
| A line to remember per section | `src/data/punchlines.ts`, shown by `src/components/ui/PunchLine.tsx` |
| A couplet per glossary term | `src/data/glossary-couplets.ts` |
| A couplet per tool | `src/data/tool-rhymes.ts` |
| A limerick per lesson | `src/data/limericks.ts` |
| The daily riddles | `src/data/riddles.ts` |

The rule for all of them: a line may describe what a word means or urge care, cost-awareness and method. It may not promise a result, play down risk or tell anyone to trade.

## What is stored

One browser-storage key, `gx:play` (`src/components/play/store.ts`), listed in `LOCAL_KEYS`, described in the privacy controls and in the Cookie & Storage Notice, and removed by the privacy reset:

- `r` the daily riddle's run of days
- `b` the best score in Sixty seconds
- `h` which hidden riddles have been solved
- `s` the passport's stamps, present only once the visitor has started it
- `v` the newest "recently added" ribbon the visitor has dismissed (`src/data/releases.ts`)

Each is written only by something the visitor does. Nothing else added here stores anything: tallies, names typed on a certificate and the ambient sound last only as long as the page.

## Sound

The machines use the site's existing sound signals (`src/components/sound/signal.ts`), which are silent unless sound is switched on at `/preferences`. The ambient drone (`src/components/fx/Extras.tsx`) is separate, off by default and lasts for one visit.

## Polish, and the later additions

| What | Where |
|---|---|
| The one card every figure and machine is drawn in (`.gx-stage`), its pointer light, the grain, dividers that draw themselves, display numerals, drop caps, waiting states | `src/styles/fx.css` (section POLISH) |
| Pointer light, keyboard shortcuts on `[data-machine]`, the part of the day on `<html data-daypart>` | `src/components/fx/Polish.tsx` |
| A cover drawn from a slug, for posts and lessons without a picture | `src/components/ui/GeneratedCover.tsx` |
| Liquid chart, candle garden, paper trail, build a candle, draw a chart, risk dial | `src/components/labs/more/More.tsx` |
| First-trade course, scroll-told leverage story, term of the day, footer motto, "recently added" ribbon | `src/components/play/Guided.tsx` |
| Cheat sheets to print | `src/app/(site)/academy/cheat-sheets/page.tsx` |
| The glossary as a star map | `src/components/glossary/StarMap.tsx` |
| Account cards | `src/components/trading/AccountCards.tsx` |
| Sonnet of the month, readers' riddles and their form | `src/components/verse/Readers.tsx` |

Readers' riddles are the only part of this that leaves the browser. A riddle is posted to `/api/riddle`, stored as `pending` in `reader_riddles` (migration `0029`), and is shown on `/verse` only after someone with `content.publish` approves it at `/control/content/riddles`. The database forces `pending` on insert whatever the request says. The `/verse` page re-reads approved riddles every five minutes.

The leverage story's six drawings are `src/components/play/LeverageScenes.ts`, one function for each step; `/academy/leverage-story?step=4` opens the story at a step. The hero scenes of these pages are in `src/components/cockpit/scenes/` (`firsttrade`, `dojo`, `lever`, `blueprint`, `starmap`, `quill`), chosen by path in `src/components/cockpit/routes.ts`.

## Fun@Finance

`/fun` is jokes, comic strips, cartoons, limericks, riddles, a mock dictionary, an excuse machine and a bingo card. All of the material is in `src/data/fun.ts`, written for the page; the rule it keeps is at the top of that file (laugh at habits and jargon; never promise a result, make light of real loss, give advice, or name a real person or firm). The cast of the comics (the Bull, the Bear and Wick) is drawn in SVG by `src/components/fun/Toons.tsx`: a new strip is three panels of data, with no drawing to do. The moving parts are `src/components/fun/Fun.tsx`. Nothing on the page is stored.
