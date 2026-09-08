import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { CUISINE_EMOJI, MAX_CUISINES, PRICE_OPTIONS, ROUNDS } from '../lib/quiz'
import { CUISINES, type Answers, type Cuisine, type ThisOrThatAnswers } from '../types'

interface Props {
  initial: Answers
  onDone: (answers: Answers) => void
  onQuit: () => void
}

/** price → cuisine → one screen per this-or-that round → avoid. */
const TOTAL_STEPS = 2 + ROUNDS.length + 1

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

function Shell({
  step,
  onBack,
  onQuit,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number
  onBack: () => void
  onQuit: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-dusk-900 via-dusk-700 to-dusk-500 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="tap-safe grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xl text-white/90 active:scale-90"
          >
            ‹
          </button>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/12">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-taxi to-bubblegum"
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            />
          </div>
          <button
            type="button"
            onClick={onQuit}
            className="tap-safe shrink-0 text-xs font-semibold text-white/45 active:text-white/80"
          >
            Start over
          </button>
        </div>

        <div className="mt-6 mb-5">
          <h2 className="font-display text-2xl leading-snug font-bold text-white sm:text-3xl">
            {title}
          </h2>
          {subtitle && <p className="mt-1.5 text-sm text-white/60">{subtitle}</p>}
        </div>

        <div className="flex-1">{children}</div>

        {footer && <div className="pt-5">{footer}</div>}
      </div>
    </div>
  )
}

function NextButton({ onClick, disabled, label = 'Next' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap-safe font-display w-full rounded-full bg-linear-to-b from-taxi to-sunset-400 py-4 text-xl font-bold text-dusk-900 shadow-[0_8px_0_-1px_rgba(180,80,20,0.5)] disabled:opacity-35 disabled:shadow-none"
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96, y: 3 }}
    >
      {label}
    </motion.button>
  )
}

function Choice({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`tap-safe relative w-full rounded-3xl border-2 p-4 text-left transition-colors ${
        selected
          ? 'border-taxi bg-taxi/18 text-white'
          : 'border-white/12 bg-white/6 text-white/85 active:bg-white/12'
      } ${className}`}
    >
      {children}
      {selected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-taxi text-sm font-bold text-dusk-900"
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  )
}

