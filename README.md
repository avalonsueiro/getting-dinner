# getting-dinner

> This is my excuse to not pick a dinner spot and make my friend do it instead.

# Avalon and Alex get dinner in New York City

A one-phone game for picking a dinner spot in the corridor between **Grand Central
Terminal** and **Stuyvesant Town**. Tap through a short quiz together, get a
winner plus two runners-up, and open it in Google Maps.

Vite + React + TypeScript, Tailwind v4, framer-motion. Deploys to Vercel with no
configuration.

## Setup

```bash
npm install
npm run dev
```

That's enough to play — the app ships with a generated `src/data/restaurants.json`.

### 1. Add the two face images

Drop your cutouts in as:

- `public/avalon.png`
- `public/alex.png`

Square-ish PNGs with transparent backgrounds look best; they're rendered as
circles (140px on mobile, 200px on desktop) with a white border and soft shadow.

### 2. Add a Google Places API key (optional but recommended)

```bash
cp .env.example .env
# then paste your key
GOOGLE_PLACES_API_KEY=AIza...
```

Enable **Places API** in the Google Cloud Console for the project the key belongs
to. `.env` is gitignored — the key is only ever read by the Node script, never by
the browser.

### 3. Fetch real restaurant data

```bash
npm run fetch-restaurants
```

Discovery uses Places **Text Search** with ~17 queries (generic plus one per
cuisine), deduped by `place_id`, keeping places inside the corridor bounding box
(40.7300–40.7545 lat, −73.9900 to −73.9700 lng) with **rating ≥ 4.2** and
**≥ 100 reviews**, minus chains and fast food.

Details come from **Places API (New)**, which returns a real cuisine
(`primaryType`, e.g. `korean_restaurant`) where the legacy API only ever says
"restaurant, food, establishment". That one change took the number of places
falling through to the `Other` bucket from 35 to 1. It also supplies opening
hours, the canonical Maps URL, and photos.

Four photos per restaurant are downloaded into `public/photos/` and shown as a
collage on the winner card — Google returns them roughly by popularity and
they're user-submitted, so the set is usually a mix of dishes, the dining room,
and the storefront. Downloading them at build time also means **no API key ends
up in the shipped JSON**; a signed photo URL would leak it to every visitor.

Both APIs must be enabled in Google Cloud: **Places API** and **Places API (New)**.
Note that each photo is a billed request (~600 per full run).

**Without a key** the script writes a hand-written fallback list of 33 real
restaurants in the corridor instead, so the app always has something to work
with. Those entries carry `"data_source": "seed"`, approximate coordinates,
ballpark ratings, and no photos or hours — the result card falls back to a
cuisine gradient. Run the script with a key to replace them with live data.

### 4. Deploy

```bash
npm run build      # tsc -b && vite build → dist/
```

Push to GitHub and import the repo on Vercel. Framework preset **Vite** is
detected automatically; no environment variables are needed at deploy time
because the restaurant data is committed as JSON. Re-run the fetch script and
commit the result whenever you want fresher data.

## How it works

| Path | What's in it |
| --- | --- |
| `src/pages/Landing.tsx` | Skyline, floating faces, Go button |
| `src/pages/Quiz.tsx` | 9 screens: price → cuisine → 6 this-or-that rounds → avoid |
| `src/pages/Result.tsx` | Confetti, winner card, two runners-up, try again / roll the dice |
| `src/lib/score.ts` | Hard filters and weighted soft scoring |
| `src/lib/geo.ts` | Coordinates, walk times, corridor bounds |
| `src/lib/quiz.ts` | Question content — edit here to change the quiz |
| `src/lib/random.ts` | Seeded PRNG shared by the skyline and the dice roll |
| `src/components/Skyline.tsx` | The skyline, drawn as SVG (no image licensing) |
| `scripts/fetch-restaurants.ts` | Google Places fetch + seed fallback |
| `scripts/seed-restaurants.ts` | The hand-written fallback list |

### Scoring

`scoreRestaurant(restaurant, answers)` in `src/lib/score.ts` returns a score and
a few human-readable reasons; `pickRestaurants` applies the hard filters and
returns the top 3.

**Hard filters** — the `PRICE_CEILING`, selected price levels, selected cuisines
(unless "Surprise us"), nothing matching the avoid text, and open at 7pm today
when hours are known. If fewer than three places survive, the cuisine filter is dropped, then
price, so you always get a suggestion; the result page says when that happened.

**Soft scores** — all weights live in the `WEIGHTS` object at the top of the
file. Rating and review count, fairness (equal walk from both homes) or a bias
toward whichever home was picked, and keyword matching against Google types and
the restaurant name for sit-down/casual, classic/trendy, quick/long, and drinks.

Price is deliberately *only* a hard filter: the quiz asks about it once, so
there's no second, softer price opinion folded into the score.

Every this-or-that round has a neutral middle option. Picking it contributes
nothing to the score, exactly like skipping the round.

**Jitter** — a random term worth up to 26 points is added to every score, so
"Roll the dice" genuinely reshuffles the front of the pack. The best match still
wins most of the time; tune `WEIGHTS.jitter` to taste.

### Geography

Grand Central (40.7527, −73.9772) and Stuytown (40.7317, −73.9778), midpoint
around Kips Bay / Rose Hill. Walk times are straight-line distance at 80 m/min —
close enough for Manhattan, but they ignore the street grid, so treat them as
estimates. `fairness` is the absolute difference between the two walk times.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck (app + scripts) and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run fetch-restaurants` | Rebuild `src/data/restaurants.json` |

## Notes

- The two faces on the landing page are `public/avalon.png` and `public/alex.png`.
  Each has a `zoom` (and optional `offsetY`) prop in `src/pages/Landing.tsx` so a
  cutout with wide margins and a tight portrait can be made to read at the same
  size.
- Avalon lives in Stuytown, Alex is up by Grand Central. If that ever needs
  swapping it's two places: the `side` round in `src/lib/quiz.ts` and the
  `picks.side` branch in `src/lib/score.ts`.
- `PRICE_CEILING` in `src/lib/score.ts` caps how expensive a recommendation can
  be (currently 2, i.e. `$$`). It drives both the options shown in the quiz and
  a hard filter that holds even when the price question is skipped. Raise it to
  4 to put the pricier tiers back.
