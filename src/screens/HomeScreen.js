import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity, StyleSheet, Dimensions,
  Modal,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { ReadingTimeline } from '../components/ReadingTimeline';
import { AppHeader } from '../components/AppHeader';
import { ReflectionPage } from '../components/ReflectionPage';
import { StreakActivityModal } from '../components/StreakActivityModal';
import { useTheme } from '../theme';

const { width: SW } = Dimensions.get('window');
const HERO_W = SW - 16;

// Tile sizing — matches the hero book cover dimensions (118 × 168)
const TILE_GUTTER = 14;
const TILE_W = 118;
const TILE_H = 168;

const COLLECTION_TABS = [
  { id: 'finished',     label: 'Finished'     },
  { id: 'want_to_read', label: 'Want to Read' },
  { id: 'reflections',  label: 'Reflections'  },
];

// ── Range definitions ────────────────────────────────────────────────
const RANGES = ['day', 'week', 'month', 'year'];
const RANGE_META = {
  day:   { label: 'today',      shortLabel: 'Today' },
  week:  { label: 'this week',  shortLabel: 'This week' },
  month: { label: 'this month', shortLabel: 'This month' },
  year:  { label: 'this year',  shortLabel: 'This year' },
};

function startOfRange(range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'day')   return d;
  if (range === 'week') {
    const dayIdx = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayIdx);
    return d;
  }
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

