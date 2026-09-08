/**
 * Builds src/data/restaurants.json.
 *
 * With GOOGLE_PLACES_API_KEY in .env it queries the Google Places API across the
 * Grand Central → Stuytown corridor, dedupes by place_id, filters, and writes
 * real data. Without a key it falls back to the hand-written seed list so the app
 * still works. The key never leaves this script — the client only ever sees the
 * generated JSON.
 *
 *   npm run fetch-restaurants
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOUNDS, MIDPOINT, inBounds, withWalkTimes } from '../src/lib/geo.ts'
import { CUISINES, type Cuisine, type OpenPeriod, type Restaurant } from '../src/types.ts'
import { SEED_RESTAURANTS } from './seed-restaurants.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = resolve(ROOT, 'src/data/restaurants.json')
const PHOTO_DIR = resolve(ROOT, 'public/photos')

const MIN_RATING = 4.2
const MIN_REVIEWS = 100
/** Radius that covers the corridor from its midpoint, in meters. */
const SEARCH_RADIUS = 1600
/** Photos downloaded per restaurant, shown as a collage on the winner card. */
const PHOTOS_PER_PLACE = 4
/** Width to request each photo at — they render as small collage tiles. */
const PHOTO_WIDTH = 500

const QUERIES = [
  'restaurant',
  'dinner',
  'italian restaurant',
  'japanese restaurant',
  'chinese restaurant',
  'thai restaurant',
  'indian restaurant',
  'mexican restaurant',
  'mediterranean restaurant',
  'american restaurant',
  'french restaurant',
  'korean restaurant',
  'pizza',
  'steakhouse',
  'seafood restaurant',
  'vegetarian restaurant',
  'wine bar',
]

/** Chains and fast food we never want to recommend for a dinner date. */
const CHAIN_BLOCKLIST = [
  "mcdonald", 'burger king', 'wendy', 'subway', 'chipotle', 'sweetgreen', 'cava',
  'shake shack', 'five guys', 'popeyes', 'kfc', 'taco bell', 'domino', 'papa john',
  "dunkin", 'starbucks', 'pret a manger', 'chopt', "just salad", 'panera',
  'olive garden', 'applebee', 'tgi friday', 'ihop', 'denny', 'wingstop',
  'halal guys', 'dig inn', "dig ", 'le pain quotidien', 'joe & the juice',
  'blank street', 'juice generation', 'chick-fil-a', 'nathan', 'checkers',
  'europan', 'pax ', 'westside market', 'seamless', 'bareburger', 'shakeshack',
]

const EXCLUDED_TYPES = ['meal_takeaway', 'meal_delivery', 'convenience_store', 'supermarket']

interface PlacesTextSearchResult {
  place_id: string
  name: string
  formatted_address?: string
  vicinity?: string
  geometry?: { location: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
  price_level?: number
  types?: string[]
  photos?: { photo_reference: string }[]
  business_status?: string
}

/**
 * Places API (New) detail shape. Text Search (legacy) is only used to discover
 * place IDs; details come from the new endpoint because it returns a real
 * cuisine (`primaryType`, e.g. "korean_restaurant") where the legacy API only
 * ever says "restaurant, food, establishment".
 */
interface PlaceDetailsResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  googleMapsUri?: string
  primaryType?: string
  types?: string[]
  editorialSummary?: { text: string }
  photos?: { name: string }[]
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
    periods?: {
      open: { day: number; hour: number; minute: number }
      close?: { day: number; hour: number; minute: number }
    }[]
  }
}

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'googleMapsUri',
  'primaryType',
  'types',
  'editorialSummary',
  'photos',
  'regularOpeningHours',
].join(',')

