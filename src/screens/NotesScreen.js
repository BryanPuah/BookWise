/**
 * NotesScreen — Knowledge Base, Figma-aligned
 *
 * Two-view architecture:
 *  1. EXPLORE — flat browse, filterable by genre + note type, with search
 *  2. BY BOOK — notes grouped under their book, tap to open dedicated view
 *
 * Theme: matches Library page (navy ink, sandy gold tag pills, sage accents).
 * Top app bar reused from AppHeader component.
 * The "+ Add Note" FAB lives in App.js — no in-screen add button.
 *
 * Preserved logic: addNote, updateNote, deleteNote, search, type filters,
 * starring, BookNotesScreen. Add/Edit flows now route through RichNoteEditor.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { AppHeader } from '../components/AppHeader';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { MarkdownText } from '../components/MarkdownText';
import { useTheme, C } from '../theme';

// NOTE: The module-level `C` import below is used ONLY by the `NT` constant.
// Its colors are frozen to the default theme — acceptable trade-off for v1.
// All component-level styling MUST use the `C` returned by `useTheme()` so
// styles rebuild when the theme changes.

// ── Note type definitions (preserved) ─────────────────────────────────
const NT = {
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
function noteHasType(note, typeKey) {
  if (Array.isArray(note.types) && note.types.includes(typeKey)) return true;
  return note.type === typeKey;
}

// ── Helpers ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

// ── Note card ──────────────────────────────────────────────────────────
// Visual accent for each note type — drives the left stripe color and the
// type chip tint so the eye can sort cards by category at a glance.
function typeAccent(typeKey, C) {
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

export function NoteCard({ note, onDelete, onEdit, showBook = false }) {
  const { C, F, themeVersion } = useTheme();

  const hasBlocks = Array.isArray(note.blocks) && note.blocks.length > 0;

  // Types row — multi-type if note.types[] exists, otherwise primary type
  const typesList = Array.isArray(note.types) && note.types.length
    ? note.types
    : [note.type || 'insight'];

  const primaryType = typesList[0];
  const isQuote = primaryType === 'quote' || note.isQuote;
  const accent = typeAccent(primaryType, C);

  const nc = useMemo(() => StyleSheet.create({
    // Outer wrapper — handles the rounded shell + left accent stripe
    card: {
      flexDirection: 'row',
      backgroundColor: C.white,
      borderRadius: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    accentStripe: {
      width: 4,
      backgroundColor: accent.stripe,
    },
    body: {
      flex: 1,
      padding: 16,
    },

    // Header — type chips on the left, date on the right
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      gap: 8,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      flexShrink: 1,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    chipIcon: {
      fontSize: 10,
    },
    chipTxt: {
      fontFamily: F.serif,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    chipMore: {
      backgroundColor: C.cream,
    },
    chipMoreTxt: {
      fontFamily: F.serif,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 0.4,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    date: {
      fontFamily: F.sans,
      fontSize: 10,
      color: C.inkFaint,
      fontWeight: '600',
      letterSpacing: 0.8,
    },

    // Title — the visual anchor. Slightly larger and tighter than before.
    title: {
      fontFamily: F.serif,
      fontSize: 18,
      color: C.ink,
      letterSpacing: -0.3,
      lineHeight: 25,
      marginBottom: 6,
    },
    // Quote variant — italic & indented with a leading mark for poetry
    titleQuote: {
      fontFamily: F.serif,
      fontStyle: 'italic',
      fontSize: 17,
      color: C.ink,
      lineHeight: 26,
      marginBottom: 6,
    },

    // Image thumbnail
    thumbnail: {
      width: '100%',
      height: 160,
      borderRadius: 10,
      backgroundColor: C.cream,
      marginTop: 6,
      marginBottom: 8,
    },

    // Body — readable serif, comfortable line height
    bodyTxt: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkSoft,
      lineHeight: 22,
    },
    bodyTxtQuote: {
      fontFamily: F.serif,
      fontStyle: 'italic',
      fontSize: 14,
      color: C.inkSoft,
      lineHeight: 22,
    },

    // Footer — book + page + chapter, structured as comma-separated
    // metadata so it reads like a bibliographic line.
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 14,
      paddingTop: 11,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    footerBook: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 12,
      color: C.ink,
      fontWeight: '600',
    },
    footerMeta: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.inkMuted,
      fontWeight: '500',
    },

    // Swipe-to-delete action — slides in from the right
    deleteAction: {
      justifyContent: 'center',
      alignItems: 'flex-end',
      marginBottom: 14,
    },
    deleteBtn: {
      backgroundColor: C.rose,
      borderRadius: 16,
      width: 90,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    deleteTxt: {
      fontFamily: F.serif,
      color: C.white,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
  }), [themeVersion, accent.stripe]);

  // Find first image block (if any) — used to show a thumbnail on the card
  const firstImageBlock = hasBlocks
    ? note.blocks.find(b => b.type === 'image' && b.uri)
    : null;

  // Body — first paragraph block for block-based notes; legacy text otherwise.
  // If the only content is image(s), fall back to caption or empty.
  let bodyText = '';
  if (hasBlocks) {
    const firstPara = note.blocks.find(b => b.type === 'paragraph' && b.text?.trim());
    const firstAny  = note.blocks.find(b => b.text?.trim());
    bodyText = (firstPara || firstAny)?.text || '';
  } else {
    bodyText = note.text || '';
  }

  // Title — explicit title field if present, otherwise derive from first line
  // of body (helps legacy notes render with a serif heading too).
  // If image-only with no caption, fall back to "Image note".
  const isImageOnly = !bodyText && firstImageBlock;
  const cardTitle = note.title?.trim()
    ? note.title.trim()
    : isImageOnly
      ? 'Image note'
      : bodyText.split('\n')[0].split('. ')[0].slice(0, 80);
  const cardBody = note.title?.trim()
    ? bodyText
    : isImageOnly
      ? ''
      : bodyText.slice(cardTitle.length).replace(/^[\.\s]+/, '');

  // Render right-side delete action when swiped
  const renderRightActions = () => (
    <View style={nc.deleteAction}>
      <TouchableOpacity
        style={nc.deleteBtn}
        onPress={() => onDelete(note.id)}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={20} color={C.white} />
        <Text style={nc.deleteTxt}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={nc.card}
        onPress={() => onEdit && onEdit(note)}
        activeOpacity={0.85}
      >
        {/* Left accent stripe — color-codes the card by primary note type */}
        <View style={nc.accentStripe} />

        <View style={nc.body}>
          {/* Header — type chips with icons, right-aligned date */}
          <View style={nc.header}>
            <View style={nc.chipsRow}>
              {typesList.slice(0, 2).map(typeKey => {
                const meta = NT[typeKey] || NT.insight;
                const acc = typeAccent(typeKey, C);
                return (
                  <View key={typeKey} style={[nc.chip, { backgroundColor: acc.chipBg }]}>
                    <Text style={nc.chipIcon}>{meta.icon}</Text>
                    <Text style={[nc.chipTxt, { color: acc.chipInk }]}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
              {typesList.length > 2 && (
                <View style={nc.chipMore}>
                  <Text style={nc.chipMoreTxt}>+{typesList.length - 2}</Text>
                </View>
              )}
            </View>
            <Text style={nc.date}>{timeAgo(note.date).toUpperCase()}</Text>
          </View>

          {/* Title — italic for quotes, upright for everything else */}
          {cardTitle ? (
            <MarkdownText
              style={isQuote ? nc.titleQuote : nc.title}
              numberOfLines={2}
            >
              {isQuote ? `“${cardTitle}”` : cardTitle}
            </MarkdownText>
          ) : null}

          {/* Image thumbnail — shown when note has an image block */}
          {firstImageBlock ? (
            <Image
              source={{ uri: firstImageBlock.uri }}
              style={nc.thumbnail}
              resizeMode="cover"
            />
          ) : null}

          {/* Body paragraph — 3 lines max */}
          {cardBody ? (
            <MarkdownText
              style={isQuote ? nc.bodyTxtQuote : nc.bodyTxt}
              numberOfLines={3}
            >
              {cardBody}
            </MarkdownText>
          ) : null}

          {/* Footer — book + page + chapter on a bibliographic line */}
          {showBook && (
            <View style={nc.footer}>
              <Ionicons name="book-outline" size={13} color={C.inkMuted} />
              <Text style={nc.footerBook} numberOfLines={1}>{note.bookTitle}</Text>
              {note.page ? (
                <Text style={nc.footerMeta}>· p.{note.page}</Text>
              ) : null}
              {note.chapter ? (
                <Text style={nc.footerMeta} numberOfLines={1}>· {note.chapter}</Text>
              ) : null}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ── Explore view — flat browse, dual filters (genre + type) ───────────
function ExploreView({ notes, books, onStar, onDelete, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const ev = useMemo(() => StyleSheet.create({
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.cream,
      borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      marginHorizontal: 20, marginTop: 8, marginBottom: 14,
      gap: 10,
    },
    search: { flex: 1, fontFamily: F.sans, fontSize: 15, color: C.ink },
    filterSection: { marginBottom: 10 },
    genreChip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: C.amberPale,
    },
    genreChipActive: { backgroundColor: C.ink },
    genreChipTxt: { fontFamily: F.serif, fontSize: 12, fontWeight: '600', color: C.ink },
    genreChipTxtActive: { fontFamily: F.serif, color: C.white },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
    },
    typeChipActive: { backgroundColor: C.sagePale, borderColor: C.sage },
    typeChipIcon: { fontSize: 13 },
    typeChipTxt: { fontFamily: F.serif, fontSize: 12, fontWeight: '600', color: C.inkSoft },
    typeChipTxtActive: { fontFamily: F.serif, color: C.ink, fontWeight: '700' },
    listWrap: { paddingHorizontal: 20, paddingTop: 12 },
    emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 30 },
    emptyStateTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6, textAlign: 'center' },
    emptyStateSub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = notes;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.text || '').toLowerCase().includes(q) ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.thinking || '').toLowerCase().includes(q) ||
        (n.bookTitle || '').toLowerCase().includes(q) ||
        (n.chapter || '').toLowerCase().includes(q)
      );
    }

    // Sort: starred first, then most recent
    return [...list.filter(n => n.starred), ...list.filter(n => !n.starred)]
      .sort((a, b) => {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
      });
  }, [notes, search]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Search */}
      <View style={ev.searchWrap}>
        <Ionicons name="search" size={16} color={C.inkMuted} />
        <TextInput style={ev.search} value={search} onChangeText={setSearch}
          placeholder="Search your digital garden..."
          placeholderTextColor={C.inkFaint} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes list */}
      <View style={ev.listWrap}>
        {filtered.length === 0 && (
          <View style={ev.emptyState}>
            <Text style={ev.emptyStateTitle}>
              {search ? 'No notes match your search' : 'No notes yet'}
            </Text>
            <Text style={ev.emptyStateSub}>
              {search ? 'Try different keywords'
                : 'Tap the + button below to capture your first thought'}
            </Text>
          </View>
        )}
        {filtered.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
            showBook
          />
        ))}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ── Book Notes Screen — dedicated full-screen notes for one book ────────