// ── Range picker modal ────────────────────────────────────────────────
function RangePickerModal({ visible, currentRange, onSelect, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const rp = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    card: {
      width: '100%',
      maxWidth: 280,
      backgroundColor: C.paper,
      borderRadius: 16,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 16,
    },
    title: {
      fontFamily: F.sans,
      fontSize: 11, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 13,
    },
    rowActive: {
      backgroundColor: C.amberPale,
    },
    rowTxt: {
      fontFamily: F.serif,
      fontSize: 15, fontWeight: '500', color: C.ink, letterSpacing: -0.2,
    },
    rowTxtActive: {
      fontFamily: F.serif,
      color: C.ink, fontWeight: '700',
    },
  }), [themeVersion]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={rp.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={rp.card}>
          <Text style={rp.title}>VIEW BY</Text>
          {RANGES.map(range => {
            const active = range === currentRange;
            return (
              <TouchableOpacity
                key={range}
                style={[rp.row, active && rp.rowActive]}
                onPress={() => { onSelect(range); onClose(); }}
                activeOpacity={0.65}
              >
                <Text style={[rp.rowTxt, active && rp.rowTxtActive]}>
                  {RANGE_META[range].shortLabel}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={C.amber} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────
function GoalCard({ baseLabel, current, range, onChangeRange }) {
  const { C, F, themeVersion } = useTheme();
  const meta = RANGE_META[range];
  const [pickerOpen, setPickerOpen] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    goalStat: {
      flex: 1,
      alignItems: 'flex-start',
    },
    goalMedal: {
      marginBottom: 10,
    },
    goalCountNum: {
      fontFamily: F.serif,
      fontSize: 44,
      color: C.amber,
      letterSpacing: -1.5,
      lineHeight: 48,
      marginBottom: 6,
    },
    goalLabel: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkSoft,
      fontWeight: '400',
      letterSpacing: -0.1,
    },
  }), [themeVersion]);

  return (
    <>
      <TouchableOpacity
        style={s.goalStat}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.6}
      >
        <Ionicons name="ribbon" size={20} color={C.amber} style={s.goalMedal} />
        <Text style={s.goalCountNum}>{current}</Text>
        <Text style={s.goalLabel} numberOfLines={1}>
          {baseLabel} {meta.label}
        </Text>
      </TouchableOpacity>

      <RangePickerModal
        visible={pickerOpen}
        currentRange={range}
        onSelect={onChangeRange}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

// ── Streak card ────────────────────────────────────────────────────────
// Shows the current consecutive-active-day streak with a flame icon.
// "Active" = the app was opened that day (tracked in store.activeDays).
// Zero state ("—") shown when streak is 0, so the visual layout doesn't
// jump around.
function StreakCard({ streak, onPress }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    goalStat: {
      flex: 1,
      alignItems: 'flex-start',
    },
    goalMedal: {
      marginBottom: 10,
    },
    goalCountNum: {
      fontFamily: F.serif,
      fontSize: 44,
      color: C.amber,
      letterSpacing: -1.5,
      lineHeight: 48,
      marginBottom: 6,
    },
    goalLabel: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkSoft,
      fontWeight: '400',
      letterSpacing: -0.1,
    },
  }), [themeVersion]);

  return (
    <TouchableOpacity
      style={s.goalStat}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="flame" size={20} color={C.rose} style={s.goalMedal} />
      <Text style={[s.goalCountNum, { color: C.rose }]}>
        {streak > 0 ? streak : '—'}
      </Text>
      <Text style={s.goalLabel} numberOfLines={1}>
        Active Day Streak
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export function HomeScreen({ navigation, route }) {
  const { C, F, themeVersion } = useTheme();
  const { books, notes, readingBooks, currentStreak, reflections, user } = useStore();

  // First name for the greeting — split on whitespace to handle "Julian Barnes" → "Julian".
  // Falls back to the whole name if no spaces (e.g. single-word names).
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'Reader';
  const [activeIdx, setActiveIdx] = useState(0);
  const heroScrollRef = useRef(null);

  // Per-card active range — both default to 'year' to match Figma label
  const [booksRange, setBooksRange] = useState('year');
  const [notesRange, setNotesRange] = useState('year');

  // Active library tab — Finished / Want to Read / Collections
  const [activeCollection, setActiveCollection] = useState('finished');
  // When a reflection is tapped in the list, open the full-screen
  // ReflectionPage. DayPanel still opens via the calendar route only.
  const [reflectionDate, setReflectionDate] = useState(null);
  // Active Day Streak grid modal
  const [streakModalOpen, setStreakModalOpen] = useState(false);

  // Honour `reflectionDate` route param — set when a reflection result is
  // tapped in the global search modal. The `_t` cache-buster ensures the
  // same date reopens the page after being closed.
  useEffect(() => {
    const d = route?.params?.reflectionDate;
    if (d) {
      setReflectionDate(d);
      navigation.setParams({ reflectionDate: undefined, _t: undefined });
    }
  }, [route?.params?.reflectionDate, route?.params?._t]);

  const finished   = books.filter(b => b.status === 'finished');
  const wantToRead = books.filter(b => b.status === 'want_to_read');

  // First-time gate: zero books, zero notes, zero reflections. Drives the
  // "Get Started" card that replaces the currently-reading hero on first
  // launch so a fresh user gets an actionable next step instead of a
  // blank empty-hero with no context.
  const isFirstTime = books.length === 0 && notes.length === 0 && reflections.length === 0;
  const todayKey    = new Date().toISOString().slice(0, 10);

  // Books shown in the grid below the tab strip
  const collectionBooks = useMemo(() => {
    if (activeCollection === 'finished')     return finished;
    if (activeCollection === 'want_to_read') return wantToRead;
    return [];
  }, [activeCollection, finished, wantToRead]);

  // Range-aware counts
  const booksInRange = useMemo(() => {
    const start = startOfRange(booksRange);
    return finished.filter(b => {
      const d = b.finishedAt || b.dateCompleted || b.date;
      return d && new Date(d) >= start;
    }).length;
  }, [finished, booksRange]);

  const notesInRange = useMemo(() => {
    const start = startOfRange(notesRange);
    return notes.filter(n => n.date && new Date(n.date) >= start).length;
  }, [notes, notesRange]);

  const goalsConfig = [
    {
      id: 'books',
      baseLabel: 'Books',
      current: booksInRange,
      range: booksRange,
      onChangeRange: setBooksRange,
    },
    {
      id: 'notes',
      baseLabel: 'Notes',
      current: notesInRange,
      range: notesRange,
      onChangeRange: setNotesRange,
    },
  ];

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    // Hero card — light Figma style with book cover on the left
    heroCard: {
      marginHorizontal: 8,
      marginBottom: 20,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: C.white,
      height: 260,
      borderLeftWidth: 6,
      borderLeftColor: C.sage,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    heroInner: {
      flexDirection: 'row',
      padding: 18,
      gap: 16,
      alignItems: 'flex-start',
      height: 260,
      paddingBottom: 30,
    },
    heroCoverCol: {
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 6,
    },
    heroInfoCol: { flex: 1, paddingTop: 2 },

    heroTagPill: {
      alignSelf: 'flex-start',
      backgroundColor: C.amberPale,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      marginBottom: 8,
    },
    heroTagPillTxt: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: 0.8,
    },

    heroTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      lineHeight: 26,
      letterSpacing: -0.4,
      marginBottom: 2,
    },
    heroAuthor: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      marginBottom: 12,
    },

    heroProgressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6,
    },
    heroProgressLbl:   { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600' },
    heroProgressPages: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    heroTrack: {
      height: 4,
      backgroundColor: C.creamDark,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 12,
    },
    heroFill: {
      height: 4,
      backgroundColor: C.ink,
      borderRadius: 2,
    },

    heroActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    heroPrimaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: C.sage,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 8,
    },
    heroPrimaryTxt: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.white,
      fontWeight: '700',
    },
    heroSecondaryBtn: {
      flex: 1,
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroSecondaryTxt: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.ink,
      fontWeight: '500',
    },

    heroNoteCount: {
      fontFamily: F.serif,
      fontSize: 10,
      color: C.inkMuted,
      marginTop: 6,
    },

    // Carousel dots — sit below the card on light background
    dotsRow: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      gap: 6, position: 'absolute', bottom: 10, left: 0, right: 0,
    },
    dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(26,30,58,0.15)' },
    dotActive: { backgroundColor: C.ink },
    dotEdge:   { width: 4, height: 4, borderRadius: 2, opacity: 0.4 },

    emptyHero: {
      marginHorizontal: 20, backgroundColor: C.white, borderRadius: 20,
      padding: 32, alignItems: 'center', marginBottom: 16,
      borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
    },
    emptyHeroIcon:   { fontSize: 36, marginBottom: 12 },
    emptyHeroTitle:  { fontFamily: F.serif, fontSize: 20, color: C.ink, textAlign: 'center', marginBottom: 6 },
    emptyHeroSub:    { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyHeroBtn:    { backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
    emptyHeroBtnTxt: { fontFamily: F.serif, color: C.white, fontSize: 13, fontWeight: '600' },

    // Get Started card — shown only on the all-zero first launch (no
    // books, no notes, no reflections). Replaces the carousel/empty-hero
    // until the user has any content of any kind.
    welcomeCard: {
      marginHorizontal: 8,
      marginBottom: 20,
      borderRadius: 20,
      backgroundColor: C.white,
      borderLeftWidth: 6,
      borderLeftColor: C.sage,
      paddingHorizontal: 22,
      paddingVertical: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    welcomeKicker: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.amber,
      letterSpacing: 1.6,
      marginBottom: 8,
    },
    welcomeTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginBottom: 6,
    },
    welcomeSub: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      lineHeight: 19,
      marginBottom: 16,
    },
    welcomeStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    welcomeStepIcon: {
      fontSize: 22,
    },
    welcomeStepTitle: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      fontWeight: '600',
      letterSpacing: -0.1,
      marginBottom: 2,
    },
    welcomeStepBody: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      lineHeight: 17,
    },

    // Goals
    // Stats row — three big numerals evenly spaced across the row
    goalsWrap: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 14,
      justifyContent: 'space-between',
    },
    goalStat: {
      flex: 1,
      alignItems: 'flex-start',
    },
    goalMedal: {
      marginBottom: 10,
    },
    goalCountNum: {
      fontFamily: F.serif,
      fontSize: 44,
      color: C.amber,
      letterSpacing: -1.5,
      lineHeight: 48,
      marginBottom: 6,
    },
    goalLabel: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkSoft,
      fontWeight: '400',
      letterSpacing: -0.1,
    },

    // ── Collection tabs (Finished / Want to Read / Reflections) ─────
    collectionTabs: {
      flexDirection: 'row',
      gap: 28,
      paddingHorizontal: 20,
      marginTop: 28,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    collectionTab: {
      paddingBottom: 12,
      paddingTop: 4,
    },
    collectionTabTxt: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkMuted,
      fontWeight: '500',
    },
    collectionTabTxtActive: {
      fontFamily: F.serif,
      color: C.ink,
      fontWeight: '700',
    },
    collectionTabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: C.ink,
      borderRadius: 1,
    },

    // ── Grid ─────────────────────────────────────────────────────────
    collectionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: TILE_GUTTER,
    },
    tile: {
      width: TILE_W,
    },
    tileCover: {
      width: TILE_W,
      height: TILE_H,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: C.cream,
      position: 'relative',
    },
    tileCheck: {
      position: 'absolute',
      top: 8, right: 8,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.ink,
      alignItems: 'center', justifyContent: 'center',
    },
    tileTitle: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      fontWeight: '600',
      marginTop: 10,
      lineHeight: 17,
    },
    tileAuthor: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.inkMuted,
      marginTop: 2,
    },
    collectionEmpty: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 40,
      gap: 10,
    },
    collectionEmptyTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkFaint,
      textAlign: 'center',
    },
    collectionEmptyLink: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      fontWeight: '600',
    },

    // ── Reflections list (when "Reflections" collection tab is active) ──
    reflectionsList: {
      paddingHorizontal: 16,
      paddingTop: 4,
      gap: 8,
    },
    reflectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    reflectionRowIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.amberPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reflectionRowDate: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    reflectionRowBody: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      lineHeight: 17,
    },
  }), [themeVersion]);

  // Grid sizing — derive the number of columns from screen width so the
  // wrap behaves like the old flexWrap layout. Tile width + gap dictates
  // how many fit; we floor at 2 so phones always show a proper grid.
  const numColumns = Math.max(2, Math.floor((SW - 40 + TILE_GUTTER) / (TILE_W + TILE_GUTTER)));
  const showGrid = activeCollection !== 'reflections';

  const header = (
    <>
        {/* ── TOP APP BAR ────────────────────────────────────────── */}
        <AppHeader
          brand={isFirstTime ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`}
          onAvatarPress={() => navigation.getParent('MainTabs')?.navigate('Profile')}
        />

        {/* ── READING TIMELINE ────────────────────────────────────── */}
        <ReadingTimeline
          notes={notes}
          books={books}
          onManageGoals={() => navigation.navigate('Goals')}
        />

        {/* ── CURRENTLY READING HERO ─ or ─ Get Started card ────── */}
        {isFirstTime ? (
          <View style={s.welcomeCard}>
            <Text style={s.welcomeKicker}>WELCOME{firstName !== 'Reader' ? `, ${firstName.toUpperCase()}` : ''}</Text>
            <Text style={s.welcomeTitle}>Let's start your library.</Text>
            <Text style={s.welcomeSub}>
              Two quick ways to begin — there's no wrong order.
            </Text>

            <TouchableOpacity
              style={s.welcomeStep}
              onPress={() => navigation.navigate('Add')}
              activeOpacity={0.7}
            >
              <Text style={s.welcomeStepIcon}>📚</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.welcomeStepTitle}>Add your first book</Text>
                <Text style={s.welcomeStepBody}>
                  Search OpenLibrary, or add a book, article, or PDF by hand.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.inkFaint} />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.welcomeStep}
              onPress={() => setReflectionDate(todayKey)}
              activeOpacity={0.7}
            >
              <Text style={s.welcomeStepIcon}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.welcomeStepTitle}>Write today's reflection</Text>
                <Text style={s.welcomeStepBody}>
                  A line or two about what you read, thought, or noticed today.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.inkFaint} />
            </TouchableOpacity>
          </View>
        ) : readingBooks.length > 0 ? (
          <View style={s.heroCard}>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              style={{ height: 260 }}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
                setActiveIdx(Math.min(idx, readingBooks.length - 1));
              }}
            >
              {readingBooks.map((book) => {
                const bNotes = notes.filter(n => n.bookId === book.id);
                const prog   = book.currentPage / (book.pageCount || 1);
                const pct    = Math.round(prog * 100);
                const tag    = book.genres?.[0] || book.format || 'Reading';
                return (
                  <TouchableOpacity
                    key={book.id}
                    activeOpacity={0.92}
                    onPress={() => navigation.navigate('BookDetail', { bookId: book.id, tab: 'notes' })}
                    style={{ width: HERO_W }}
                  >
                    <View style={s.heroInner}>
                      {/* Book cover — left, same dimensions as before */}
                      <View style={s.heroCoverCol}>
                        <BookCover title={book.title} author={book.author}
                          cover={book.cover} coverId={book.coverId} width={118} height={168} />
                      </View>

                      {/* Info — right column */}
                      <View style={s.heroInfoCol}>
                        {/* Tag pill */}
                        <View style={s.heroTagPill}>
                          <Text style={s.heroTagPillTxt} numberOfLines={1}>
                            {String(tag).toUpperCase()}
                          </Text>
                        </View>

                        {/* Title + author */}
                        <Text style={s.heroTitle} numberOfLines={2}>{book.title}</Text>
                        <Text style={s.heroAuthor} numberOfLines={1}>{book.author}</Text>

                        {/* Progress label + pages */}
                        <View style={s.heroProgressRow}>
                          <Text style={s.heroProgressLbl}>Reading Progress: {pct}%</Text>
                          <Text style={s.heroProgressPages}>{book.currentPage} / {book.pageCount || 0} pages</Text>
                        </View>
                        <View style={s.heroTrack}>
                          <View style={[s.heroFill, { width: `${pct}%` }]} />
                        </View>

                        {/* Action buttons */}
                        <View style={s.heroActions}>
                          <TouchableOpacity
                            style={s.heroPrimaryBtn}
                            onPress={() => navigation.navigate('BookDetail', { bookId: book.id, tab: 'notes' })}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="create-outline" size={14} color={C.white} />
                            <Text style={s.heroPrimaryTxt}>Add Note</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.heroSecondaryBtn}
                            onPress={() => navigation.navigate('BookDetail', { bookId: book.id })}
                            activeOpacity={0.7}
                          >
                            <Text style={s.heroSecondaryTxt}>Reading Progress: {pct}%</Text>
                          </TouchableOpacity>
                        </View>

                        {bNotes.length > 0 && (
                          <Text style={s.heroNoteCount}>
                            {bNotes.length} note{bNotes.length !== 1 ? 's' : ''} captured
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Dots — preserved exactly */}
            {readingBooks.length > 1 && (() => {
              const total = readingBooks.length;
              const MAX   = 4;
              if (total <= MAX) {
                return (
                  <View style={s.dotsRow} pointerEvents="none">
                    {Array.from({ length: total }, (_, i) => (
                      <View key={i} style={[s.dot, i === activeIdx && s.dotActive]} />
                    ))}
                  </View>
                );
              }
              let windowStart;
              if (activeIdx <= 1)              windowStart = 0;
              else if (activeIdx >= total - 2) windowStart = total - MAX;
              else                             windowStart = activeIdx - 2;
              return (
                <View style={s.dotsRow} pointerEvents="none">
                  {Array.from({ length: MAX }, (_, k) => {
                    const realIdx = windowStart + k;
                    const isActive = realIdx === activeIdx;
                    const isEdge = (windowStart > 0 && k === 0) ||
                                   (windowStart + MAX < total && k === MAX - 1);
                    return (
                      <View key={k} style={[
                        s.dot,
                        isActive && s.dotActive,
                        !isActive && isEdge && s.dotEdge,
                      ]} />
                    );
                  })}
                </View>
              );
            })()}
          </View>
        ) : (
          <TouchableOpacity
            style={s.emptyHero}
            onPress={() => navigation.navigate('Add')}
            activeOpacity={0.8}
          >
            <Text style={s.emptyHeroIcon}>📖</Text>
            <Text style={s.emptyHeroTitle}>What are you reading?</Text>
            <Text style={s.emptyHeroSub}>Add your book and start building your notes.</Text>
            <View style={s.emptyHeroBtn}>
              <Text style={s.emptyHeroBtnTxt}>Find your book →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Stats — Books / Notes / Streak ──────────────────────── */}
        <View style={s.goalsWrap}>
          {goalsConfig.map(g => (
            <GoalCard
              key={g.id}
              baseLabel={g.baseLabel}
              current={g.current}
              range={g.range}
              onChangeRange={g.onChangeRange}
            />
          ))}
          <StreakCard
            streak={currentStreak}
            onPress={() => setStreakModalOpen(true)}
          />
        </View>

        {/* ── COLLECTIONS TABS — Finished / Want to Read / Reflections ── */}
        <View style={s.collectionTabs}>
          {COLLECTION_TABS.map(tab => {
            const active = tab.id === activeCollection;
            return (
              <TouchableOpacity
                key={tab.id}
                style={s.collectionTab}
                onPress={() => setActiveCollection(tab.id)}
                activeOpacity={0.6}
              >
                <Text style={[s.collectionTabTxt, active && s.collectionTabTxtActive]}>
                  {tab.label}
                </Text>
                {active && <View style={s.collectionTabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reflections list lives in the header because it's a separate
            render path. The grid below virtualises through FlatList. */}
        {activeCollection === 'reflections' && (
          <View style={s.reflectionsList}>
            {reflections.length === 0 ? (
              <View style={s.collectionEmpty}>
                <Text style={s.collectionEmptyTxt}>
                  No reflections yet. Tap a date on the calendar above to write your first.
                </Text>
              </View>
            ) : (
              [...reflections]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(r => {
                  const firstLine = (r.text || '').split('\n').find(l => l.trim()) || '';
                  const [y, m, d] = r.date.split('-').map(Number);
                  const date = new Date(y, m - 1, d);
                  const dayLabel = date.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  });
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={s.reflectionRow}
                      onPress={() => setReflectionDate(r.date)}
                      activeOpacity={0.85}
                    >
                      <View style={s.reflectionRowIcon}>
                        <Ionicons name="create" size={16} color={C.amber} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reflectionRowDate}>{dayLabel}</Text>
                        <Text style={s.reflectionRowBody} numberOfLines={2}>
                          {firstLine}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={C.inkFaint} />
                    </TouchableOpacity>
                  );
                })
            )}
          </View>
        )}
    </>
  );

  const renderTile = ({ item: b }) => (
    <TouchableOpacity
      style={[s.tile, { marginBottom: TILE_GUTTER }]}
      onPress={() => navigation.navigate('BookDetail', { bookId: b.id })}
      activeOpacity={0.85}
    >
      <View style={s.tileCover}>
        <BookCover
          title={b.title}
          author={b.author}
          cover={b.cover}
          coverId={b.coverId}
          width={TILE_W}
          height={TILE_H}
        />
        {b.status === 'finished' && (
          <View style={s.tileCheck}>
            <Ionicons name="checkmark" size={11} color={C.white} />
          </View>
        )}
      </View>
      <Text style={s.tileTitle} numberOfLines={2}>{b.title}</Text>
      <Text style={s.tileAuthor} numberOfLines={1}>{b.author}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        // `key` forces remount when the column count or collection mode
        // changes — FlatList can't switch numColumns without remounting.
        key={`${activeCollection}-${numColumns}`}
        data={showGrid ? collectionBooks : []}
        keyExtractor={b => b.id}
        renderItem={renderTile}
        numColumns={showGrid ? numColumns : 1}
        columnWrapperStyle={showGrid && numColumns > 1
          ? { paddingHorizontal: 20, gap: TILE_GUTTER }
          : undefined}
        ListHeaderComponent={header}
        ListEmptyComponent={
          showGrid ? (
            <TouchableOpacity
              style={[s.collectionEmpty, { paddingHorizontal: 20 }]}
              onPress={() => navigation.navigate('Add')}
              activeOpacity={0.7}
            >
              <Text style={s.collectionEmptyTxt}>
                {activeCollection === 'finished'
                  ? 'No finished books yet.'
                  : 'Nothing saved to read later yet.'}
              </Text>
              <Text style={s.collectionEmptyLink}>+ Add a book →</Text>
            </TouchableOpacity>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 130 }} />}
        contentContainerStyle={showGrid ? { paddingTop: 20 } : undefined}
        showsVerticalScrollIndicator={false}
        bounces
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={9}
        maxToRenderPerBatch={9}
      />

      {/* Full-screen reflection page — opens from the Reflections list rows.
          Closing simply clears the date so the same row can be tapped again. */}
      <ReflectionPage
        visible={!!reflectionDate}
        dateKey={reflectionDate}
        onClose={() => setReflectionDate(null)}
      />

      {/* Active Day Streak — opens when the streak card is tapped */}
      <StreakActivityModal
        visible={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
      />
    </SafeAreaView>
  );
}