const KEY = process.env.GOOGLE_PLACES_API_KEY?.trim()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function textSearch(query: string, key: string): Promise<PlacesTextSearchResult[]> {
  const out: PlacesTextSearchResult[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 3; page++) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('key', key)
    if (pageToken) {
      url.searchParams.set('pagetoken', pageToken)
    } else {
      url.searchParams.set('query', query)
      url.searchParams.set('location', `${MIDPOINT.lat},${MIDPOINT.lng}`)
      url.searchParams.set('radius', String(SEARCH_RADIUS))
      url.searchParams.set('type', 'restaurant')
    }

    type Body = {
      status: string
      results?: PlacesTextSearchResult[]
      next_page_token?: string
      error_message?: string
    }

    // A fresh next_page_token stays INVALID_REQUEST for a second or two, so
    // paged requests get a few retries before we give up on the extra page.
    let body = (await (await fetch(url)).json()) as Body
    for (let retry = 0; pageToken && body.status === 'INVALID_REQUEST' && retry < 4; retry++) {
      await sleep(1500 * (retry + 1))
      body = (await (await fetch(url)).json()) as Body
    }

    if (body.status === 'ZERO_RESULTS') break
    // Out of pages is not an error — keep whatever the earlier pages returned,
    // but say so rather than silently capping the query at one page.
    if (pageToken && body.status !== 'OK') {
      process.stdout.write(`(page ${page + 1} unavailable: ${body.status}) `)
      break
    }
    if (body.status !== 'OK') {
      throw new Error(`Places textsearch "${query}" failed: ${body.status} ${body.error_message ?? ''}`)
    }

    out.push(...(body.results ?? []))
    if (!body.next_page_token) break
    pageToken = body.next_page_token
    await sleep(2000)
  }

  return out
}

async function placeDetails(placeId: string, key: string): Promise<PlaceDetailsResult | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAIL_FIELDS },
  })
  if (!res.ok) return null
  return (await res.json()) as PlaceDetailsResult
}

function toOpenPeriods(details: PlaceDetailsResult | null): OpenPeriod[] | null {
  const periods = details?.regularOpeningHours?.periods
  if (!periods?.length) return null

  const out: OpenPeriod[] = []
  for (const p of periods) {
    if (!p.open) continue
    const open = p.open.hour * 60 + (p.open.minute ?? 0)
    // No close means open 24h.
    const rawClose = p.close ? p.close.hour * 60 + (p.close.minute ?? 0) : 24 * 60
    // Places that close after midnight report a close time earlier than open.
    const close = rawClose <= open ? rawClose + 24 * 60 : rawClose
    out.push({ day: p.open.day, open, close })
  }
  return out.length ? out : null
}

const CUISINE_RULES: { cuisine: Cuisine; patterns: RegExp }[] = [
  { cuisine: 'Pizza', patterns: /pizz|napoletan|neapolitan|slice|pie\b/i },
  { cuisine: 'Steak', patterns: /steak|chophouse|churrasc|grill house/i },
  { cuisine: 'Seafood', patterns: /seafood|oyster|fish|crab|lobster|clam/i },
  { cuisine: 'Japanese', patterns: /japan|sushi|ramen|izakaya|soba|udon|omakase|yakitori|robata|sake/i },
  { cuisine: 'Korean', patterns: /korean|kbbq|bibimbap|bulgogi|jongro|soju|gogi/i },
  { cuisine: 'Chinese', patterns: /chinese|szechuan|sichuan|dim sum|dumpling|hunan|cantonese|noodle bar|shanghai/i },
  { cuisine: 'Thai', patterns: /thai|siam|bangkok|pad thai/i },
  { cuisine: 'Indian', patterns: /indian|curry|tandoor|masala|bhatti|dosa|biryani|punjab|kebab house/i },
  { cuisine: 'Mexican', patterns: /mexican|taqueria|taco|cantina|mezcal|oaxac|tequila/i },
  { cuisine: 'Vegetarian', patterns: /vegetarian|vegan|plant.based|kajitsu/i },
  { cuisine: 'French', patterns: /french|bistro|brasserie|creperie|parisien/i },
  { cuisine: 'Italian', patterns: /italian|trattoria|osteria|pasta|ristorante|enoteca|cucina/i },
  { cuisine: 'Mediterranean', patterns: /mediterran|greek|turkish|lebanese|israeli|middle.eastern|persian|falafel|tapas|spanish|hummus|mezze/i },
  { cuisine: 'American', patterns: /american|tavern|barbecue|bbq|burger|diner|new_american|gastropub|steak_house|bar_and_grill/i },
]

/**
 * Places (New) `primaryType` values map straight onto our cuisine list, so trust
 * them first and only fall back to name/summary pattern matching.
 */
