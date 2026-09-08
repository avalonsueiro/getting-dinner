import type { Answers, Restaurant } from '../types'

/**
 * Highest Google price_level the app will ever recommend. This is a floor-level
 * rule, not a preference: it applies even when the price question is skipped,
 * and it survives the relaxation pass below.
 */
export const PRICE_CEILING = 2

/**
 * Everything about how a restaurant is judged lives in these two blocks — tune
 * here rather than in the scoring functions below.
 */
export const WEIGHTS = {
  rating: 22,
  reviews: 9,
  /** Equal walk from both homes. Only used when nobody picked a side. */
  fairness: 20,
  /** Walking distance from whichever home they picked. */
  proximityBias: 20,
  service: 9,
  style: 9,
  drinks: 11,
  pace: 7,
  fame: 9,
  /**
   * Ceiling on the random tie-breaker. Sized so "roll the dice" genuinely
   * reshuffles the front of the pack — the deterministic gap between a good
   * match and a very good one is usually 5–15 points.
   */
  jitter: 26,
}

const KEYWORDS = {
  sitdown: ['fine dining', 'fine_dining', 'tasting menu', 'ristorante', 'steak house', 'steak_house', 'brasserie', 'dining room', 'tavern', 'omakase'],
  casual: ['counter', 'casual', 'deli', 'taqueria', 'noodle', 'pizza', 'slice', 'quick', 'sandwich', 'ramen', 'diner', 'street food'],
  classic: ['classic', 'historic', 'tavern', 'steak house', 'steak_house', 'oyster bar', 'trattoria', 'since', 'institution', 'landmark', 'old'],
  trendy: ['trendy', 'new american', 'natural wine', 'small plates', 'modern', 'chef', 'tasting menu', 'seasonal', 'hip'],
  drinks: ['bar', 'cocktail', 'wine', 'whiskey', 'sake', 'soju', 'mezcal', 'tequila', 'margarita', 'lounge', 'brewery', 'beer', 'izakaya', 'tavern', 'pub', 'enoteca'],
  quick: ['counter', 'casual', 'noodle', 'ramen', 'pizza', 'slice', 'quick', 'deli', 'sandwich', 'taqueria'],
  long: ['tasting menu', 'fine dining', 'fine_dining', 'steak house', 'steak_house', 'omakase', 'multi-course', 'ristorante', 'dining room', 'wine'],
} as const

export interface ScoredRestaurant {
  restaurant: Restaurant
  score: number
  /** Short human-readable notes about why this one rose to the top. */
  reasons: string[]
}

/** Everything the quiz knows about this restaurant, lowercased, for keyword hits. */
function haystack(r: Restaurant): string {
  return [r.name, r.cuisine, ...r.types].join(' ').toLowerCase().replace(/_/g, ' ')
}

