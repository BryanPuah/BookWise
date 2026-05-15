/**
 * ExploreView — flat browse over every note, filterable by tag and
 * full-text searchable. Virtualised via FlatList so a library of several
 * hundred notes scrolls smoothly.
 */

import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { useTheme } from '../../theme';
import { NoteCard } from './NoteCard';

export function ExploreView({ notes, books, onStar, onDelete, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const ev = useMemo(() => StyleSheet.create({
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.cream,
      borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      marginTop: 8, marginBottom: 14,
      gap: 10,
    },
    search: { flex: 1, fontFamily: F.sans, fontSize: 15, color: C.ink },
    emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 30 },
    emptyStateTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6, textAlign: 'center' },
    emptyStateSub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },

    tagFilterWrap: {
      marginBottom: 10,
    },
    tagFilterLabel: {
      fontFamily: F.sans, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1, marginBottom: 6,
    },
    tagFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagFilterChip: {
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
    },
    tagFilterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
    tagFilterChipTxt: { fontFamily: F.serif, fontSize: 12, color: C.inkSoft, fontWeight: '600' },
    tagFilterChipTxtActive: { color: C.white },
  }), [themeVersion]);

  const [search, setSearch] = useState('');
  // Active tag filter — single-select keeps the UI calm. Tap again to clear.
  const [activeTag, setActiveTag] = useState(null);

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

  const filtered = useMemo(() => {
    let list = notes;

    if (activeTag) {
      list = list.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.text || '').toLowerCase().includes(q) ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.thinking || '').toLowerCase().includes(q) ||
        (n.bookTitle || '').toLowerCase().includes(q) ||
        (n.chapter || '').toLowerCase().includes(q) ||
        (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Sort: starred first, then most recent
    return [...list.filter(n => n.starred), ...list.filter(n => !n.starred)]
      .sort((a, b) => {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
      });
  }, [notes, search, activeTag]);

  const header = (
    <>
      <View style={ev.searchWrap}>
        <Ionicons name="search" size={16} color={C.inkMuted} />
        <TextInput style={ev.search} value={search} onChangeText={setSearch}
          placeholder="Search your notes…"
          placeholderTextColor={C.inkFaint} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {tagCounts.length > 0 && (
        <View style={ev.tagFilterWrap}>
          <Text style={ev.tagFilterLabel}>FILTER BY TAG</Text>
          <View style={ev.tagFilterRow}>
            {tagCounts.map(([tag, count]) => {
              const active = activeTag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[ev.tagFilterChip, active && ev.tagFilterChipActive]}
                  onPress={() => setActiveTag(active ? null : tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[ev.tagFilterChipTxt, active && ev.tagFilterChipTxtActive]}>
                    #{tag} · {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={n => n.id}
      renderItem={({ item }) => (
        <NoteCard note={item} onDelete={onDelete} onEdit={onEdit} showBook />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={ev.emptyState}>
          <Text style={ev.emptyStateTitle}>
            {search ? 'No notes match your search' : 'No notes yet'}
          </Text>
          <Text style={ev.emptyStateSub}>
            {search ? 'Try different keywords'
              : 'Tap the + button below to capture your first thought'}
          </Text>
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
