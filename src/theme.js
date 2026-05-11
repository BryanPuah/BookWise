/**
 * Theme — Figma-aligned palette, original shapes preserved.
 *
 * `covers` keeps its exact shape: an object where each value is a
 * [from, to] gradient tuple. BookCover.js (and anything else that does
 * covers[key].map(...) or destructures the tuple) keeps working.
 *
 * Palette shifts to match the Figma "Modern Library" design:
 *  - Paper: white → soft off-white (#F8F6F2)
 *  - Ink:   near-black → deep midnight navy (#1A1E3A)
 *  - Amber: warm orange-gold → sandy tag gold (#D4B57A) — supporting role
 *  - New:   sage/olive accents for tab pill backgrounds
 */

export const C = {
  // Text — deep midnight navy hierarchy
  ink:        '#1A1E3A',
  inkSoft:    '#3A3E5A',
  inkMuted:   '#6E7188',
  inkFaint:   '#A4A7B8',

  // Surfaces — cool warm-tinted off-white
  paper:      '#F8F6F2',
  cream:      '#EFEAE0',
  creamDark:  '#E5DDD0',
  creamDeep:  '#D9CFBE',

  // Brand — sandy gold (supporting role: tag pills, ratings, highlights)
  amber:      '#D4B57A',
  amberLight: '#E5CFA0',
  amberPale:  '#F0E8D2',

  // Hero card — deep navy gradient (matches new ink)
  heroTop:    '#1A1E3A',
  heroBot:    '#0E1126',

  // Sage / olive — used behind active tab icons in Figma
  sage:       '#7A8B5E',
  sagePale:   '#E8EDD9',

  // Semantic — kept exactly as before
  forest:     '#065F46',
  rose:       '#BE3B3B',
  white:      '#FFFFFF',

  // Borders — slightly stronger than before for the cleaner look
  border:     'rgba(26,30,58,0.10)',
  borderMid:  'rgba(26,30,58,0.16)',
};

// covers — SAME SHAPE AS ORIGINAL: object of [from, to] gradient tuples.
// Values shifted to match the Figma palette. Existing callers
// (e.g. BookCover.js doing covers[key].map(...)) keep working.
export const covers = {
  sage:  ['#7A8B5E', '#4A5A38'],   // olive → deep olive
  amber: ['#D4B57A', '#9C7E3F'],   // sandy gold → deep gold
  navy:  ['#1A1E3A', '#0E1126'],   // midnight navy → near-black
  rose:  ['#A8443F', '#5C2226'],   // muted rose → burgundy
  plum:  ['#6B5076', '#3D2A48'],   // muted plum → deep plum
  slate: ['#475569', '#1E293B'],   // slate → deep slate (unchanged — matches Figma)
};

// Font family tokens — App.js loads these via expo-font.
export const F = {
  serif:       'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
};

// Spacing scale — keep components on a consistent grid
export const SP = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40,
};