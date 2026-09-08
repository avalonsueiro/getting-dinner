import { motion } from 'framer-motion'

import FloatingFace from '../components/FloatingFace'
import Skyline from '../components/Skyline'

const STARS = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 42,
  size: i % 5 === 0 ? 3 : 2,
  delay: (i % 7) * 0.4,
}))

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Dusk sky */}
      <div className="absolute inset-0 bg-linear-to-b from-dusk-900 via-dusk-700 to-dusk-500" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-sunset-400/45 to-transparent" />

      {STARS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.15, 0.9, 0.15] }}
          transition={{ duration: 3 + (i % 4), delay: s.delay, repeat: Infinity }}
        />
      ))}

      {/* Moon — lives in the sky layer rather than the skyline SVG so it never
          gets clipped when the skyline scales to fill the width. */}
      <motion.div
        className="absolute top-[8%] right-[10%] size-16 rounded-full bg-[#fff6d8] sm:size-20"
        style={{ boxShadow: '0 0 60px 18px rgba(255,246,216,0.16)' }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="absolute top-[22%] left-[18%] size-2.5 rounded-full bg-[#e8dcb8]/50" />
        <span className="absolute right-[24%] bottom-[20%] size-4 rounded-full bg-[#e8dcb8]/40" />
      </motion.div>

      <Skyline className="absolute inset-x-0 bottom-0 h-[46%] w-full" />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <motion.h1
          className="font-display max-w-3xl text-4xl leading-tight font-bold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)] sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Avalon and Alex get dinner in{' '}
          <span className="text-taxi">New York City</span>.
        </motion.h1>

        <motion.p
          className="max-w-md text-base text-white/80 sm:text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          Somewhere between Grand Central and Stuytown.
        </motion.p>

        <motion.div
          className="flex items-end justify-center gap-6 sm:gap-12"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 14 }}
        >
          <FloatingFace
            src="/avalon.png"
            alt="Avalon"
            label="Avalon"
            duration={3.2}
            tilt={4}
            zoom={1.2}
            ringClass="ring-taxi/80"
          />
          <FloatingFace
            src="/alex.png"
            alt="Alex"
            label="Alex"
            delay={0.7}
            duration={4.1}
            tilt={-5}
            ringClass="ring-bubblegum/80"
          />
        </motion.div>

        <motion.button
          type="button"
          onClick={onStart}
          className="tap-safe font-display mt-2 size-32 rounded-full bg-linear-to-b from-taxi to-sunset-400 text-3xl font-bold text-dusk-900 shadow-[0_14px_0_-2px_rgba(180,80,20,0.55),0_22px_40px_-10px_rgba(0,0,0,0.7)] sm:size-36 sm:text-4xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 15 }}
          whileHover={{ scale: 1.07, rotate: -2 }}
          whileTap={{ scale: 0.92, y: 6 }}
        >
          Go
        </motion.button>

      </div>
    </div>
  )
}
