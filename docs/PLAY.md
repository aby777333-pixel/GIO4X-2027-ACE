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

Each is written only by something the visitor does. Nothing else added here stores anything: tallies, names typed on a certificate and the ambient sound last only as long as the page.

## Sound

The machines use the site's existing sound signals (`src/components/sound/signal.ts`), which are silent unless sound is switched on at `/preferences`. The ambient drone (`src/components/fx/Extras.tsx`) is separate, off by default and lasts for one visit.
