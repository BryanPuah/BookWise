/**
 * Theme — Figma-aligned palette with 10 Todoist-style accent themes.
 *
 * The exported `C` (palette) and `covers` (gradient tuples) objects are
 * stable references — they're mutated in place when the active theme
 * changes so existing imports keep working. The active theme is read
 * via the `useTheme()` hook, which subscribes the calling component to
 * theme changes and returns a bumped `themeVersion` counter so styles
 * can re-create via useMemo:
 *
 *   const { C, F, themeVersion } = useTheme();
 *   const s = useMemo(() => StyleSheet.create({
 *     safe: { backgroundColor: C.paper },
 *   }), [themeVersion]);
 *
 * `setTheme(name)` mutates `C` + `covers` in place and notifies all
 * subscribers (components that called `useTheme()`).
 */

import { useEffect, useReducer } from 'react';

// ── Static design tokens (never theme-dependent) ───────────────────────
export const F = {
  serif:       'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
};

export const SP = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40,
};

// ── Theme registry — 10 Todoist-style accent palettes ──────────────────
// Each theme keeps the same paper/ink/cream surface tones (so reading
// surfaces stay calm). Only the accent (sage), accent-soft (sagePale),
// highlight (amber), highlight-soft (amberPale), and hero gradient
// change. `rose` (semantic error) also stays constant.
const SURFACE_BASE = {
  ink:        '#1A1E3A',
  inkSoft:    '#3A3E5A',
  inkMuted:   '#6E7188',
  inkFaint:   '#A4A7B8',

  paper:      '#F8F6F2',
  cream:      '#EFEAE0',
  creamDark:  '#E5DDD0',
  creamDeep:  '#D9CFBE',

  forest:     '#065F46',
  rose:       '#BE3B3B',
  white:      '#FFFFFF',

  border:     'rgba(26,30,58,0.10)',
  borderMid:  'rgba(26,30,58,0.16)',
};

// Each accent theme defines:
//   accent       — primary accent (replaces "sage")
//   accentPale   — soft accent pill backgrounds (replaces "sagePale")
//   accentDeep   — darker variant for gradients (cover "navy" replacement)
//   highlight    — secondary highlight (replaces "amber")
//   highlightPale — soft highlight pill bg (replaces "amberPale")
//   highlightLight — mid highlight tone (replaces "amberLight")
//   coverNavy    — primary book cover gradient top
//
// Names roughly follow Todoist's palette ordering.
export const THEMES = {
  olive: {
    label: 'Olive',
    swatch: '#7A8B5E',
    accent: '#7A8B5E', accentPale: '#E8EDD9', accentDeep: '#4A5A38',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#1A1E3A', heroBot: '#0E1126',
  },
  berry: {
    label: 'Berry Red',
    swatch: '#B7295A',
    accent: '#B7295A', accentPale: '#F8DEE7', accentDeep: '#7A1A3D',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#3A1A2A', heroBot: '#1F0E18',
  },
  red: {
    label: 'Red',
    swatch: '#D1453B',
    accent: '#D1453B', accentPale: '#FADBD8', accentDeep: '#8A2A22',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#3A1818', heroBot: '#1F0C0C',
  },
  orange: {
    label: 'Orange',
    swatch: '#D97706',
    accent: '#D97706', accentPale: '#FCE4C7', accentDeep: '#8C4A04',
    highlight: '#7A8B5E', highlightPale: '#E8EDD9', highlightLight: '#A8B584',
    heroTop: '#3A2410', heroBot: '#1F1408',
  },
  yellow: {
    label: 'Yellow',
    swatch: '#C7A53A',
    accent: '#C7A53A', accentPale: '#F4ECC8', accentDeep: '#866C1F',
    highlight: '#7A8B5E', highlightPale: '#E8EDD9', highlightLight: '#A8B584',
    heroTop: '#2E2818', heroBot: '#181408',
  },
  forest: {
    label: 'Forest',
    swatch: '#1F7A4D',
    accent: '#1F7A4D', accentPale: '#D5EBDF', accentDeep: '#0F4A2C',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#0F2A20', heroBot: '#081410',
  },
  teal: {
    label: 'Teal',
    swatch: '#0F8B8D',
    accent: '#0F8B8D', accentPale: '#CDEDED', accentDeep: '#0A5A5B',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#0D2A2A', heroBot: '#061515',
  },
  sky: {
    label: 'Sky Blue',
    swatch: '#3A8DC4',
    accent: '#3A8DC4', accentPale: '#D8E8F4', accentDeep: '#1F5A82',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#152838', heroBot: '#0A141C',
  },
  indigo: {
    label: 'Indigo',
    swatch: '#5B5FA8',
    accent: '#5B5FA8', accentPale: '#DDDEEF', accentDeep: '#3A3D70',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#1A1E3A', heroBot: '#0E1126',
  },
  plum: {
    label: 'Plum',
    swatch: '#8B5076',
    accent: '#8B5076', accentPale: '#EBDAE3', accentDeep: '#5A3349',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#2A1A24', heroBot: '#150C12',
  },
  charcoal: {
    label: 'Charcoal',
    swatch: '#475569',
    accent: '#475569', accentPale: '#D9DEE5', accentDeep: '#1E293B',
    highlight: '#D4B57A', highlightPale: '#F0E8D2', highlightLight: '#E5CFA0',
    heroTop: '#1A1E3A', heroBot: '#0E1126',
  },
};

