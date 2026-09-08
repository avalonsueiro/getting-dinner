/**
 * Hand-drawn NYC skyline, generated as SVG so there is no image licensing to
 * worry about. Windows are placed with a seeded PRNG so the city looks the same
 * on every render (and every device).
 */
import { mulberry32 } from '../lib/random'


interface Building {
  x: number
  w: number
  h: number
  spire?: number
  tank?: boolean
}

function makeBuildings(rand: () => number, count: number, maxH: number): Building[] {
  const out: Building[] = []
  let x = -20
  for (let i = 0; i < count; i++) {
    const w = 28 + rand() * 62
    const h = 60 + rand() * maxH
    out.push({
      x,
      w,
      h,
      spire: rand() > 0.86 ? 30 + rand() * 60 : undefined,
      tank: rand() > 0.82,
    })
    x += w + rand() * 10
  }
  return out
}

function Windows({ b, rand, color }: { b: Building; rand: () => number; color: string }) {
  const cells = []
  const pad = 7
  const step = 12
  for (let wx = b.x + pad; wx < b.x + b.w - pad - 4; wx += step) {
    for (let wy = 400 - b.h + 14; wy < 396 - pad; wy += step) {
      if (rand() > 0.62) {
        cells.push(
          <rect
            key={`${wx}-${wy}`}
            x={wx}
            y={wy}
            width={4.5}
            height={6}
            rx={0.8}
            fill={color}
            opacity={0.35 + rand() * 0.65}
          />,
        )
      }
    }
  }
  return <>{cells}</>
}

function Layer({
  seed,
  count,
  maxH,
  fill,
  windowColor,
  opacity,
}: {
  seed: number
  count: number
  maxH: number
  fill: string
  windowColor: string
  opacity: number
}) {
  const rand = mulberry32(seed)
  const buildings = makeBuildings(rand, count, maxH)
  const winRand = mulberry32(seed + 999)

  return (
    <g opacity={opacity}>
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill={fill} />
          {b.spire && (
            <>
              <rect x={b.x + b.w / 2 - 5} y={400 - b.h - b.spire * 0.4} width={10} height={b.spire * 0.4} fill={fill} />
              <polygon
                points={`${b.x + b.w / 2 - 2.5},${400 - b.h - b.spire * 0.4} ${b.x + b.w / 2 + 2.5},${400 - b.h - b.spire * 0.4} ${b.x + b.w / 2},${400 - b.h - b.spire}`}
                fill={fill}
              />
            </>
          )}
          {b.tank && (
            <g fill={fill}>
              <rect x={b.x + b.w * 0.55} y={400 - b.h - 13} width={16} height={10} rx={2} />
              <rect x={b.x + b.w * 0.55 + 2} y={400 - b.h - 16} width={12} height={4} />
            </g>
          )}
          <Windows b={b} rand={winRand} color={windowColor} />
        </g>
      ))}
    </g>
  )
}

export default function Skyline({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Far skyline, hazy */}
      <Layer seed={7} count={26} maxH={210} fill="#3a2a63" windowColor="#ffd98a" opacity={0.55} />
      {/* Mid skyline */}
      <Layer seed={21} count={22} maxH={250} fill="#241a45" windowColor="#ffcf6b" opacity={0.85} />
      {/* Foreground */}
      <Layer seed={42} count={18} maxH={170} fill="#150f2e" windowColor="#ffc93c" opacity={1} />

      {/* Street glow */}
      <rect x={0} y={382} width={1000} height={18} fill="#0b0a1c" />
      <rect x={0} y={379} width={1000} height={4} fill="#ffb26b" opacity={0.25} />
    </svg>
  )
}
