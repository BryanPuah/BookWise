/**
 * GlobalSearchModal — full-screen search across notes, books, reflections.
 *
 * Opened from the search icon in AppHeader. Lives in AppHeader so any screen
 * that renders the header gets search for free. Navigation between result
 * types is handled here via the React Navigation root context.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, TouchableOpacity, Modal, ScrollView,
  StyleSheet, Image, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { BookCover } from './BookCover';

// Strip markdown delimiters so previews read cleanly in the result row.
function plain(text) {
  return (text || '')
    .replace(/\*\*|__|==|\*/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build a single searchable string for a note — title + body + thinking +
// every block's text + custom tags. Lowercased once so each keystroke just
// runs `includes` on the prebuilt haystack.
function noteHaystack(n) {
  let parts = [n.title, n.text, n.thinking, n.bookTitle, n.chapter];
  if (Array.isArray(n.blocks)) {
    n.blocks.forEach(b => { if (b && typeof b.text === 'string') parts.push(b.text); });
  }
  if (Array.isArray(n.tags)) parts = parts.concat(n.tags);
  return parts.filter(Boolean).join('  ').toLowerCase();
}

function bookHaystack(b) {
  return [b.title, b.author, b.genre].filter(Boolean).join('  ').toLowerCase();
}

function reflectionHaystack(r) {
  return (r.text || '').toLowerCase();
}

export function GlobalSearchModal({ visible, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const { notes, books, reflections } = useStore();
  const navigation = useNavigation();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');

  // Refocus on every open. Auto-focus prop on the TextInput is unreliable
  // inside a Modal — explicit focus after mount works on both platforms.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), Platform.OS === 'ios' ? 250 : 80);
    return () => clearTimeout(t);
  }, [visible]);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.cream,
      borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    input: { flex: 1, fontFamily: F.sans, fontSize: 15, color: C.ink, padding: 0 },
    cancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
    cancelTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontWeight: '600' },

    scrollBody: { paddingBottom: 60 },

    sectionHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
    },
    sectionTitle: {
      fontFamily: F.sans, fontSize: 11, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1.2,
    },
    sectionCount: {
      fontFamily: F.sans, fontSize: 11, fontWeight: '700',
      color: C.inkFaint, letterSpacing: 0.8,
    },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    rowIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.cream,
    },
    rowBody: { flex: 1 },
    rowTitle: { fontFamily: F.serif, fontSize: 15, color: C.ink, letterSpacing: -0.2 },
    rowSub: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 2 },
    rowChevron: { opacity: 0.6 },

    empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
    emptyTitle: { fontFamily: F.serif, fontSize: 17, color: C.ink, marginBottom: 6, textAlign: 'center' },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },

    hint: {
      paddingHorizontal: 20, paddingTop: 16,
      fontFamily: F.serif, fontSize: 13, color: C.inkMuted, lineHeight: 20,
    },
  }), [themeVersion]);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;

  // Per-note / per-book / per-reflection haystacks are memoised against
  // their owning entity object. A keystroke now runs a flat `includes`
  // against precomputed strings; only an actual item edit invalidates
  // the cached haystack and forces a rebuild. A WeakMap keyed on the
  // entity object lets the JS engine drop the cache row when the entity
  // is replaced or evicted.
  const haystackCacheRef = useRef({
    notes:       new WeakMap(),
    books:       new WeakMap(),
    reflections: new WeakMap(),
  });
  const cachedHaystack = (cache, item, build) => {
    const hit = cache.get(item);
    if (hit !== undefined) return hit;
    const h = build(item);
    cache.set(item, h);
    return h;
  };

  const results = useMemo(() => {
    if (!hasQuery) return { notes: [], books: [], reflections: [] };
    const cache = haystackCacheRef.current;
    const nHits = notes
      .filter(n => cachedHaystack(cache.notes, n, noteHaystack).includes(q))
      .slice(0, 20);
    const bHits = books
      .filter(b => cachedHaystack(cache.books, b, bookHaystack).includes(q))
      .slice(0, 20);
    const rHits = reflections
      .filter(r => cachedHaystack(cache.reflections, r, reflectionHaystack).includes(q))
      .slice(0, 20);
    return { notes: nHits, books: bHits, reflections: rHits };
  }, [q, hasQuery, notes, books, reflections]);

  const totalHits = results.notes.length + results.books.length + results.reflections.length;

  const goto = (action) => {
    onClose();
    // Defer until the modal close animation has started so the destination
    // screen renders without a janky transition.
    setTimeout(action, Platform.OS === 'ios' ? 240 : 0);
  };

  const openNote = (note) =>
    goto(() => navigation.navigate('Notes', { editNoteId: note.id, _t: Date.now() }));

  const openBook = (book) =>
    goto(() => navigation.navigate('Library', {
      screen: 'BookDetail',
      params: { bookId: book.id },
    }));

  const openReflection = (reflection) =>
    goto(() => navigation.navigate('Library', {
      screen: 'LibraryHome',
      params: { reflectionDate: reflection.date, _t: Date.now() },
    }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Modals on iOS create a separate React tree that doesn't inherit
          the app-root SafeAreaProvider context. We provide our own here so
          the inner SafeAreaView correctly reads the device's notch insets. */}
      <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <View style={s.inputWrap}>
            <Ionicons name="search" size={16} color={C.inkMuted} />
            <TextInput
              ref={inputRef}
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes, books, reflections…"
              placeholderTextColor={C.inkFaint}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={C.inkMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={s.cancelBtn} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {!hasQuery && (
            <Text style={s.hint}>
              Search across every note, book, and reflection in your library.
            </Text>
          )}

          {hasQuery && totalHits === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No matches</Text>
              <Text style={s.emptySub}>
                Try a different word — search looks inside note bodies, book metadata, and reflection text.
              </Text>
            </View>
          )}

          {results.notes.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>NOTES</Text>
                <Text style={s.sectionCount}>{results.notes.length}</Text>
              </View>
              {results.notes.map(n => {
                const title = plain(n.title) || plain(n.text).slice(0, 80) || 'Untitled note';
                const sub = [n.bookTitle, n.chapter ? `Ch. ${n.chapter}` : null]
                  .filter(Boolean).join(' · ');
                return (
                  <TouchableOpacity key={n.id} style={s.row} activeOpacity={0.6} onPress={() => openNote(n)}>
                    <View style={s.rowIcon}>
                      <Ionicons name="reader-outline" size={18} color={C.inkSoft} />
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
                      {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.inkFaint} style={s.rowChevron} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {results.books.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>BOOKS</Text>
                <Text style={s.sectionCount}>{results.books.length}</Text>
              </View>
              {results.books.map(b => (
                <TouchableOpacity key={b.id} style={s.row} activeOpacity={0.6} onPress={() => openBook(b)}>
                  <BookCover title={b.title} author={b.author} cover={b.cover}
                    coverId={b.coverId} width={36} height={48} />
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle} numberOfLines={1}>{b.title}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{b.author || '—'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.inkFaint} style={s.rowChevron} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {results.reflections.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>REFLECTIONS</Text>
                <Text style={s.sectionCount}>{results.reflections.length}</Text>
              </View>
              {results.reflections.map(r => (
                <TouchableOpacity key={r.id} style={s.row} activeOpacity={0.6} onPress={() => openReflection(r)}>
                  <View style={s.rowIcon}>
                    <Ionicons name="journal-outline" size={18} color={C.inkSoft} />
                  </View>
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle} numberOfLines={1}>{r.date}</Text>
                    <Text style={s.rowSub} numberOfLines={2}>{plain(r.text)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.inkFaint} style={s.rowChevron} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