export const DEFAULT_THEME = 'olive';

// Build the palette object for a named theme. Existing call sites read
// `sage`, `sagePale`, `amber`, `amberPale`, `amberLight`, `heroTop`,
// `heroBot` — we map the theme's accent/highlight tokens into those
// legacy keys so we don't have to rename every reference in the app.
function buildPalette(themeName) {
  const t = THEMES[themeName] || THEMES[DEFAULT_THEME];
  return {
    ...SURFACE_BASE,
    sage:        t.accent,
    sagePale:    t.accentPale,
    amber:       t.highlight,
    amberPale:   t.highlightPale,
    amberLight:  t.highlightLight,
    heroTop:     t.heroTop,
    heroBot:     t.heroBot,
  };
}

function buildCovers(themeName) {
  const t = THEMES[themeName] || THEMES[DEFAULT_THEME];
  return {
    sage:  [t.accent, t.accentDeep],
    amber: [t.highlight, '#9C7E3F'],
    navy:  [t.heroTop, t.heroBot],
    rose:  ['#A8443F', '#5C2226'],
    plum:  ['#6B5076', '#3D2A48'],
    slate: ['#475569', '#1E293B'],
  };
}

// ── Mutable singletons exported to the app ─────────────────────────────
// `C` and `covers` are stable object references — we mutate them in
// place via Object.assign so module-level imports keep working. Modules
// that destructured `{ heroTop }` etc. at import time would break, so
// the codebase reads via `C.heroTop` (which we verified before this).
let _themeName = DEFAULT_THEME;
let _themeVersion = 0;

export const C = buildPalette(_themeName);
export const covers = buildCovers(_themeName);

const listeners = new Set();

export function getThemeName() {
  return _themeName;
}

export function setTheme(name) {
  if (!THEMES[name] || name === _themeName) return;
  _themeName = name;
  _themeVersion++;
  // Mutate in place so every existing import keeps the same reference
  const nextC = buildPalette(name);
  const nextCovers = buildCovers(name);
  Object.keys(C).forEach(k => { if (!(k in nextC)) delete C[k]; });
  Object.assign(C, nextC);
  Object.keys(covers).forEach(k => { if (!(k in nextCovers)) delete covers[k]; });
  Object.assign(covers, nextCovers);
  // Notify all subscribed components
  listeners.forEach(fn => fn());
}

// ── React hook ─────────────────────────────────────────────────────────
// Components call `useTheme()` to subscribe to theme changes. The
// returned `themeVersion` is a number that increments on each change;
// pass it as a useMemo dependency to rebuild StyleSheets:
//
//   const { C, F, themeVersion } = useTheme();
//   const s = useMemo(() => StyleSheet.create({...}), [themeVersion]);
//
// If you don't need to react to theme changes (rare — most styles use
// at least one color from C), you can keep using the static `C` import
// directly, but those styles will not update on theme switch.
export function useTheme() {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  useEffect(() => {
    listeners.add(forceUpdate);
    return () => { listeners.delete(forceUpdate); };
  }, []);
  return {
    C,
    F,
    SP,
    covers,
    themeName: _themeName,
    themeVersion: _themeVersion,
    setTheme,
    themes: THEMES,
  };
}
