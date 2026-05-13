/**
 * Theme — Figma-aligned palette, Substack-style accent + background pickers.
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
 * Two independent axes:
 *   • `setAccent(name)`     — accent color (buttons/links/swatches)
 *   • `setBackground(name)` — page background + surface tones
 *
 * `setTheme(name)` is kept as an alias for `setAccent(name)` for
 * backward compatibility with any external callers.
 */

import { useEffect, useReducer } from 'react';
import { Platform } from 'react-native';

// ── Static design tokens (never theme-dependent) ───────────────────────
// `serif` is the reading face (DM Serif Display, loaded via expo-google-fonts).
// `sans` is the chrome face — small uppercase labels, form inputs, tab bar.
// Writing in a display serif at 10–11px is eye-strain territory, so anything
// label-like or input-like gets the system sans fallback (SF on iOS, Roboto
// on Android) for legibility.
export const F = {
  serif:       'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
  sans:        Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

export const SP = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40,
};

// ── Ink + semantic tokens ──────────────────────────────────────────────
// Two ink palettes — light (dark ink on paper) and dark (light ink on
// near-black surfaces). The active mode is chosen by `_mode` and applied
// in `buildPalette()`.
const LIGHT_INK = {
  ink:        '#1A1E3A',
  inkSoft:    '#3A3E5A',
  inkMuted:   '#6E7188',
  inkFaint:   '#A4A7B8',

  forest:     '#065F46',
  rose:       '#BE3B3B',

  border:     'rgba(26,30,58,0.10)',
  borderMid:  'rgba(26,30,58,0.16)',
};

const DARK_INK = {
  ink:        '#ECEDF5',
  inkSoft:    '#C3C6D8',
  inkMuted:   '#9094AC',
  inkFaint:   '#5C5F76',

  forest:     '#34D399',
  rose:       '#F87171',

  border:     'rgba(236,237,245,0.10)',
  borderMid:  'rgba(236,237,245,0.18)',
};

// Dark surface palette — used when `_mode === 'dark'`. Replaces whichever
// background swatch the user picked; the swatch picker remembers their
// light-mode choice so flipping back restores it.
const DARK_SURFACES = {
  label: 'Dark',
  swatch: '#1A1B26',
  paper: '#15161F', cream: '#1F2030', creamDark: '#2A2C40', creamDeep: '#383B54',
  white: '#1F2030',
};

// ── Background registry — Substack-style paper tones ───────────────────
// Each background defines the surface palette (paper/cream/white). Ink
// colors stay constant across backgrounds (all are light surfaces).
//   paper      — main scroll background
//   cream      — secondary surfaces (switch off, soft pills)
//   creamDark  — slightly deeper cream variant
//   creamDeep  — deepest cream variant
//   white      — card background (subtly lighter than paper)
export const BACKGROUNDS = {
  paper: {
    label: 'Paper',
    swatch: '#F8F6F2',
    paper: '#F8F6F2', cream: '#EFEAE0', creamDark: '#E5DDD0', creamDeep: '#D9CFBE',
    white: '#FFFFFF',
  },
  white: {
    label: 'Pure White',
    swatch: '#FFFFFF',
    paper: '#FFFFFF', cream: '#F2F2F0', creamDark: '#E5E5E0', creamDeep: '#D9D9D0',
    white: '#FAFAF8',
  },
  cream: {
    label: 'Cream',
    swatch: '#F4ECD8',
    paper: '#F4ECD8', cream: '#EBE2C8', creamDark: '#E0D6B6', creamDeep: '#D4C9A0',
    white: '#FBF6E7',
  },
  mist: {
    label: 'Mist',
    swatch: '#F0F2F5',
    paper: '#F0F2F5', cream: '#E5E8ED', creamDark: '#D8DCE4', creamDeep: '#C9CFD9',
    white: '#FAFBFD',
  },
  linen: {
    label: 'Linen',
    swatch: '#EFE6D9',
    paper: '#EFE6D9', cream: '#E5DBC7', creamDark: '#D8CDB4', creamDeep: '#C8BCA0',
    white: '#F9F3E8',
  },
  mint: {
    label: 'Mint',
    swatch: '#E8EFEA',
    paper: '#E8EFEA', cream: '#DCE6DE', creamDark: '#CADBCD', creamDeep: '#B5CBB9',
    white: '#F4F8F5',
  },
  blush: {
    label: 'Blush',
    swatch: '#F4E8E6',
    paper: '#F4E8E6', cream: '#EBDCD9', creamDark: '#DCCAC5', creamDeep: '#C9B2AC',
    white: '#FBF3F1',
  },
  lavender: {
    label: 'Lavender',
    swatch: '#ECEAF2',
    paper: '#ECEAF2', cream: '#DFDCE8', creamDark: '#CCC8DA', creamDeep: '#B5AFC8',
    white: '#F7F5FB',
  },
};