export default function Quiz({ initial, onDone, onQuit }: Props) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [prices, setPrices] = useState<number[]>(initial.prices)
  const [cuisines, setCuisines] = useState<Cuisine[]>(initial.cuisines)
  const [surpriseUs, setSurpriseUs] = useState(initial.surpriseUs)
  const [picks, setPicks] = useState<ThisOrThatAnswers>(initial.picks)
  const [avoid, setAvoid] = useState(initial.avoid)

  const answers: Answers = useMemo(
    () => ({ prices, cuisines, surpriseUs, picks, avoid }),
    [prices, cuisines, surpriseUs, picks, avoid],
  )

  const go = (delta: number) => {
    const next = step + delta
    if (next < 0) return onQuit()
    if (next >= TOTAL_STEPS) return onDone(answers)
    setDir(delta)
    setStep(next)
  }

  const togglePrice = (value: number) =>
    setPrices((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]))

  const toggleCuisine = (c: Cuisine) =>
    setCuisines((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c)
      if (prev.length >= MAX_CUISINES) return prev
      setSurpriseUs(false)
      return [...prev, c]
    })

  const roundIndex = step - 2
  const round = roundIndex >= 0 && roundIndex < ROUNDS.length ? ROUNDS[roundIndex] : null

  let body: React.ReactNode = null
  let title = ''
  let subtitle: string | undefined
  let footer: React.ReactNode = null

  if (step === 0) {
    title = "What are we spending?"
    subtitle = 'Select any that work. Skip if you have no preference.'
    body = (
      <div className="grid grid-cols-2 gap-3">
        {PRICE_OPTIONS.map((p) => (
          <Choice key={p.value} selected={prices.includes(p.value)} onClick={() => togglePrice(p.value)}>
            <div className="font-display text-2xl font-bold">{p.label}</div>
            <div className="mt-1 text-xs text-white/60">{p.blurb}</div>
          </Choice>
        ))}
      </div>
    )
    footer = <NextButton onClick={() => go(1)} label={prices.length ? 'Next' : 'Skip — no preference'} />
  } else if (step === 1) {
    title = "Which cuisines?"
    subtitle = `Select up to ${MAX_CUISINES}, or skip to allow any cuisine.`
    body = (
      <div className="space-y-3">
        <Choice
          selected={surpriseUs}
          onClick={() => {
            setSurpriseUs((s) => !s)
            setCuisines([])
          }}
        >
          <div className="font-display flex items-center gap-2 text-lg font-bold"><span>🎲</span> Surprise us</div>
          <div className="mt-0.5 text-xs text-white/60">Include every cuisine</div>
        </Choice>

        <div className="grid grid-cols-3 gap-2.5">
          {CUISINES.filter((c) => c !== 'Other').map((c) => {
            const selected = cuisines.includes(c)
            const full = !selected && cuisines.length >= MAX_CUISINES
            return (
              <motion.button
                key={c}
                type="button"
                onClick={() => toggleCuisine(c)}
                whileTap={{ scale: 0.93 }}
                className={`tap-safe rounded-2xl border-2 px-1.5 py-3 text-center transition-colors ${
                  selected
                    ? 'border-taxi bg-taxi/18 text-white'
                    : `border-white/12 bg-white/6 text-white/85 ${full ? 'opacity-40' : 'active:bg-white/12'}`
                }`}
              >
                <div className="text-2xl">{CUISINE_EMOJI[c]}</div>
                <div className="mt-1 text-[11px] leading-tight font-semibold">{c}</div>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
    footer = (
      <NextButton
        onClick={() => go(1)}
        label={surpriseUs || cuisines.length ? 'Next' : 'Skip — no preference'}
      />
    )
  } else if (round) {
    title = round.question
    subtitle = `Round ${roundIndex + 1} of ${ROUNDS.length}. Select one, then Next.`
    const pick = (value: string) => setPicks((p) => ({ ...p, [round.key]: value }))
    body = (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {round.options.map((opt) => (
            <Choice
              key={opt.value}
              selected={picks[round.key] === opt.value}
              onClick={() => pick(opt.value)}
              className="flex min-h-40 flex-col"
            >
              <div className="text-3xl">{opt.emoji}</div>
              <div className="mt-auto pt-3">
                <div className="font-display text-lg leading-tight font-bold">{opt.label}</div>
                <div className="mt-0.5 text-xs text-white/60">{opt.blurb}</div>
              </div>
            </Choice>
          ))}
        </div>

        <Choice
          selected={picks[round.key] === round.middle.value}
          onClick={() => pick(round.middle.value)}
        >
          <div className="font-display flex items-center gap-2 text-lg font-bold">
            <span>{round.middle.emoji}</span> {round.middle.label}
          </div>
          <div className="mt-0.5 text-xs text-white/60">{round.middle.blurb}</div>
        </Choice>
      </div>
    )
    footer = (
      <NextButton onClick={() => go(1)} label={picks[round.key] ? 'Next' : 'Skip this one'} />
    )
  } else {
    title = 'Anything to avoid?'
    subtitle = 'Optional. Enter a cuisine or restaurant name to exclude.'
    body = (
      <div>
        <textarea
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="e.g. sushi, Keens"
          rows={3}
          className="w-full resize-none rounded-3xl border-2 border-white/12 bg-white/6 p-4 text-base text-white placeholder:text-white/30 focus:border-taxi focus:outline-none"
        />
        <p className="mt-3 text-xs text-white/40">
          Any restaurant matching this text is removed from the results.
        </p>
      </div>
    )
    footer = <NextButton onClick={() => onDone(answers)} label="Find our dinner →" />
  }

  return (
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.div
        key={step}
        custom={dir}
        variants={slide}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Shell
          step={step}
          onBack={() => go(-1)}
          onQuit={onQuit}
          title={title}
          subtitle={subtitle}
          footer={footer}
        >
          {body}
        </Shell>
      </motion.div>
    </AnimatePresence>
  )
}
