/**
 * ExploreView — flat browse over every note, refined by sort + type + tag.
 *
 * Full-text search lives in the global AppHeader search modal; this view
 * is where you *refine* a known scope — pick a type, pick a tag, choose
 * how to sort. Virtualised via FlatList so libraries of several hundred
 * notes scroll smoothly.
 */

import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { useTheme } from '../../theme';
import { NoteCard } from './NoteCard';
import { useNT, noteHasType } from './shared';

const SORTS = [
  { key: 'recent',  label: 'Recent' },
  { key: 'oldest',  label: 'Oldest' },
  { key: 'az',      label: 'A→Z' },
  { key: 'starred', label: 'Starred' },
];

export function ExploreView({ notes, books, onStar, onDelete, onEdit, onCapture }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
  const ev = useMemo(() => StyleSheet.create({
    refineWrap: { paddingTop: 4, marginBottom: 6 },
    refineRow: { marginBottom: 10 },
    refineLabel: {
      fontFamily: F.sans, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1, marginBottom: 6,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
    },
    chipActive: { backgroundColor: C.sage, borderColor: C.sage },
    chipTxt:    { fontFamily: F.serif, fontSize: 12, color: C.inkSoft, fontWeight: '600' },
    // Fixed white — `C.white` collapses to a dark surface in dark mode,
    // which would render label-on-accent invisible. The accent palette
    // is tuned for AA contrast against pure white in both modes.
    chipTxtActive: { color: '#FFFFFF', fontWeight: '700' },
    chipIcon: { fontSize: 11 },

    emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 30 },
    emptyStateTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6, textAlign: 'center' },
    emptyStateSub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
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

  const [activeType, setActiveType] = useState(null);
  const [activeTag,  setActiveTag]  = useState(null);
  const [sort,       setSort]       = useState('recent');

  // Unique tags across all notes, sorted by frequency so the most useful
  // ones surface first. Cap at 24 chips to avoid scroll-jacking on dense libraries.
  const tagCounts = useMemo(() => {
    const counts = new Map();
    notes.forEach(n => {
      (n.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24);
  }, [notes]);

  // Type counts — only show chips for types that have at least one note.
  // Sorting by NT key order keeps the visual order stable across renders.
  const typeCounts = useMemo(() => {
    return Object.entries(NT).reduce((acc, [key, meta]) => {
      const c = notes.filter(n => noteHasType(n, key)).length;
      if (c > 0) acc.push({ key, meta, count: c });
      return acc;
    }, []);
  }, [notes, NT]);

  const filtered = useMemo(() => {
    let list = notes;
    if (activeType) list = list.filter(n => noteHasType(n, activeType));
    if (activeTag)  list = list.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag));

    switch (sort) {
      case 'oldest':
        return [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
      case 'az':
        return [...list].sort((a, b) => {
          const at = (a.title || a.text || '').toLowerCase();
          const bt = (b.title || b.text || '').toLowerCase();
          return at.localeCompare(bt);
        });
      case 'starred':
        // Starred first, then most-recent within each group.
        return [...list].sort((a, b) => {
          if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
          return new Date(b.date) - new Date(a.date);
        });
      case 'recent':
      default:
        return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  }, [notes, activeType, activeTag, sort]);

  const header = (
    <View style={ev.refineWrap}>
      {/* Sort */}
      <View style={ev.refineRow}>
        <Text style={ev.refineLabel}>SORT</Text>
        <View style={ev.chipsRow}>
          {SORTS.map(opt => {
            const active = sort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[ev.chip, active && ev.chipActive]}
                onPress={() => setSort(opt.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Sort by ${opt.label}`}
              >
                <Text style={[ev.chipTxt, active && ev.chipTxtActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Type filter — only renders if at least one note has a typed type.
          Tap a chip to filter to that type, tap again to clear. */}
      {typeCounts.length > 0 && (
        <View style={ev.refineRow}>
          <Text style={ev.refineLabel}>TYPE</Text>
          <View style={ev.chipsRow}>
            {typeCounts.map(({ key, meta, count }) => {
              const active = activeType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[ev.chip, active && ev.chipActive]}
                  onPress={() => setActiveType(active ? null : key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter by ${meta.label}, ${count} notes`}
                >
                  <Text style={ev.chipIcon}>{meta.icon}</Text>
                  <Text style={[ev.chipTxt, active && ev.chipTxtActive]}>
                    {meta.label} · {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Tag filter */}
      {tagCounts.length > 0 && (
        <View style={ev.refineRow}>
          <Text style={ev.refineLabel}>TAGS</Text>
          <View style={ev.chipsRow}>
            {tagCounts.map(([tag, count]) => {
              const active = activeTag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[ev.chip, active && ev.chipActive]}
                  onPress={() => setActiveTag(active ? null : tag)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter by tag ${tag}, ${count} notes`}
                >
                  <Text style={[ev.chipTxt, active && ev.chipTxtActive]}>
                    #{tag} · {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const isFiltered = !!activeType || !!activeTag;

  return (
    <FlatList
      data={filtered}
      keyExtractor={n => n.id}
      renderItem={({ item }) => (
        <NoteCard note={item} onDelete={onDelete} onEdit={onEdit} onStar={onStar} showBook />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={ev.emptyState}>
          <Text style={ev.emptyStateTitle}>
            {isFiltered ? 'No notes match those filters' : 'No notes yet'}
          </Text>
          <Text style={ev.emptyStateSub}>
            {isFiltered
              ? 'Try clearing a filter chip above.'
              : 'Capture a quote, an insight, or a question — they\'ll all live here.'}
          </Text>
          {!isFiltered && onCapture ? (
            <TouchableOpacity
              style={ev.cta}
              onPress={onCapture}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Capture your first note"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" importantForAccessibility="no" />
              <Text style={ev.ctaTxt}>Capture your first note</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
      ListFooterComponent={<View style={{ height: 140 }} />}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={11}
      maxToRenderPerBatch={8}
    />
  );
}