const PRIMARY_TYPE_TO_CUISINE: Record<string, Cuisine> = {
  italian_restaurant: 'Italian',
  pizza_restaurant: 'Pizza',
  japanese_restaurant: 'Japanese',
  sushi_restaurant: 'Japanese',
  ramen_restaurant: 'Japanese',
  chinese_restaurant: 'Chinese',
  dim_sum_restaurant: 'Chinese',
  thai_restaurant: 'Thai',
  indian_restaurant: 'Indian',
  indonesian_restaurant: 'Other',
  mexican_restaurant: 'Mexican',
  mediterranean_restaurant: 'Mediterranean',
  middle_eastern_restaurant: 'Mediterranean',
  lebanese_restaurant: 'Mediterranean',
  turkish_restaurant: 'Mediterranean',
  greek_restaurant: 'Mediterranean',
  spanish_restaurant: 'Mediterranean',
  tapas_restaurant: 'Mediterranean',
  american_restaurant: 'American',
  hamburger_restaurant: 'American',
  barbecue_restaurant: 'American',
  bar_and_grill: 'American',
  pub: 'American',
  bar: 'American',
  wine_bar: 'American',
  french_restaurant: 'French',
  korean_restaurant: 'Korean',
  korean_barbecue_restaurant: 'Korean',
  steak_house: 'Steak',
  seafood_restaurant: 'Seafood',
  vegetarian_restaurant: 'Vegetarian',
  vegan_restaurant: 'Vegetarian',
  brazilian_restaurant: 'Other',
  vietnamese_restaurant: 'Other',
  afghani_restaurant: 'Other',
  african_restaurant: 'Other',
  brunch_restaurant: 'American',
  breakfast_restaurant: 'American',
  fine_dining_restaurant: 'American',
}

/** Types worth consulting before falling back to the name, most specific first. */
function cuisineFromTypes(primary: string | undefined, types: string[]): Cuisine | null {
  if (primary && PRIMARY_TYPE_TO_CUISINE[primary]) return PRIMARY_TYPE_TO_CUISINE[primary]
  // Skip the generic buckets that every restaurant carries.
  const generic = new Set(['restaurant', 'food', 'point_of_interest', 'establishment'])
  for (const t of types) {
    if (generic.has(t)) continue
    if (PRIMARY_TYPE_TO_CUISINE[t]) return PRIMARY_TYPE_TO_CUISINE[t]
  }
  return null
}

function normalizeCuisine(
  name: string,
  types: string[],
  summary?: string,
  primaryType?: string,
): Cuisine {
  const fromTypes = cuisineFromTypes(primaryType, types)
  // "american_restaurant" and friends are often just a default; let a clearly
  // cuisine-specific name win over those, but never over a specific type.
  const vague = fromTypes === null || fromTypes === 'American' || fromTypes === 'Other'
  if (!vague) return fromTypes

  const haystack = [name, ...types, summary ?? ''].join(' ').replace(/_/g, ' ')
  for (const rule of CUISINE_RULES) {
    if (rule.patterns.test(haystack)) return rule.cuisine
  }
  return fromTypes ?? 'Other'
}

/**
 * Downloads a Place Photo into public/photos and returns the public path.
 *
 * The photo endpoint needs the API key as a query param, so we resolve it here
 * at build time and ship the bytes — putting the signed URL in restaurants.json
 * would leak the key to every visitor.
 */
async function downloadPhoto(
  ref: string,
  placeId: string,
  index: number,
  key: string,
): Promise<string | null> {
  // `ref` is a Places (New) photo resource name: "places/<id>/photos/<photo>".
  const url = new URL(`https://places.googleapis.com/v1/${ref}/media`)
  url.searchParams.set('maxWidthPx', String(PHOTO_WIDTH))
  url.searchParams.set('key', key)

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 1024) return null
    mkdirSync(PHOTO_DIR, { recursive: true })
    const file = `${placeId}-${index}.jpg`
    writeFileSync(resolve(PHOTO_DIR, file), buf)
    return `/photos/${file}`
  } catch {
    return null
  }
}

/**
 * Grabs the first few photos for a place. Google returns them roughly by
 * popularity and they're user-submitted, so the set is usually a mix of dishes,
 * the dining room, and the storefront — which is exactly what we want in the
 * collage. Downloaded in parallel; failures just shorten the set.
 */
async function downloadPhotos(
  photos: { name: string }[] | undefined,
  placeId: string,
  key: string,
): Promise<string[]> {
  if (!photos?.length) return []
  const refs = photos.slice(0, PHOTOS_PER_PLACE)
  const results = await Promise.all(
    refs.map((photo, i) => downloadPhoto(photo.name, placeId, i, key)),
  )
  return results.filter((r): r is string => r !== null)
}

function isChain(name: string): boolean {
  const lower = name.toLowerCase()
  return CHAIN_BLOCKLIST.some((c) => lower.includes(c))
}

