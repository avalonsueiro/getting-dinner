export const CUISINES = [
  'Italian',
  'Japanese',
  'Chinese',
  'Thai',
  'Indian',
  'Mexican',
  'Mediterranean',
  'American',
  'French',
  'Korean',
  'Pizza',
  'Steak',
  'Seafood',
  'Vegetarian',
  'Other',
] as const

export type Cuisine = (typeof CUISINES)[number]

/** A window of time a place is open, in minutes-from-midnight, for one weekday (0 = Sunday). */
export interface OpenPeriod {
  day: number
  open: number
  close: number
}

export interface Restaurant {
  place_id: string
  name: string
  address: string
  lat: number
  lng: number
  rating: number
  review_count: number
  /** Google price_level, 1–4. Null when Google has no price data. */
  price_level: number | null
  cuisine: Cuisine
  maps_url: string
  /** Up to 4 Google photos (a mix of food, room, and exterior shots). */
  photo_urls: string[]
  /** Human-readable hours, one string per weekday, straight from Google. */
  hours_summary: string[] | null
  /** Structured hours used by the "open at 7pm" filter. Null when unknown. */
  open_periods: OpenPeriod[] | null
  walk_minutes_from_grand_central: number
  walk_minutes_from_stuytown: number
  /** |walk from GCT − walk from Stuy Town|. Lower is fairer. */
  fairness: number
  /** Raw Google types, used for keyword scoring. */
  types: string[]
  /** "google" for live API data, "seed" for the hand-written fallback list. */
  data_source: 'google' | 'seed'
}

/**
 * Each round stores one value. 'either' is the neutral middle choice and simply
 * contributes nothing to the score, exactly like leaving the round unanswered.
 */
export interface ThisOrThatAnswers {
  service?: 'sitdown' | 'casual' | 'either'
  side?: 'avalon' | 'alex' | 'center'
  style?: 'classic' | 'trendy' | 'either'
  pace?: 'quick' | 'long' | 'either'
  drinks?: 'drinks' | 'food' | 'either'
  fame?: 'known' | 'new' | 'either'
}

export interface Answers {
  /** Selected Google price levels. Empty means "no preference". */
  prices: number[]
  /** Up to three cuisines. Ignored when surpriseUs is true. */
  cuisines: Cuisine[]
  surpriseUs: boolean
  picks: ThisOrThatAnswers
  avoid: string
}

export const EMPTY_ANSWERS: Answers = {
  prices: [],
  cuisines: [],
  surpriseUs: false,
  picks: {},
  avoid: '',
}