/** 1 when any keyword hits, 0.3 when none do — absence is weak evidence, not proof. */
function keywordScore(hay: string, words: readonly string[]): number {
  const hits = words.filter((w) => hay.includes(w)).length
  if (hits === 0) return 0.3
  return Math.min(1, 0.65 + hits * 0.18)
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Minutes-past-midnight for 7pm, the assumed dinner time. */
const DINNER_MINUTES = 19 * 60

function isOpenForDinner(r: Restaurant, now: Date): boolean {
  if (!r.open_periods?.length) return true // unknown hours: don't punish
  const today = now.getDay()
  const yesterday = (today + 6) % 7
  return r.open_periods.some((p) => {
    if (p.day === today && DINNER_MINUTES >= p.open && DINNER_MINUTES < p.close) return true
    // A period that started yesterday and runs past midnight.
    if (p.day === yesterday && p.close > 24 * 60) {
      return DINNER_MINUTES + 24 * 60 >= p.open && DINNER_MINUTES + 24 * 60 < p.close
    }
    return false
  })
}

/** Tokens from the free-text "anything to avoid?" box. */
export function avoidTokens(avoid: string): string[] {
  return avoid
    .toLowerCase()
    .split(/[,;/]|\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

function passesHardFilters(r: Restaurant, a: Answers, now: Date): boolean {
  // Never recommend above the ceiling, whatever the answers say.
  if (r.price_level !== null && r.price_level > PRICE_CEILING) {
    return false
  }
  if (a.prices.length && r.price_level !== null && !a.prices.includes(r.price_level)) {
    return false
  }
  if (!a.surpriseUs && a.cuisines.length && !a.cuisines.includes(r.cuisine)) {
    return false
  }
  const hay = `${haystack(r)} ${r.address.toLowerCase()}`
  if (avoidTokens(a.avoid).some((t) => hay.includes(t))) {
    return false
  }
  if (!isOpenForDinner(r, now)) {
    return false
  }
  return true
}

/**
 * Soft score for one restaurant, 0 to roughly the sum of WEIGHTS.
 * Exported for tests / debugging; `scoreRestaurant` is the entry point.
 */
export function scoreRestaurant(
  restaurant: Restaurant,
  answers: Answers,
  random: () => number = Math.random,
): ScoredRestaurant {
  const hay = haystack(restaurant)
  const { picks } = answers
  const reasons: string[] = []
  let score = 0

  const add = (weight: number, normalized: number, reason?: string) => {
    score += weight * clamp01(normalized)
    if (reason && normalized >= 0.75) reasons.push(reason)
  }

  // Quality.
  const ratingScore = (restaurant.rating - 4.0) / 0.8
  add(WEIGHTS.rating, ratingScore, `Rated ${restaurant.rating.toFixed(1)} on Google`)
  const reviewScore = Math.log10(Math.max(restaurant.review_count, 1)) / Math.log10(5000)
  add(WEIGHTS.reviews, reviewScore)

  // Geography: either split the difference or lean toward one home.
  // Avalon lives in Stuy Town; Alex is up by Grand Central.
  if (picks.side === 'avalon') {
    add(
      WEIGHTS.proximityBias,
      1 - restaurant.walk_minutes_from_stuytown / 25,
      `${restaurant.walk_minutes_from_stuytown} min walk from Stuy Town`,
    )
  } else if (picks.side === 'alex') {
    add(
      WEIGHTS.proximityBias,
      1 - restaurant.walk_minutes_from_grand_central / 25,
      `${restaurant.walk_minutes_from_grand_central} min walk from Grand Central`,
    )
  } else {
    add(WEIGHTS.fairness, 1 - restaurant.fairness / 12, 'Nearly equal walk from both')
  }

  // Format. Price is handled entirely by the hard filter — the quiz asks about
  // it once, so there is no second, softer price opinion to fold in here.
  const price = restaurant.price_level ?? 2

  if (picks.service === 'sitdown') {
    add(WEIGHTS.service, Math.max(keywordScore(hay, KEYWORDS.sitdown), price >= 3 ? 0.8 : 0.3))
  }
  if (picks.service === 'casual') {
    add(WEIGHTS.service, Math.max(keywordScore(hay, KEYWORDS.casual), price <= 2 ? 0.8 : 0.3))
  }

  if (picks.style === 'classic') {
    add(WEIGHTS.style, keywordScore(hay, KEYWORDS.classic), 'Long-established')
  }
  if (picks.style === 'trendy') {
    add(WEIGHTS.style, keywordScore(hay, KEYWORDS.trendy), 'Newer and currently popular')
  }

  if (picks.pace === 'quick') add(WEIGHTS.pace, keywordScore(hay, KEYWORDS.quick))
  if (picks.pace === 'long') add(WEIGHTS.pace, keywordScore(hay, KEYWORDS.long))

  if (picks.drinks === 'drinks') {
    add(WEIGHTS.drinks, keywordScore(hay, KEYWORDS.drinks), 'Known for its drinks')
  }
  if (picks.drinks === 'food') {
    // Food-only: mildly prefer places that aren't primarily bars.
    add(WEIGHTS.drinks, 1 - keywordScore(hay, KEYWORDS.drinks) * 0.7)
  }

  // Famous vs undiscovered.
  const fameScore = clamp01(Math.log10(Math.max(restaurant.review_count, 1)) / Math.log10(5000))
  if (picks.fame === 'known') add(WEIGHTS.fame, fameScore, 'Well known')
  if (picks.fame === 'new') add(WEIGHTS.fame, 1 - fameScore, 'Fewer reviews')

  // Tie-breaker.
  score += random() * WEIGHTS.jitter

  return { restaurant, score, reasons: reasons.slice(0, 3) }
}

export interface PickResult {
  top: ScoredRestaurant[]
  /** How many restaurants survived the hard filters. */
  eligible: number
  /** True when the filters were too tight and we had to relax them. */
  relaxed: boolean
}

/**
 * Runs the whole list through the hard filters and the scorer and returns the
 * top three. If the filters leave fewer than three options, cuisine and price
 * are dropped (in that order) so the evening still has a plan.
 */
export function pickRestaurants(
  restaurants: Restaurant[],
  answers: Answers,
  random: () => number = Math.random,
  now: Date = new Date(),
): PickResult {
  const eligible = restaurants.filter((r) => passesHardFilters(r, answers, now))
  let pool = eligible
  let relaxed = false

  if (pool.length < 3) {
    relaxed = true
    const noCuisine: Answers = { ...answers, cuisines: [], surpriseUs: true }
    pool = restaurants.filter((r) => passesHardFilters(r, noCuisine, now))
  }
  if (pool.length < 3) {
    const noPrice: Answers = { ...answers, cuisines: [], surpriseUs: true, prices: [] }
    pool = restaurants.filter((r) => passesHardFilters(r, noPrice, now))
  }

  const scored = pool
    .map((r) => scoreRestaurant(r, answers, random))
    .sort((a, b) => b.score - a.score)

  return { top: scored.slice(0, 3), eligible: eligible.length, relaxed }
}
