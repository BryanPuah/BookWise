/**
 * Shared note-view helpers.
 *
 * Pulled out of NotesScreen.js so every view (Explore / ByBook / ByType /
 * Graph) and NoteCard can import the same constants and utilities without
 * a circular dependency.
 *
 * NOTE: The module-level `C` import here is used ONLY by the `NT` constant.
 * Its colors are frozen to the default theme — acceptable trade-off for v1.
 * Components doing their own styling MUST use the `C` returned by
 * `useTheme()` so styles rebuild when the theme changes.
 */

import { C } from '../../theme';

export const NT = {
  quote:      { label: 'Quote',      icon: '💬', color: C.ink, bg: C.cream,     desc: 'Direct words from the author' },
  insight:    { label: 'Insight',    icon: '💡', color: C.ink, bg: C.amberPale, desc: 'Your own interpretation or realisation' },
  question:   { label: 'Question',   icon: '🔍', color: C.ink, bg: C.cream,     desc: 'Something you want to investigate further' },
  action:     { label: 'Action',     icon: '✅', color: C.ink, bg: C.sagePale,  desc: 'Something you will apply or do' },
  summary:    { label: 'Summary',    icon: '📌', color: C.ink, bg: C.amberPale, desc: 'Distilled key idea from a chapter' },
  connection: { label: 'Connection', icon: '🔗', color: C.ink, bg: C.sagePale,  desc: 'This idea connects to another book or note' },
};

// Returns true if `note` carries the given type tag — checks the multi-type
// `types[]` array first, then falls back to the legacy single `type` field.
// Used by all type-filtering / type-grouping code so a note tagged with
// both "insight" and "question" appears under BOTH categories.
export function noteHasType(note, typeKey) {
  if (Array.isArray(note.types) && note.types.includes(typeKey)) return true;
  return note.type === typeKey;
}

export function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

// Visual accent for each note type — drives the left stripe color and the
// type chip tint so the eye can sort cards by category at a glance. Takes
// the active palette so colors track theme changes.
export function typeAccent(typeKey, C) {
  switch (typeKey) {
    case 'quote':      return { stripe: C.ink,    chipBg: C.cream,    chipInk: C.ink };
    case 'insight':    return { stripe: C.amber,  chipBg: C.amberPale, chipInk: C.ink };
    case 'question':   return { stripe: C.amber,  chipBg: C.amberPale, chipInk: C.ink };
    case 'action':     return { stripe: C.sage,   chipBg: C.sagePale,  chipInk: C.ink };
    case 'summary':    return { stripe: C.amber,  chipBg: C.amberPale, chipInk: C.ink };
    case 'connection': return { stripe: C.sage,   chipBg: C.sagePale,  chipInk: C.ink };
    default:           return { stripe: C.inkMuted, chipBg: C.cream,   chipInk: C.ink };
  }
}
