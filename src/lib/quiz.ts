import type { ThisOrThatAnswers } from '../types'

export interface RoundOption {
  value: string
  label: string
  emoji: string
  blurb: string
}

export interface Round {
  key: keyof ThisOrThatAnswers
  question: string
  /** The two ends of the spectrum, shown side by side. */
  options: [RoundOption, RoundOption]
  /** The neutral choice, shown underneath — nobody has to pick an extreme. */
  middle: RoundOption
}

/** Value used by every middle option that just means "no strong opinion". */
export const EITHER = 'either'

const eitherOption = (blurb: string): RoundOption => ({
  value: EITHER,
  label: 'Either is fine',
  emoji: '🤝',
  blurb,
})

/** The this-or-that rounds, in order. Add or remove freely — the quiz adapts. */
export const ROUNDS: Round[] = [
  {
    key: 'service',
    question: 'How are we eating?',
    options: [
      { value: 'sitdown', label: 'Sit-down', emoji: '🍽️', blurb: 'Table service, seated meal' },
      { value: 'casual', label: 'Counter / casual', emoji: '🥢', blurb: 'Counter service or casual seating' },
    ],
    middle: eitherOption('Either style works'),
  },
  {
    key: 'side',
    question: 'Where should it be?',
    options: [
      { value: 'avalon', label: 'Closer to Avalon', emoji: '🚂', blurb: 'Toward Grand Central' },
      { value: 'alex', label: 'Closer to Alex', emoji: '🌳', blurb: 'Toward Stuy Town' },
    ],
    middle: { value: 'center', label: 'Dead center', emoji: '⚖️', blurb: 'Equal walk from both' },
  },
  {
    key: 'style',
    question: 'Classic or trendy?',
    options: [
      { value: 'classic', label: 'Classic', emoji: '🎩', blurb: 'Long-established restaurants' },
      { value: 'trendy', label: 'Trendy', emoji: '✨', blurb: 'Newer, currently popular restaurants' },
    ],
    middle: eitherOption('No preference either way'),
  },
  {
    key: 'pace',
    question: 'How long are we out?',
    options: [
      { value: 'quick', label: 'Quick bite', emoji: '⚡', blurb: 'A short meal' },
      { value: 'long', label: 'Long dinner', emoji: '🍷', blurb: 'A long meal' },
    ],
    middle: eitherOption('However long it takes'),
  },
  {
    key: 'drinks',
    question: 'Do drinks matter?',
    options: [
      { value: 'drinks', label: 'Drinks matter', emoji: '🍸', blurb: 'Favor bars and cocktail lists' },
      { value: 'food', label: 'Food only', emoji: '🍜', blurb: 'Ignore the drinks list' },
    ],
    middle: eitherOption('Drinks are a bonus, not a factor'),
  },
  {
    key: 'fame',
    question: 'Familiar or unknown?',
    options: [
      { value: 'known', label: "Somewhere we've heard of", emoji: '📣', blurb: 'Well-known, heavily reviewed' },
      { value: 'new', label: 'Somewhere new', emoji: '🧭', blurb: 'Fewer reviews, less known' },
    ],
    middle: eitherOption('Either is fine'),
  },
]

export const PRICE_OPTIONS = [
  { value: 1, label: '$', blurb: 'Inexpensive' },
  { value: 2, label: '$$', blurb: 'Moderate' },
  { value: 3, label: '$$$', blurb: 'Expensive' },
  { value: 4, label: '$$$$', blurb: 'Very expensive' },
]

export const CUISINE_EMOJI: Record<string, string> = {
  Italian: '🍝',
  Japanese: '🍣',
  Chinese: '🥟',
  Thai: '🌶️',
  Indian: '🍛',
  Mexican: '🌮',
  Mediterranean: '🫒',
  American: '🍔',
  French: '🥐',
  Korean: '🥘',
  Pizza: '🍕',
  Steak: '🥩',
  Seafood: '🦞',
  Vegetarian: '🥬',
  Other: '🍴',
}

export const MAX_CUISINES = 3
