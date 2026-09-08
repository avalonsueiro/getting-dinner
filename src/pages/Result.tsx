import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import restaurantsData from '../data/restaurants.json'
import { CUISINE_EMOJI } from '../lib/quiz'
import { mulberry32 } from '../lib/random'
import { pickRestaurants, type ScoredRestaurant } from '../lib/score'
import type { Answers, Restaurant } from '../types'

const RESTAURANTS = restaurantsData as Restaurant[]

function priceLabel(level: number | null): string {
  return level ? '$'.repeat(level) : '$$'
}

function fireConfetti() {
  const shoot = (particleRatio: number, opts: confetti.Options) =>
    confetti({
      origin: { y: 0.35 },
      colors: ['#ffc93c', '#ff5f8f', '#ff8a5c', '#ffffff', '#8ad6ff'],
      particleCount: Math.floor(220 * particleRatio),
      ...opts,
    })

  shoot(0.25, { spread: 26, startVelocity: 55 })
  shoot(0.2, { spread: 60 })
  shoot(0.35, { spread: 100, decay: 0.91, scalar: 0.9 })
  shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  shoot(0.1, { spread: 120, startVelocity: 45 })
}

function CuisinePattern({ r, tall }: { r: Restaurant; tall?: boolean }) {
  // Seed data, or Google had no photos: a tidy gradient with the cuisine emoji.
  return (
    <div
      className={`grid size-full place-items-center bg-linear-to-br from-dusk-700 via-dusk-500 to-sunset-400/70 ${
        tall ? 'h-52 sm:h-64' : 'h-24'
      }`}
    >
      <span className={tall ? 'text-6xl' : 'text-3xl'}>{CUISINE_EMOJI[r.cuisine] ?? '🍴'}</span>
    </div>
  )
}

/**
 * Winner card imagery: a collage of whatever Google had for the place, which is
 * usually a mix of dishes, the room, and the storefront.
 *
 * The grid needs an explicit row count plus `min-h-0` on the images: without
 * them the implicit rows size to each photo's intrinsic height, the grid
 * overflows its fixed height, and the photos paint over the card text below.
 */
function PhotoCollage({ r }: { r: Restaurant }) {
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const photos = r.photo_urls.filter((p) => !broken.has(p)).slice(0, 4)

  if (photos.length === 0) return <CuisinePattern r={r} tall />

  const markBroken = (src: string) =>
    setBroken((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))

  const tile = (src: string, extra = '') => (
    <img
      key={src}
      src={src}
      alt=""
      onError={() => markBroken(src)}
      className={`h-full min-h-0 w-full object-cover ${extra}`}
    />
  )

  const frame = 'grid h-56 gap-0.5 overflow-hidden sm:h-64'

  if (photos.length === 1) {
    return <div className={`${frame} grid-cols-1 grid-rows-1`}>{tile(photos[0])}</div>
  }
  if (photos.length === 2) {
    return <div className={`${frame} grid-cols-2 grid-rows-1`}>{photos.map((p) => tile(p))}</div>
  }
  if (photos.length === 3) {
    // Big photo on the left, two stacked on the right.
    return (
      <div className={`${frame} grid-cols-3 grid-rows-2`}>
        {tile(photos[0], 'col-span-2 row-span-2')}
        {tile(photos[1])}
        {tile(photos[2])}
      </div>
    )
  }
  return (
    <div className={`${frame} grid-cols-2 grid-rows-2`}>{photos.map((p) => tile(p))}</div>
  )
}

/** Small single-photo thumbnail for the runner-up rows. */
function Thumb({ r }: { r: Restaurant }) {
  const [failed, setFailed] = useState(false)
  const src = r.photo_urls[0]

  if (!src || failed) return <CuisinePattern r={r} />
  return (
    <img
      src={src}
      alt={r.name}
      onError={() => setFailed(true)}
      className="h-24 w-full object-cover"
    />
  )
}

function WalkPill({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div className="flex-1 rounded-2xl bg-white/8 px-3 py-2.5 text-center">
      <div className="font-display text-xl font-bold text-white">{minutes}<span className="text-sm font-semibold text-white/60"> min</span></div>
      <div className="mt-0.5 text-[11px] leading-tight text-white/55">{label}</div>
    </div>
  )
}

