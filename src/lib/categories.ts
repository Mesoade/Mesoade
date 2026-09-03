/**
 * The optional "what is this?" tag captured at upload time, used to let
 * visitors browse the wall by theme.
 *
 * Deliberately a closed list rather than free text: free tags would be another
 * surface the moderator has to police, and a fixed set keeps the filter UI
 * meaningful. Adding a value later is an additive change -- the column stores
 * the id string, so old rows keep working.
 */
export const CATEGORIES = [
  { id: 'memorial', label: 'Memorial' },
  { id: 'person', label: 'A person' },
  { id: 'family', label: 'Family' },
  { id: 'pet', label: 'Pet' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'business', label: 'Business' },
  { id: 'art', label: 'Art' },
  { id: 'travel', label: 'Travel' },
  { id: 'joke', label: 'Joke' },
  { id: 'other', label: 'Something else' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

const IDS = new Set<string>(CATEGORIES.map((c) => c.id))

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && IDS.has(value)
}

export function categoryLabel(id: string | null): string | null {
  return CATEGORIES.find((c) => c.id === id)?.label ?? null
}
