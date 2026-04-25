export const PRODUCT_COLORS = [
  { name: 'Black',  hex: '#111111' },
  { name: 'White',  hex: '#ffffff' },
  { name: 'Red',    hex: '#e53e3e' },
  { name: 'Blue',   hex: '#3182ce' },
  { name: 'Green',  hex: '#38a169' },
  { name: 'Yellow', hex: '#ecc94b' },
  { name: 'Brown',  hex: '#7B3F00' },
  { name: 'Pink',   hex: '#ed64a6' },
  { name: 'Grey',   hex: '#718096' },
  { name: 'Navy',   hex: '#1a2340' },
  { name: 'Orange', hex: '#FF6B00' },
]

/** Quick lookup: color name → hex. Falls back to #ccc for unknown names. */
export const COLOR_MAP = Object.fromEntries(
  PRODUCT_COLORS.map(({ name, hex }) => [name, hex])
)
