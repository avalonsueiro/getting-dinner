import { motion } from 'framer-motion'

interface Props {
  src: string
  alt: string
  label: string
  /** Slight per-face offsets so the two never bob in sync. */
  delay?: number
  duration?: number
  tilt?: number
  ringClass?: string
  /** Zoom for cutouts that sit small inside their canvas, so both faces match. */
  zoom?: number
  /** Nudge, in percent of the circle, when the face isn't vertically centered. */
  offsetY?: number
}

export default function FloatingFace({
  src,
  alt,
  label,
  delay = 0,
  duration = 3.4,
  tilt = 4,
  ringClass = 'ring-white',
  zoom = 1.05,
  offsetY = 0,
}: Props) {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      animate={{ y: [0, -16, 0], rotate: [-tilt, tilt, -tilt] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
        times: [0, 0.5, 1],
      }}
    >
      <motion.div
        className={`size-[140px] overflow-hidden rounded-full bg-white/95 ring-4 md:size-[200px] ${ringClass}`}
        style={{ boxShadow: '0 18px 40px -12px rgba(0,0,0,0.65)' }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: duration * 1.3, delay: delay / 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          src={src}
          alt={alt}
          className="size-full object-cover object-top"
          style={{ transform: `scale(${zoom}) translateY(${offsetY}%)` }}
          draggable={false}
        />
      </motion.div>
      <span className="font-display text-lg font-semibold text-white/90 drop-shadow md:text-xl">
        {label}
      </span>
    </motion.div>
  )
}
