const IDENTIFIER = /^([a-zA-Z]|_+[a-zA-Z0-9])[-\w]*$/

/**
 * Whether the name is a valid DSL identifier (element, deployment node or instance name)
 */
export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER.test(name)
}

/**
 * camelCase ASCII identifier from a title, e.g. `Billing API` → `billingApi`
 */
function slugify(title: string): string {
  const words = title
    .normalize('NFD')
    // strip diacritics
    .replace(/[̀-ͯ]/g, '')
    // apostrophes join words: `It's` → `its`
    .replace(/['’]/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase())
  return words.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

/**
 * Derives a unique identifier from the title, falling back to the kind.
 * Appends `2`, `3`, ... when the name is taken.
 */
export function deriveIdentifier(title: string, kind: string, taken: ReadonlySet<string>): string {
  let base = slugify(title)
  if (!isValidIdentifier(base)) {
    base = isValidIdentifier(kind) ? kind : 'element'
  }
  let name = base
  for (let i = 2; taken.has(name); i++) {
    name = `${base}${i}`
  }
  return name
}