function WinnerCard({ scored }: { scored: ScoredRestaurant }) {
  const r = scored.restaurant
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 130, damping: 16 }}
      className="overflow-hidden rounded-[28px] bg-white/8 ring-2 ring-taxi/60 backdrop-blur"
    >
      <PhotoCollage r={r} />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 rounded-full bg-taxi/20 px-2.5 py-1 text-taxi">
            <span>{CUISINE_EMOJI[r.cuisine]}</span> {r.cuisine}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">
            {priceLabel(r.price_level)}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/80">
            ★ {r.rating.toFixed(1)} · {r.review_count.toLocaleString()}
          </span>
        </div>

        <h2 className="font-display mt-3 text-3xl leading-tight font-bold text-white">{r.name}</h2>
        <p className="mt-1 text-sm text-white/60">{r.address}</p>

        {scored.reasons.length > 0 && (
          <p className="mt-3 text-sm text-white/75">Why: {scored.reasons.join(' · ')}.</p>
        )}

        {r.hours_summary && (
          <p className="mt-2 text-xs text-white/45">
            {r.hours_summary[(new Date().getDay() + 6) % 7] ?? r.hours_summary[0]}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <WalkPill label="walk from Grand Central" minutes={r.walk_minutes_from_grand_central} />
          <WalkPill label="walk from Stuytown" minutes={r.walk_minutes_from_stuytown} />
        </div>

        <motion.a
          href={r.maps_url}
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.96 }}
          className="tap-safe font-display mt-4 block rounded-full bg-linear-to-b from-taxi to-sunset-400 py-3.5 text-center text-lg font-bold text-dusk-900 shadow-[0_7px_0_-1px_rgba(180,80,20,0.5)]"
        >
          Open in Google Maps
        </motion.a>
      </div>
    </motion.div>
  )
}

function RunnerUp({ scored, index }: { scored: ScoredRestaurant; index: number }) {
  const r = scored.restaurant
  return (
    <motion.a
      href={r.maps_url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08 }}
      whileTap={{ scale: 0.97 }}
      className="tap-safe flex items-center gap-3 overflow-hidden rounded-2xl bg-white/6 pr-3"
    >
      <div className="w-24 shrink-0">
        <Thumb r={r} />
      </div>
      <div className="min-w-0 flex-1 py-2">
        <div className="font-display truncate text-base font-bold text-white">{r.name}</div>
        <div className="mt-0.5 truncate text-xs text-white/55">
          {r.cuisine} · {priceLabel(r.price_level)} · ★ {r.rating.toFixed(1)}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          {r.walk_minutes_from_grand_central} min / {r.walk_minutes_from_stuytown} min walk
        </div>
      </div>
    </motion.a>
  )
}

interface Props {
  answers: Answers
  onRetry: () => void
  onHome: () => void
}

export default function Result({ answers, onRetry, onHome }: Props) {
  // Bumping this reseeds the scorer's jitter, so each roll is a fresh draw that
  // still stays stable across re-renders.
  const [roll, setRoll] = useState(0)
  const [seedBase] = useState(() => Math.floor(Math.random() * 1e9))

  const result = useMemo(
    () => pickRestaurants(RESTAURANTS, answers, mulberry32(seedBase + roll * 7919)),
    [answers, roll, seedBase],
  )

  useEffect(() => {
    const t = window.setTimeout(fireConfetti, 250)
    return () => window.clearTimeout(t)
  }, [roll])

  const [winner, ...runnersUp] = result.top

  if (!winner) {
    return (
      <div className="grid min-h-dvh place-items-center bg-linear-to-b from-dusk-900 to-dusk-700 px-6 text-center">
        <div>
          <div className="text-5xl">🤷</div>
          <h2 className="font-display mt-4 text-2xl font-bold text-white">
            No restaurants match those filters.
          </h2>
          <p className="mt-2 text-sm text-white/60">Try again with fewer restrictions.</p>
          <button
            type="button"
            onClick={onRetry}
            className="tap-safe font-display mt-6 rounded-full bg-taxi px-8 py-3 font-bold text-dusk-900"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-linear-to-b from-dusk-900 via-dusk-700 to-dusk-500 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-5 text-center"
        >
          <div className="font-display text-3xl font-bold text-white sm:text-4xl">Ta-da!</div>
          <p className="mt-1 text-sm text-white/70">Here's your restaurant for the evening.</p>
        </motion.div>

        <WinnerCard key={`${winner.restaurant.place_id}-${roll}`} scored={winner} />

        {runnersUp.length > 0 && (
          <div className="mt-6">
            <div className="mb-2.5 text-xs font-bold tracking-widest text-white/40 uppercase">
              Other options
            </div>
            <div className="space-y-2.5">
              {runnersUp.map((s, i) => (
                <RunnerUp key={s.restaurant.place_id} scored={s} index={i} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            onClick={onRetry}
            whileTap={{ scale: 0.95 }}
            className="tap-safe font-display rounded-full border-2 border-white/20 py-3.5 font-bold text-white"
          >
            Try again
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setRoll((n) => n + 1)}
            whileTap={{ scale: 0.95, rotate: -3 }}
            className="tap-safe font-display flex items-center justify-center gap-2 rounded-full bg-bubblegum py-3.5 font-bold text-white shadow-[0_7px_0_-1px_rgba(150,20,60,0.5)]"
          >
            <span>🎲</span> Roll the dice
          </motion.button>
        </div>

        <button
          type="button"
          onClick={onHome}
          className="tap-safe mt-4 w-full text-center text-xs font-semibold text-white/40"
        >
          Back to the start
        </button>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
          {result.eligible} of {RESTAURANTS.length} places matched your answers
          {result.relaxed && ' — too few, so we loosened the cuisine and price filters'}. Walk times
          are straight-line estimates at 80 m/min.
        </p>
      </div>
    </div>
  )
}