function BookNotesScreen({ book, notes, onStar, onDelete, onEdit, onBack, navigation }) {
  const { C, F, themeVersion } = useTheme();
  const bns = useMemo(() => StyleSheet.create({
    header: { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 14 },
    backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
    backTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontWeight: '600' },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
    bookTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, lineHeight: 24, letterSpacing: -0.2 },
    bookAuthor: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 2 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    typePills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: 20, marginTop: 12 },
    typeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    typeTagTxt: { fontFamily: F.serif, fontSize: 11, fontWeight: '700', color: C.ink },
    openBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.ink },
    openBtnTxt: { fontFamily: F.serif, fontSize: 12, color: C.white, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const starred     = notes.filter(n => n.starred).length;

  const typeCounts = Object.entries(NT).reduce((a, [k]) => {
    const c = notes.filter(n => noteHasType(n, k)).length;
    if (c > 0) a.push({ key: k, count: c, ...NT[k] });
    return a;
  }, []);

  const sorted = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={bns.header}>
        <TouchableOpacity onPress={onBack} style={bns.backBtn} activeOpacity={0.8}>
          <Text style={bns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={bns.headerInfo}>
          <BookCover title={book.title} author={book.author} cover={book.cover}
            coverId={book.coverId} width={48} height={68} />
          <View style={{ flex: 1 }}>
            <Text style={bns.bookTitle} numberOfLines={2}>{book.title}</Text>
            <Text style={bns.bookAuthor}>{book.author}</Text>
            <View style={bns.countRow}>
              <Text style={bns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={bns.starCount}>★ {starred}</Text>}
            </View>
          </View>
          <TouchableOpacity
            style={bns.openBtn}
            onPress={() => navigation.navigate('Library', { screen: 'BookDetail', params: { bookId: book.id } })}
            activeOpacity={0.85}
          >
            <Text style={bns.openBtnTxt}>Open</Text>
          </TouchableOpacity>
        </View>
        {typeCounts.length > 0 && (
          <View style={bns.typePills}>
            {typeCounts.map(tc => (
              <View key={tc.key} style={[bns.typeTag, { backgroundColor: tc.bg }]}>
                <Text style={bns.typeTagTxt}>{tc.icon} {tc.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {sorted.length === 0 && (
          <View style={bns.empty}>
            <Text style={bns.emptyIcon}>📝</Text>
            <Text style={bns.emptyTitle}>No notes yet</Text>
            <Text style={bns.emptySub}>Tap the + button to capture your first thought.</Text>
          </View>
        )}
        {sorted.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── By Book view ───────────────────────────────────────────────────────
function ByBookView({ notes, books, onStar, onDelete, navigation, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const bbv = useMemo(() => StyleSheet.create({
    bookBlock: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    bookHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
    bookMeta: { flex: 1 },
    bookTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
    bookAuthor: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, marginTop: 2 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    typePills: { flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap' },
    typeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    typeTagTxt: { fontFamily: F.serif, fontSize: 10, fontWeight: '700', color: C.ink },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const [selectedBook, setSelectedBook] = useState(null);

  const grouped = useMemo(() => {
    const ids = [...new Set(notes.map(n => n.bookId))];
    return ids.map(id => ({
      book: books.find(b => b.id === id),
      notes: notes.filter(n => n.bookId === id),
    })).filter(g => g.book);
  }, [notes, books]);

  if (selectedBook) {
    const group = grouped.find(g => g.book.id === selectedBook);
    if (group) {
      return (
        <BookNotesScreen
          book={group.book}
          notes={group.notes}
          onStar={onStar}
          onDelete={onDelete}
          onEdit={onEdit}
          onBack={() => setSelectedBook(null)}
          navigation={navigation}
        />
      );
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {grouped.length === 0 && (
          <View style={bbv.empty}>
            <Text style={bbv.emptyIcon}>📚</Text>
            <Text style={bbv.emptyTitle}>No notes yet</Text>
            <Text style={bbv.emptySub}>
              Tap the + button to capture your first thought.
            </Text>
          </View>
        )}
        {grouped.map(({ book, notes: bn }) => {
          const starred = bn.filter(n => n.starred).length;
          const typeCounts = Object.entries(NT).reduce((a, [k]) => {
            const c = bn.filter(n => n.type === k).length;
            if (c > 0) a.push({ key: k, count: c, ...NT[k] });
            return a;
          }, []);

          return (
            <TouchableOpacity
              key={book.id}
              style={bbv.bookBlock}
              onPress={() => setSelectedBook(book.id)}
              activeOpacity={0.85}
            >
              <View style={bbv.bookHead}>
                <BookCover title={book.title} author={book.author} cover={book.cover}
                  coverId={book.coverId} width={48} height={68} />
                <View style={bbv.bookMeta}>
                  <Text style={bbv.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={bbv.bookAuthor}>{book.author}</Text>
                  <View style={bbv.countRow}>
                    <Text style={bbv.noteCount}>{bn.length} note{bn.length !== 1 ? 's' : ''}</Text>
                    {starred > 0 && <Text style={bbv.starCount}>★ {starred}</Text>}
                  </View>
                  <View style={bbv.typePills}>
                    {typeCounts.slice(0, 4).map(tc => (
                      <View key={tc.key} style={[bbv.typeTag, { backgroundColor: tc.bg }]}>
                        <Text style={bbv.typeTagTxt}>{tc.icon} {tc.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ── Type Notes Screen — dedicated full-screen notes for one type ───────
function TypeNotesScreen({ typeKey, typeMeta, notes, onDelete, onEdit, onBack }) {
  const { C, F, themeVersion } = useTheme();
  const tns = useMemo(() => StyleSheet.create({
    header: { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 18 },
    backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
    backTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontWeight: '600' },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
    iconWrap: {
      width: 52, height: 52, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 24 },
    typeTitle: { fontFamily: F.serif, fontSize: 20, color: C.ink, lineHeight: 26, letterSpacing: -0.3 },
    typeDesc: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 3 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const starred = notes.filter(n => n.starred).length;
  const sorted  = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={tns.header}>
        <TouchableOpacity onPress={onBack} style={tns.backBtn} activeOpacity={0.8}>
          <Text style={tns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={tns.headerInfo}>
          <View style={[tns.iconWrap, { backgroundColor: typeMeta.bg }]}>
            <Text style={tns.icon}>{typeMeta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tns.typeTitle}>{typeMeta.label}</Text>
            <Text style={tns.typeDesc}>{typeMeta.desc}</Text>
            <View style={tns.countRow}>
              <Text style={tns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={tns.starCount}>★ {starred}</Text>}
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {sorted.length === 0 && (
          <View style={tns.empty}>
            <Text style={tns.emptyIcon}>{typeMeta.icon}</Text>
            <Text style={tns.emptyTitle}>No {typeMeta.label.toLowerCase()} notes yet</Text>
            <Text style={tns.emptySub}>Tap the + button to capture your first thought.</Text>
          </View>
        )}
        {sorted.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
            showBook
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── By Type view — list of types, tap to drill in ─────────────────────
function ByTypeView({ notes, onDelete, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const btv = useMemo(() => StyleSheet.create({
    typeBlock: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    typeHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
    iconWrap: {
      width: 44, height: 44, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 20 },
    typeMeta: { flex: 1 },
    typeTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
    typeDesc: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, marginTop: 2 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const [selectedType, setSelectedType] = useState(null);

  // Group notes by type, keeping only types that have notes
  const grouped = useMemo(() => {
    return Object.entries(NT).reduce((acc, [key, meta]) => {
      const typeNotes = notes.filter(n => noteHasType(n, key));
      if (typeNotes.length > 0) {
        acc.push({ key, meta, notes: typeNotes });
      }
      return acc;
    }, []);
  }, [notes]);

  // Drill-down view
  if (selectedType) {
    const group = grouped.find(g => g.key === selectedType);
    if (group) {
      return (
        <TypeNotesScreen
          typeKey={group.key}
          typeMeta={group.meta}
          notes={group.notes}
          onDelete={onDelete}
          onEdit={onEdit}
          onBack={() => setSelectedType(null)}
        />
      );
    }
  }

  // List view
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {grouped.length === 0 && (
          <View style={btv.empty}>
            <Text style={btv.emptyIcon}>📝</Text>
            <Text style={btv.emptyTitle}>No notes yet</Text>
            <Text style={btv.emptySub}>
              Tap the + button to capture your first thought.
            </Text>
          </View>
        )}
        {grouped.map(({ key, meta, notes: tn }) => {
          const starred = tn.filter(n => n.starred).length;
          return (
            <TouchableOpacity
              key={key}
              style={btv.typeBlock}
              onPress={() => setSelectedType(key)}
              activeOpacity={0.85}
            >
              <View style={btv.typeHead}>
                <View style={[btv.iconWrap, { backgroundColor: meta.bg }]}>
                  <Text style={btv.icon}>{meta.icon}</Text>
                </View>
                <View style={btv.typeMeta}>
                  <Text style={btv.typeTitle}>{meta.label}</Text>
                  <Text style={btv.typeDesc} numberOfLines={1}>{meta.desc}</Text>
                  <View style={btv.countRow}>
                    <Text style={btv.noteCount}>{tn.length} note{tn.length !== 1 ? 's' : ''}</Text>
                    {starred > 0 && <Text style={btv.starCount}>★ {starred}</Text>}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}


// ── Graph view — Obsidian-style interactive force-directed graph ──
// Pan + pinch-zoom over an SVG canvas; tap a node to open the note.
// Layout is computed once via a force simulation (repulsion / spring /
// gravity / damping) so the graph reads as an organic constellation
// instead of a rigid ring.
// Total character count across all text-bearing fields of a note —
// title, body, "my thinking", and rich-text block paragraphs. Used to
// scale a note's node radius in the graph so longer notes read as
// bigger dots.
function noteTextLen(n) {
  let len = (n.title || '').length + (n.text || '').length + (n.thinking || '').length;
  if (Array.isArray(n.blocks)) {
    n.blocks.forEach(b => { if (b && typeof b.text === 'string') len += b.text.length; });
  }
  return len;
}

// Map text length → node radius. Log curve so a 50-char note is visibly
// larger than a 5-char one, but a 5000-char note doesn't blow up the
// canvas. Starred notes get a small bonus on top.
function noteRadius(n) {
  const len = noteTextLen(n);
  const base = 5 + Math.min(9, Math.log2(len / 30 + 1) * 2.2);
  return n.starred ? base + 1.5 : base;
}

function noteShortLabel(n) {
  const t = (n.title || '').trim();
  if (t) return t.length > 18 ? t.slice(0, 16) + '…' : t;
  let body = (n.text || '').trim();
  if (!body && Array.isArray(n.blocks)) {
    const para = n.blocks.find(b => b.type === 'paragraph' && b.text?.trim());
    body = (para?.text || '').trim();
  }
  body = body.replace(/[#*_`>\n]+/g, ' ').trim();
  if (!body) return '·';
  return body.length > 18 ? body.slice(0, 16) + '…' : body;
}

function GraphView({ notes, books, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const [groupBy, setGroupBy] = useState('book'); // 'book' | 'type'
  const [previewNote, setPreviewNote] = useState(null); // tapped node → overlay card

  // Container size — set initially from window, refined via onLayout so
  // the canvas always fills the remaining vertical space below the
  // toggle strip / legend, regardless of safe-area insets.
  const win = Dimensions.get('window');
  const [size, setSize] = useState({ W: win.width, H: Math.max(420, win.height - 360) });

  const onCanvasLayout = (ev) => {
    const { width, height } = ev.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.W || height !== size.H)) {
      setSize({ W: width, H: height });
    }
  };

  const gv = useMemo(() => StyleSheet.create({
    toggleStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
    toggle: {
      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.cream, alignItems: 'center',
    },
    toggleActive: { backgroundColor: C.ink, borderColor: C.ink },
    toggleTxt: { fontFamily: F.serif, fontSize: 13, fontWeight: '600', color: C.inkSoft },
    toggleTxtActive: { color: C.white },

    legend: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendTxt: { fontFamily: F.serif, fontSize: 10, color: C.inkMuted, fontWeight: '600' },

    // Tap-to-preview overlay — sits over the graph; tap backdrop to dismiss
    previewBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 22, 30, 0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    previewCardWrap: { maxWidth: 460, width: '100%', alignSelf: 'center' },

    canvasWrap: {
      flex: 1, marginHorizontal: 12, marginTop: 4,
      borderRadius: 14, overflow: 'hidden',
      backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
    },

    hud: {
      position: 'absolute', top: 10, right: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    hudTxt: { color: C.white, fontFamily: F.serif, fontSize: 11, fontWeight: '600' },

    resetBtn: {
      position: 'absolute', top: 10, left: 10,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.white,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, borderWidth: 0.5, borderColor: C.border,
    },
    resetTxt: { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600' },

    empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  // Map note-type → node colour. Each type gets its own distinct hue so
  // the legend reads at a glance. Fixed values (not theme-driven) so the
  // mapping stays stable across accent themes.
  const typeColor = {
    quote:      '#D4A55A', // amber/gold — direct words from the author
    insight:    '#7A8B5E', // sage green — your own realisation
    question:   '#D1453B', // rose red — something to investigate
    action:     '#1F7A4D', // forest green — to apply or do
    summary:    '#5B5FA8', // indigo — distilled key idea
    connection: '#8B5076', // plum — links between ideas
  };

  // Build nodes + edges from the current grouping
  const { nodes, edges } = useMemo(() => {
    let groups;
    if (groupBy === 'book') {
      const ids = [...new Set(notes.map(n => n.bookId))];
      groups = ids.map(id => {
        const book = books.find(b => b.id === id);
        return {
          id: `book:${id}`,
          label: book?.title || 'Unknown',
          notes: notes.filter(n => n.bookId === id),
        };
      }).filter(g => g.notes.length > 0 && g.label);
    } else {
      groups = Object.entries(NT).reduce((acc, [key, meta]) => {
        const ns = notes.filter(n => noteHasType(n, key));
        if (ns.length > 0) acc.push({ id: `type:${key}`, label: `${meta.icon} ${meta.label}`, notes: ns });
        return acc;
      }, []);
    }
    const N = [], E = [];
    groups.forEach(g => {
      N.push({ id: g.id, kind: 'hub', label: g.label, count: g.notes.length });
      g.notes.forEach(n => {
        const nid = `${g.id}::n:${n.id}`;
        N.push({ id: nid, kind: 'note', note: n, label: noteShortLabel(n) });
        E.push({ s: g.id, t: nid });
      });
    });
    return { nodes: N, edges: E };
  }, [notes, books, groupBy]);

  // ── Live force-directed simulation ──────────────────────────────────
  // Positions live in a ref so the rAF loop can mutate them at 60fps
  // without churning React state. A small tick counter forces re-renders
  // when something actually moved.
  const positionsRef = useRef({});
  const draggingRef  = useRef(null); // { id, ox, oy, gx, gy } while a finger holds a node
  const rafRef       = useRef(0);
  const [, setTick]  = useState(0);
  const tickGraph = () => setTick(t => (t + 1) % 1000000);

  // Simulation constants — tuned for ~10–80 nodes on a phone canvas
  const SIM = {
    REPULSE: 2200, SPRING_K: 0.045, REST: 68, GRAVITY: 0.014,
    DAMP: 0.86, HUB_MASS: 3.2, MAX_F: 60,
  };

  // One simulation step — updates velocities + integrates positions.
  // Dragged node is pinned to the finger; other nodes still feel its
  // repulsion / spring forces, which gives the "galactic" feel.
  const simulate = (iters) => {
    const pos = positionsRef.current;
    const { W, H } = size;
    const cx = W / 2, cy = H / 2;
    const drag = draggingRef.current;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = pos[nodes[i].id]; if (!a) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = pos[nodes[j].id]; if (!b) continue;
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy + 1;
          let d  = Math.sqrt(d2);
          let f  = SIM.REPULSE / d2;
          if (f > SIM.MAX_F) f = SIM.MAX_F;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      edges.forEach(e => {
        const a = pos[e.s], b = pos[e.t];
        if (!a || !b) return;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d  = Math.sqrt(dx * dx + dy * dy + 1);
        const f = SIM.SPRING_K * (d - SIM.REST);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });
      nodes.forEach(n => {
        const p = pos[n.id]; if (!p) return;
        // Pin the dragged node — finger position wins
        if (drag && drag.id === n.id) {
          p.x = drag.gx; p.y = drag.gy; p.vx = 0; p.vy = 0;
          return;
        }
        p.vx += (cx - p.x) * SIM.GRAVITY;
        p.vy += (cy - p.y) * SIM.GRAVITY;
        const m = n.kind === 'hub' ? SIM.HUB_MASS : 1;
        p.x += p.vx / m;
        p.y += p.vy / m;
        p.vx *= SIM.DAMP;
        p.vy *= SIM.DAMP;
      });
    }
  };

  // Seed positions when the node set or canvas size changes.
  // Existing nodes keep their positions (so re-grouping doesn't reshuffle),
  // new nodes get a hub-ring / orbit seed, then we pre-settle so the
  // initial render looks like an arranged constellation, not a pile.
  useEffect(() => {
    if (nodes.length === 0) { positionsRef.current = {}; tickGraph(); return; }
    const { W, H } = size;
    const cx = W / 2, cy = H / 2;
    const pos = positionsRef.current;
    const liveIds = new Set(nodes.map(n => n.id));
    Object.keys(pos).forEach(k => { if (!liveIds.has(k)) delete pos[k]; });

    const hubs = nodes.filter(n => n.kind === 'hub');
    const hubRadius = Math.min(W, H) * 0.22;
    hubs.forEach((h, i) => {
      if (pos[h.id]) return;
      const a = (i / Math.max(1, hubs.length)) * 2 * Math.PI - Math.PI / 2;
      pos[h.id] = { x: cx + hubRadius * Math.cos(a), y: cy + hubRadius * Math.sin(a), vx: 0, vy: 0 };
    });
    const childMap = {};
    edges.forEach(e => { (childMap[e.s] = childMap[e.s] || []).push(e.t); });
    hubs.forEach(h => {
      const kids = childMap[h.id] || [];
      const p = pos[h.id];
      kids.forEach((kid, j) => {
        if (pos[kid]) return;
        const r = 38 + (j % 5) * 6;
        const a = (j / Math.max(1, kids.length)) * 2 * Math.PI;
        pos[kid] = { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a), vx: 0, vy: 0 };
      });
    });
    nodes.forEach(n => { if (!pos[n.id]) pos[n.id] = { x: cx, y: cy, vx: 0, vy: 0 }; });

    // Pre-settle: 220 cheap iterations to give an arranged starting layout
    simulate(220);
    tickGraph();
  }, [nodes, edges, size.W, size.H]);

  // Continuous rAF loop — keeps the simulation alive so released nodes
  // drift back, and the whole graph reacts to a dragged node. Sleeps
  // when total kinetic energy is negligible and no drag is active; a
  // drag handler wakes it again.
  const wakeLoop = () => {
    if (rafRef.current) return;
    const step = () => {
      simulate(1);
      let E = 0;
      const pos = positionsRef.current;
      for (const k in pos) { const p = pos[k]; E += p.vx * p.vx + p.vy * p.vy; }
      tickGraph();
      if (E > 0.05 || draggingRef.current) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    wakeLoop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  }, [nodes, edges, size.W, size.H]);

  // ── Pan / pinch / tap state ─────────────────────────────────────────
  // tx.k is the current zoom (1 = fit). tx.x/y is the canvas-space offset.
  const [tx, setTx] = useState({ x: 0, y: 0, k: 1 });
  const txRef    = useRef({ x: 0, y: 0, k: 1 });
  const savedRef = useRef({ x: 0, y: 0, k: 1 });
  const focalRef = useRef({ x: 0, y: 0 });
  useEffect(() => { txRef.current = tx; }, [tx]);

  // Reset view when the grouping changes — the new layout has different bounds.
  useEffect(() => {
    const r = { x: 0, y: 0, k: 1 };
    setTx(r); txRef.current = r; savedRef.current = r;
  }, [groupBy]);

  // Pan branches at gesture start:
  //   • finger lands on a node → drag that node around (galactic mode)
  //   • finger lands on empty canvas → pan the whole view
  // Hit-test uses the most recent rendered positions in graph coords.
  const beginRef = useRef({ x: 0, y: 0 });
  const panG = useMemo(() => Gesture.Pan()
    .minDistance(4)
    .onBegin(e => { beginRef.current = { x: e.x, y: e.y }; })
    .onStart(() => {
      savedRef.current = txRef.current;
      const t = txRef.current;
      const bx = beginRef.current.x, by = beginRef.current.y;
      const gx = (bx - t.x) / t.k;
      const gy = (by - t.y) / t.k;
      let bestId = null, bestD = Infinity;
      for (const n of nodes) {
        const p = positionsRef.current[n.id];
        if (!p) continue;
        const d = Math.hypot(gx - p.x, gy - p.y);
        const baseR = n.kind === 'hub' ? 18 : noteRadius(n.note);
        const hitR  = baseR + 16 / Math.max(0.4, t.k);
        if (d < hitR && d < bestD) { bestD = d; bestId = n.id; }
      }
      if (bestId) {
        const p = positionsRef.current[bestId];
        draggingRef.current = { id: bestId, ox: gx - p.x, oy: gy - p.y, gx: p.x, gy: p.y };
        wakeLoop();
      } else {
        draggingRef.current = null;
      }
    })
    .onUpdate(e => {
      const drag = draggingRef.current;
      const t = txRef.current;
      if (drag) {
        const gx = (e.x - t.x) / t.k - drag.ox;
        const gy = (e.y - t.y) / t.k - drag.oy;
        drag.gx = gx; drag.gy = gy;
        wakeLoop();
      } else {
        setTx({
          k: savedRef.current.k,
          x: savedRef.current.x + e.translationX,
          y: savedRef.current.y + e.translationY,
        });
      }
    })
    .onEnd(() => {
      // Release the node — simulation takes over and the constellation re-settles
      draggingRef.current = null;
      wakeLoop();
    })
    .onFinalize(() => {
      draggingRef.current = null;
    }),
  [nodes]);

  const pinchG = useMemo(() => Gesture.Pinch()
    .onStart(e => {
      savedRef.current = txRef.current;
      focalRef.current = { x: e.focalX, y: e.focalY };
    })
    .onUpdate(e => {
      const prevK = savedRef.current.k;
      const nextK = Math.max(0.35, Math.min(4, prevK * e.scale));
      const fx = focalRef.current.x, fy = focalRef.current.y;
      // Zoom around the user's pinch focal point so content under the fingers stays put
      const nextX = fx - ((fx - savedRef.current.x) / prevK) * nextK;
      const nextY = fy - ((fy - savedRef.current.y) / prevK) * nextK;
      setTx({ k: nextK, x: nextX, y: nextY });
    }),
  []);

  const tapG = useMemo(() => Gesture.Tap()
    .maxDuration(260)
    .maxDistance(8)
    .onEnd((e, success) => {
      if (!success) return;
      const t = txRef.current;
      const gx = (e.x - t.x) / t.k;
      const gy = (e.y - t.y) / t.k;
      let bestNote = null, bestD = Infinity;
      for (const n of nodes) {
        if (n.kind !== 'note') continue;
        const p = positionsRef.current[n.id];
        if (!p) continue;
        const d = Math.hypot(gx - p.x, gy - p.y);
        const baseR = n.note.starred ? 9 : 7;
        const hitR  = baseR + 10 / Math.max(0.4, t.k);
        if (d < hitR && d < bestD) { bestD = d; bestNote = n.note; }
      }
      if (bestNote) setPreviewNote(bestNote);
    }),
  [nodes]);

  const gesture = useMemo(
    () => Gesture.Simultaneous(tapG, panG, pinchG),
    [tapG, panG, pinchG]
  );

  const resetView = () => {
    const r = { x: 0, y: 0, k: 1 };
    setTx(r); savedRef.current = r;
  };

  // ── Empty state ─────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={gv.toggleStrip}>
          <TouchableOpacity style={[gv.toggle, groupBy === 'book' && gv.toggleActive]}
            onPress={() => setGroupBy('book')} activeOpacity={0.8}>
            <Text style={[gv.toggleTxt, groupBy === 'book' && gv.toggleTxtActive]}>By Book</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[gv.toggle, groupBy === 'type' && gv.toggleActive]}
            onPress={() => setGroupBy('type')} activeOpacity={0.8}>
            <Text style={[gv.toggleTxt, groupBy === 'type' && gv.toggleTxtActive]}>By Type</Text>
          </TouchableOpacity>
        </View>
        <View style={gv.empty}>
          <Text style={gv.emptyIcon}>🌐</Text>
          <Text style={gv.emptyTitle}>Nothing to graph yet</Text>
          <Text style={gv.emptySub}>Capture a few notes and they'll appear here as a constellation around their books.</Text>
        </View>
      </View>
    );
  }

  // Stroke widths shrink as you zoom in so they don't look chunky
  const edgeStroke = Math.max(0.3, 0.9 / Math.max(0.5, tx.k));
  const showNoteLabels = tx.k >= 0.9;
  const showHubLabels  = tx.k >= 0.55;

  return (
    <View style={{ flex: 1 }}>
      <View style={gv.toggleStrip}>
        <TouchableOpacity style={[gv.toggle, groupBy === 'book' && gv.toggleActive]}
          onPress={() => setGroupBy('book')} activeOpacity={0.8}>
          <Text style={[gv.toggleTxt, groupBy === 'book' && gv.toggleTxtActive]}>By Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[gv.toggle, groupBy === 'type' && gv.toggleActive]}
          onPress={() => setGroupBy('type')} activeOpacity={0.8}>
          <Text style={[gv.toggleTxt, groupBy === 'type' && gv.toggleTxtActive]}>By Type</Text>
        </TouchableOpacity>
      </View>

      <View style={gv.legend}>
        {Object.entries(NT).map(([k, v]) => (
          <View key={k} style={gv.legendItem}>
            <View style={[gv.legendDot, { backgroundColor: typeColor[k] || C.inkMuted }]} />
            <Text style={gv.legendTxt}>{v.label}</Text>
          </View>
        ))}
      </View>

      <View style={gv.canvasWrap} onLayout={onCanvasLayout}>
        <GestureDetector gesture={gesture}>
          <View style={{ width: size.W, height: size.H }} collapsable={false}>
            <Svg width={size.W} height={size.H}>
              <G transform={`translate(${tx.x}, ${tx.y}) scale(${tx.k})`}>
                {/* Edges */}
                {edges.map((e, i) => {
                  const a = positionsRef.current[e.s], b = positionsRef.current[e.t];
                  if (!a || !b) return null;
                  return (
                    <Line
                      key={`e${i}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={C.border}
                      strokeWidth={edgeStroke}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Hub nodes — drawn before notes so labels overlap nicely */}
                {nodes.filter(n => n.kind === 'hub').map(h => {
                  const p = positionsRef.current[h.id];
                  if (!p) return null;
                  return (
                    <G key={h.id}>
                      <Circle
                        cx={p.x} cy={p.y} r={18}
                        fill={C.ink} stroke={C.paper} strokeWidth={2.5}
                      />
                      <SvgText
                        x={p.x} y={p.y + 4}
                        fill={C.white} fontSize="11" fontWeight="bold"
                        textAnchor="middle"
                      >
                        {h.count}
                      </SvgText>
                      {showHubLabels && (
                        <SvgText
                          x={p.x} y={p.y + 34}
                          fill={C.ink} fontSize="11" fontWeight="bold"
                          textAnchor="middle"
                        >
                          {h.label.length > 22 ? h.label.slice(0, 20) + '…' : h.label}
                        </SvgText>
                      )}
                    </G>
                  );
                })}

                {/* Note nodes — each carries a floating short-label */}
                {nodes.filter(n => n.kind === 'note').map(n => {
                  const p = positionsRef.current[n.id];
                  if (!p) return null;
                  const typeKey = (Array.isArray(n.note.types) && n.note.types[0])
                    || n.note.type || 'insight';
                  const fill = typeColor[typeKey] || C.inkMuted;
                  const r = noteRadius(n.note);
                  return (
                    <G key={n.id}>
                      <Circle
                        cx={p.x} cy={p.y} r={r}
                        fill={fill} stroke={C.paper} strokeWidth={1.5}
                      />
                      {showNoteLabels && (
                        <SvgText
                          x={p.x} y={p.y + r + 9}
                          fill={C.inkSoft} fontSize="8.5"
                          textAnchor="middle"
                        >
                          {n.label}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            </Svg>
          </View>
        </GestureDetector>

        {/* HUD: zoom % badge and a reset button */}
        <View pointerEvents="none" style={gv.hud}>
          <Text style={gv.hudTxt}>{Math.round(tx.k * 100)}%</Text>
        </View>
        <TouchableOpacity style={gv.resetBtn} onPress={resetView} activeOpacity={0.85}>
          <Ionicons name="contract-outline" size={12} color={C.ink} />
          <Text style={gv.resetTxt}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Tap a node → show its NoteCard as an overlay; tap backdrop to dismiss */}
      {previewNote && (
        <View style={gv.previewBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPreviewNote(null)}
          />
          <View style={gv.previewCardWrap}>
            <NoteCard
              note={previewNote}
              onEdit={() => setPreviewNote(null)}
              onDelete={() => setPreviewNote(null)}
              showBook
            />
          </View>
        </View>
      )}
    </View>
  );
}

export function NotesScreen({ navigation }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    tabStrip: {
      flexDirection: 'row',
      gap: 28,
      paddingHorizontal: 20,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
      marginBottom: 8,
    },
    tab: { paddingBottom: 12, paddingTop: 4 },
    tabTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' },
    tabTxtActive: { fontFamily: F.serif, color: C.ink, fontWeight: '700' },
    tabUnderline: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 2, backgroundColor: C.ink, borderRadius: 1,
    },
  }), [themeVersion]);

  const { notes, books, addNote, deleteNote, updateNote } = useStore();
  const [view, setView]                   = useState('explore');
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote]           = useState(null);

  const handleSave = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId:    data.bookId,
      bookTitle: data.bookTitle,
      title:     data.title || '',
      blocks:    data.blocks || [],
      types:     data.types || [data.type || 'insight'],
      type:      data.type,           // legacy single-type, kept for filters
      text:      data.text,            // flattened body string, kept for search
      thinking:  data.thinking || '',  // legacy, mostly empty now
      page:      data.page || '',
      chapter:   data.chapter || '',
      isQuote:   data.type === 'quote',
      starred:   false,
      date:      new Date().toISOString().slice(0, 10),
    });
  };

  const handleEdit = (note) => {
    setEditNote(note);
    setShowEditModal(true);
  };

  const handleSaveEdit = (data) => {
    if (editNote) {
      updateNote(editNote.id, {
        title:    data.title || '',
        blocks:   data.blocks || [],
        types:    data.types || [data.type || 'insight'],
        type:     data.type,
        text:     data.text,
        thinking: data.thinking || '',
        page:     data.page || '',
        chapter:  data.chapter || '',
        isQuote:  data.type === 'quote',
      });
    }
    setEditNote(null);
  };

  const handleStar = (id) => {
    const note = notes.find(n => n.id === id);
    if (note) updateNote(id, { starred: !note.starred });
  };

  const handleDelete = (id) => deleteNote(id);

  const VIEWS = [
    { key: 'explore',  label: 'Explore' },
    { key: 'by_book',  label: 'By Book' },
    { key: 'by_type',  label: 'Note Type' },
    { key: 'graph',    label: 'Graph' },
  ];

  const sharedProps = {
    notes, books,
    onStar: handleStar,
    onDelete: handleDelete,
    onEdit: handleEdit,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* RichNoteEditor handles both new note + edit flows */}
      <RichNoteEditor
        visible={showModal || showEditModal}
        books={books}
        initialNote={showEditModal ? editNote : null}
        onSave={(data) => {
          if (showEditModal && editNote) {
            handleSaveEdit(data);
            setShowEditModal(false);
            setEditNote(null);
          } else {
            handleSave(data);
            setShowModal(false);
          }
        }}
        onClose={() => {
          setShowModal(false);
          setShowEditModal(false);
          setEditNote(null);
        }}
      />

      {/* Top app bar */}
      <AppHeader onAvatarPress={() => navigation.navigate('Profile')} />

      {/* Tab strip */}
      <View style={s.tabStrip}>
        {VIEWS.map(v => {
          const isActive = view === v.key;
          return (
            <TouchableOpacity
              key={v.key}
              style={s.tab}
              onPress={() => setView(v.key)}
              activeOpacity={0.6}
            >
              <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{v.label}</Text>
              {isActive && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Views */}
      {view === 'explore' && <ExploreView {...sharedProps} />}
      {view === 'by_book' && <ByBookView {...sharedProps} navigation={navigation} />}
      {view === 'by_type' && <ByTypeView notes={notes} onDelete={handleDelete} onEdit={handleEdit} />}
      {view === 'graph'   && <GraphView notes={notes} books={books} onEdit={handleEdit} />}

    </SafeAreaView>
  );
}

