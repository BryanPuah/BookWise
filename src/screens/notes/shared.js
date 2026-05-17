/**
 * Shared note-view helpers.
 *
 * Pulled out of NotesScreen.js so every view (Explore / ByBook / ByType /
 * Graph) and NoteCard can import the same constants and utilities without
 * a circular dependency.
 *
 * Note-type meta (label / icon / bg / desc) is built per-render from the
 * active palette — call `useNT()` from a component to get the themed map.
 * Reading `NT` directly is intentionally not supported any more because the
 * old static export froze to whatever theme was loaded first.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { useTheme } from '../../theme';

// `buildNT(C)` is exported so non-component callers (tests, derived
// constants) can construct the map from any palette.
export function buildNT(C) {
  return {
    quote:      { label: 'Quote',      icon: '💬', color: C.ink, bg: C.cream,     desc: 'Direct words from the author' },
    insight:    { label: 'Insight',    icon: '💡', color: C.ink, bg: C.amberPale, desc: 'Your own interpretation or realisation' },
    question:   { label: 'Question',   icon: '🔍', color: C.ink, bg: C.cream,     desc: 'Something you want to investigate further' },
    action:     { label: 'Action',     icon: '✅', color: C.ink, bg: C.sagePale,  desc: 'Something you will apply or do' },
    summary:    { label: 'Summary',    icon: '📌', color: C.ink, bg: C.amberPale, desc: 'Distilled key idea from a chapter' },
    connection: { label: 'Connection', icon: '🔗', color: C.ink, bg: C.sagePale,  desc: 'This idea connects to another book or note' },
  };
}

// Hook that returns a NT map rebuilt when the theme changes.
export function useNT() {
  const { C, themeVersion } = useTheme();
  return useMemo(() => buildNT(C), [themeVersion]);
}

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

// ── Shared empty state with CTA ────────────────────────────────────
// All four notes-views render the same "no notes yet" pattern, so the
// markup lives here. Passing `onCapture` swaps the static copy for an
// actual CTA button that opens the editor — the FAB at the bottom-right
// of the screen is easy to miss for first-time users.
export function NotesEmptyState({ icon, title, sub, onCapture, ctaLabel = 'Capture your first note' }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    icon: { fontSize: 40, marginBottom: 12 },
    title: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6, textAlign: 'center' },
    sub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
    cta: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.sage,
      paddingHorizontal: 18, paddingVertical: 11,
      borderRadius: 14,
      shadowColor: '#000', shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    ctaTxt: { fontFamily: F.serif, fontSize: 14, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.2 },
  }), [themeVersion]);
  return (
    <View style={s.wrap}>
      {icon ? <Text style={s.icon}>{icon}</Text> : null}
      <Text style={s.title}>{title}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
      {onCapture ? (
        <TouchableOpacity
          style={s.cta}
          onPress={onCapture}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" importantForAccessibility="no" />
          <Text style={s.ctaTxt}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
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