export const DEFAULT_BACKGROUND = 'paper';

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

// Build the palette object from an accent theme + a background. Existing
// call sites read `sage`, `sagePale`, `amber`, `amberPale`, `amberLight`,
// `heroTop`, `heroBot`, `paper`, `cream`, etc. — we map the active
// accent + background into those legacy keys so we don't have to rename
// every reference in the app.
function buildPalette(themeName, backgroundName, mode) {
  const t = THEMES[themeName] || THEMES[DEFAULT_THEME];
  const isDark = mode === 'dark';
  const b = isDark
    ? DARK_SURFACES
    : (BACKGROUNDS[backgroundName] || BACKGROUNDS[DEFAULT_BACKGROUND]);
  const ink = isDark ? DARK_INK : LIGHT_INK;
  // In dark mode, pale pill/badge backgrounds (sagePale/amberPale) and
  // mid-tones (amberLight) are replaced with a fixed dark surface tint
  // so chips stay readable against the light ink. Without this, pills
  // like `bg: C.amberPale + color: C.ink` blow out — a pale cream chip
  // with near-white text. The fixed tint is the same across every
  // accent, so pill appearance is consistent app-wide in dark mode.
  return {
    ...ink,
    paper:       b.paper,
    cream:       b.cream,
    creamDark:   b.creamDark,
    creamDeep:   b.creamDeep,
    white:       b.white,
    sage:        t.accent,
    sagePale:    isDark ? '#2A2C40' : t.accentPale,
    amber:       t.highlight,
    amberPale:   isDark ? '#2A2C40' : t.highlightPale,
    amberLight:  isDark ? '#383B54' : t.highlightLight,
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
let _backgroundName = DEFAULT_BACKGROUND;
let _mode = 'light';
let _themeVersion = 0;

export const C = buildPalette(_themeName, _backgroundName, _mode);
export const covers = buildCovers(_themeName);

const listeners = new Set();

export function getThemeName() {
  return _themeName;
}

export function getBackgroundName() {
  return _backgroundName;
}

export function getMode() {
  return _mode;
}

function notify() {
  _themeVersion++;
  listeners.forEach(fn => fn());
}

function rebuildPalette() {
  const nextC = buildPalette(_themeName, _backgroundName, _mode);
  Object.keys(C).forEach(k => { if (!(k in nextC)) delete C[k]; });
  Object.assign(C, nextC);
}

export function setAccent(name) {
  if (!THEMES[name] || name === _themeName) return;
  _themeName = name;
  rebuildPalette();
  const nextCovers = buildCovers(name);
  Object.keys(covers).forEach(k => { if (!(k in nextCovers)) delete covers[k]; });
  Object.assign(covers, nextCovers);
  notify();
}

export function setBackground(name) {
  if (!BACKGROUNDS[name] || name === _backgroundName) return;
  _backgroundName = name;
  rebuildPalette();
  notify();
}

// Toggle between light and dark mode. The user's chosen background swatch
// is preserved across the flip — when they return to light, their last
// paper tone comes back.
export function setMode(name) {
  if (name !== 'light' && name !== 'dark') return;
  if (name === _mode) return;
  _mode = name;
  rebuildPalette();
  notify();
}

// Back-compat alias — older callers used setTheme() for the accent.
export const setTheme = setAccent;

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
    backgroundName: _backgroundName,
    mode: _mode,
    themeVersion: _themeVersion,
    setTheme,
    setAccent,
    setBackground,
    setMode,
    themes: THEMES,
    backgrounds: BACKGROUNDS,
  };
}