async function fromGoogle(key: string): Promise<Restaurant[]> {
  const byId = new Map<string, PlacesTextSearchResult>()

  for (const query of QUERIES) {
    process.stdout.write(`  searching "${query}"… `)
    const results = await textSearch(query, key)
    let added = 0
    for (const r of results) {
      if (!byId.has(r.place_id)) added++
      byId.set(r.place_id, r)
    }
    console.log(`${results.length} results (+${added} new)`)
  }

  console.log(`\n${byId.size} unique places before filtering.`)

  const candidates = [...byId.values()].filter((r) => {
    const loc = r.geometry?.location
    if (!loc || !inBounds(loc)) return false
    if (r.business_status && r.business_status !== 'OPERATIONAL') return false
    if ((r.rating ?? 0) < MIN_RATING) return false
    if ((r.user_ratings_total ?? 0) < MIN_REVIEWS) return false
    if (isChain(r.name)) return false
    const types = r.types ?? []
    if (EXCLUDED_TYPES.some((t) => types.includes(t))) return false
    if (!types.includes('restaurant') && !types.includes('bar') && !types.includes('food')) {
      return false
    }
    return true
  })

  console.log(`${candidates.length} pass the rating / review / corridor filters.`)
  console.log('Fetching details from Places API (New) — cuisine, hours, photos…')

  const out: Restaurant[] = []
  let done = 0
  for (const c of candidates) {
    const details = await placeDetails(c.place_id, key)
    const loc = c.geometry!.location
    // Prefer the New API's specific types; fall back to the search result's.
    const types = details?.types?.length ? details.types : (c.types ?? [])
    const cuisine = normalizeCuisine(
      c.name,
      types,
      details?.editorialSummary?.text,
      details?.primaryType,
    )

    if (++done % 25 === 0) console.log(`  …${done}/${candidates.length}`)

    out.push(
      withWalkTimes({
        place_id: c.place_id,
        name: details?.displayName?.text ?? c.name,
        address: details?.formattedAddress ?? c.formatted_address ?? c.vicinity ?? '',
        lat: loc.lat,
        lng: loc.lng,
        rating: c.rating ?? 0,
        review_count: c.user_ratings_total ?? 0,
        price_level: c.price_level ?? null,
        cuisine,
        maps_url:
          details?.googleMapsUri ??
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}&query_place_id=${c.place_id}`,
        photo_urls: await downloadPhotos(details?.photos, c.place_id, key),
        hours_summary: details?.regularOpeningHours?.weekdayDescriptions ?? null,
        open_periods: toOpenPeriods(details),
        types,
        data_source: 'google' as const,
      }),
    )
  }

  return out
}

function fromSeed(): Restaurant[] {
  return SEED_RESTAURANTS.map((s) =>
    withWalkTimes({
      ...s,
      maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address}`)}`,
      photo_urls: [],
      hours_summary: null,
      open_periods: null,
      data_source: 'seed' as const,
    }),
  )
}

async function main() {
  let restaurants: Restaurant[]

  if (KEY) {
    console.log('GOOGLE_PLACES_API_KEY found — querying Google Places.\n')
    restaurants = await fromGoogle(KEY)
    if (restaurants.length < 10) {
      console.warn(
        `\nOnly ${restaurants.length} places survived filtering; topping up with the seed list.`,
      )
      const seen = new Set(restaurants.map((r) => r.name.toLowerCase()))
      restaurants.push(...fromSeed().filter((s) => !seen.has(s.name.toLowerCase())))
    }
  } else {
    console.log('No GOOGLE_PLACES_API_KEY in .env — writing the hand-written seed list instead.')
    console.log('Add a key to .env and re-run for live ratings, photos, and hours.\n')
    restaurants = fromSeed()
  }

  restaurants.sort((a, b) => b.rating - a.rating || b.review_count - a.review_count)

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, `${JSON.stringify(restaurants, null, 2)}\n`)

  const byCuisine = restaurants.reduce<Record<string, number>>((acc, r) => {
    acc[r.cuisine] = (acc[r.cuisine] ?? 0) + 1
    return acc
  }, {})

  console.log(`\nWrote ${restaurants.length} restaurants to src/data/restaurants.json`)
  console.log(`Corridor: ${BOUNDS.minLat}–${BOUNDS.maxLat} lat, ${BOUNDS.minLng}–${BOUNDS.maxLng} lng`)
  console.log(
    'Cuisines: ' +
      CUISINES.filter((c) => byCuisine[c])
        .map((c) => `${c} ${byCuisine[c]}`)
        .join(', '),
  )
}

main().catch((err) => {
  console.error('\nfetch-restaurants failed:', err.message)
  process.exit(1)
})
