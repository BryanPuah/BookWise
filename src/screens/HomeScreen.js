import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, Dimensions,
  Modal, I18nManager,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore, todayKey as localTodayKey } from '../store';
import { BookCover } from '../components/BookCover';
import { ReadingTimeline } from '../components/ReadingTimeline';
import { AppHeader } from '../components/AppHeader';
import { ReflectionPage } from '../components/ReflectionPage';
import { StreakActivityModal } from '../components/StreakActivityModal';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { useTheme } from '../theme';

// RTL-aware forward chevron — picks the glyph that points "into the page".
const FORWARD_CHEVRON = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

// Single-shot navigation guard. Wraps navigation.navigate so 10 rapid taps
// push exactly one screen onto the stack instead of ten. The 600ms window
// matches typical stack push animation; the ref resets after that.
function useGuardedNavigate(navigation) {
  const lockRef = useRef(false);
  return useCallback((...args) => {
    if (lockRef.current) return;
    lockRef.current = true;
    navigation.navigate(...args);
    setTimeout(() => { lockRef.current = false; }, 600);
  }, [navigation]);
}

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
      backgroundColor: C.scrim,
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
      shadowColor: C.shadow,
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
      paddingHorizontal: 16, paddingVertical: 12,
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
                accessibilityRole="button"
                accessibilityLabel={RANGE_META[range].shortLabel}
                accessibilityState={{ selected: active }}
              >
                <Text style={[rp.rowTxt, active && rp.rowTxtActive]}>
                  {RANGE_META[range].shortLabel}
                </Text>
                {active && (
                  <Ionicons name="checkmark" size={18} color={C.amber} importantForAccessibility="no" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────
// Shared presentation for the three stats-row tiles (Books, Notes, Streak).
// Numerals use C.ink so the 40pt display number clears WCAG AA against
// every paper background — the icon stays accent-colored and is decorative
// (its meaning is repeated in the label below).
function StatCard({ icon, iconColor, value, label, onPress, align = 'flex-start' }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    stat: { flex: 1, alignItems: align },
    medal: { marginBottom: 10 },
    num: {
      fontFamily: F.serif,
      fontSize: 40, lineHeight: 46,
      color: C.ink,
      letterSpacing: -1,
      marginBottom: 6,
    },
    label: {
      fontFamily: F.serif,
      fontSize: 13, lineHeight: 17,
      color: C.inkSoft,
      fontWeight: '400',
      textAlign: align === 'flex-start' ? 'left' : align === 'flex-end' ? 'right' : 'center',
    },
  }), [themeVersion, align]);

  return (
    <TouchableOpacity style={s.stat} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={iconColor} style={s.medal} importantForAccessibility="no" />
      <Text style={s.num} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={s.label} numberOfLines={2} ellipsizeMode="tail">{label}</Text>
    </TouchableOpacity>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────
// Wraps StatCard with a range picker (today / this week / this month / year).
function GoalCard({ baseLabel, current, range, onChangeRange, align = 'flex-start' }) {
  const { C } = useTheme();
  const meta = RANGE_META[range];
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <StatCard
        icon="ribbon"
        iconColor={C.amber}
        value={current}
        label={`${baseLabel} ${meta.label}`}
        onPress={() => setPickerOpen(true)}
        align={align}
      />
      <RangePickerModal
        visible={pickerOpen}
        currentRange={range}
        onSelect={onChangeRange}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

// ── Hero book card ─────────────────────────────────────────────────────
// One slide of the currently-reading carousel. Pulled out so the parent
// FlatList can virtualize — only the visible page + a small windowSize
// of neighbours stays mounted, instead of all N reading books at once.
function HeroBookCard({ book, noteCount, onOpen, onAddNote, styles }) {
  const { C } = useTheme();
  const hasPages = book.pageCount > 0;
  const pct = hasPages
    ? Math.min(100, Math.max(0, Math.round((book.currentPage / book.pageCount) * 100)))
    : 0;
  const tag = book.genres?.[0] || book.format || 'Reading';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onOpen}
      style={{ width: HERO_W }}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}${book.author ? `, by ${book.author}` : ''}${
        hasPages ? `, ${pct}% read` : ', in progress'
      }`}
      accessibilityHint="Opens book details"
    >
      <View style={styles.heroInner}>
        <View style={styles.heroCoverCol}>
          <BookCover
            title={book.title}
            author={book.author}
            cover={book.cover}
            coverId={book.coverId}
            width={118}
            height={168}
          />
        </View>

        <View style={styles.heroInfoCol}>
          <View style={styles.heroTagPill}>
            <Text style={styles.heroTagPillTxt} numberOfLines={1}>
              {String(tag).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.heroTitle} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.heroAuthor} numberOfLines={1}>{book.author}</Text>

          <View style={styles.heroProgressRow}>
            <Text style={styles.heroProgressLbl}>
              {hasPages ? `Reading Progress: ${pct}%` : 'In progress'}
            </Text>
            {hasPages && (
              <Text style={styles.heroProgressPages}>
                {book.currentPage} / {book.pageCount} pages
              </Text>
            )}
          </View>
          {hasPages && (
            <View style={styles.heroTrack}>
              <View style={[styles.heroFill, { width: `${pct}%` }]} />
            </View>
          )}

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              onPress={onAddNote}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add note"
            >
              <Ionicons name="create-outline" size={14} color="#FFFFFF" importantForAccessibility="no" />
              <Text style={styles.heroPrimaryTxt}>Add Note</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              onPress={onOpen}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={hasPages ? `Reading progress ${pct} percent` : 'Open book'}
            >
              <Text style={styles.heroSecondaryTxt}>
                {hasPages ? `Reading Progress: ${pct}%` : 'Open book'}
              </Text>
            </TouchableOpacity>
          </View>

          {noteCount > 0 && (
            <Text style={styles.heroNoteCount}>
              {noteCount} note{noteCount !== 1 ? 's' : ''} captured
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export function HomeScreen({ navigation, route }) {
  const { C, F, themeVersion } = useTheme();
  const { books, notes, readingBooks, currentStreak, reflections, user, addNote } = useStore();

  // First name for the greeting — split on whitespace to handle "Julian Barnes" → "Julian".
  // Falls back to the whole name if no spaces (e.g. single-word names).
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'Reader';
  const [activeIdx, setActiveIdx] = useState(0);
  const heroScrollRef = useRef(null);

  // When a currently-reading book is removed, activeIdx can point past the
  // end of `readingBooks`. Clamp it so the carousel + dots always reference
  // a real slot. The clamp also fires when the array shrinks to zero
  // (`emptyHero` then handles the empty state).
  useEffect(() => {
    if (readingBooks.length === 0) {
      if (activeIdx !== 0) setActiveIdx(0);
      return;
    }
    if (activeIdx > readingBooks.length - 1) {
      setActiveIdx(readingBooks.length - 1);
    }
  }, [readingBooks.length, activeIdx]);

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
  // Note editor — opened from the hero "Add Note" button. Holds the
  // pre-selected book so RichNoteEditor can skip the BookPicker step.
  const [noteEditorBook, setNoteEditorBook] = useState(null);

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

  // Single pass through books to avoid two .filter() calls per render and
  // — more importantly — to keep the array identities stable across renders
  // when the source array hasn't changed, so the `collectionBooks` memo
  // below actually hits its cache.
  const { finished, wantToRead } = useMemo(() => {
    const f = [];
    const w = [];
    for (const b of books) {
      if (b.status === 'finished') f.push(b);
      else if (b.status === 'want_to_read') w.push(b);
    }
    return { finished: f, wantToRead: w };
  }, [books]);

  // First-time gate: zero books, zero notes, zero reflections. Drives the
  // "Get Started" card that replaces the currently-reading hero on first
  // launch so a fresh user gets an actionable next step instead of a
  // blank empty-hero with no context.
  const isFirstTime = books.length === 0 && notes.length === 0 && reflections.length === 0;
  const todayKey    = localTodayKey();

  // Books shown in the grid below the tab strip
  const collectionBooks = useMemo(() => {
    if (activeCollection === 'finished')     return finished;
    if (activeCollection === 'want_to_read') return wantToRead;
    return [];
  }, [activeCollection, finished, wantToRead]);

  // Sorted once per change to `reflections`. Without the memo, the sort
  // was running on every parent render — O(n log n) per keystroke on
  // adjacent unrelated state.
  const sortedReflections = useMemo(
    () => [...reflections].sort((a, b) => b.date.localeCompare(a.date)),
    [reflections],
  );

  // Note counts grouped by bookId — built once per `notes` change instead
  // of doing N filter passes inside the hero carousel render.
  const noteCountByBook = useMemo(() => {
    const m = new Map();
    for (const n of notes) {
      if (n.bookId) m.set(n.bookId, (m.get(n.bookId) || 0) + 1);
    }
    return m;
  }, [notes]);

  const guardedNavigate = useGuardedNavigate(navigation);

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
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    heroInner: {
      flexDirection: 'row',
      padding: 16,
      gap: 16,
      alignItems: 'flex-start',
      height: 260,
      paddingBottom: 32,
    },
    heroCoverCol: {
      shadowColor: C.shadow,
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
      paddingVertical: 4,
      borderRadius: 12,
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
    heroProgressLbl:   { fontFamily: F.sans, fontSize: 11, color: C.ink, fontWeight: '600' },
    heroProgressPages: { fontFamily: F.sans, fontSize: 11, color: C.inkMuted },
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
      gap: 4,
      backgroundColor: C.sage,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    heroPrimaryTxt: {
      fontFamily: F.serif,
      fontSize: 11,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    heroSecondaryBtn: {
      flex: 1,
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 8,
      paddingVertical: 8,
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
    emptyHeroBtn:    { backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyHeroBtnTxt: { fontFamily: F.sans, color: C.white, fontSize: 15, fontWeight: '700' },

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
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: C.shadow,
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

    // Stats row — wraps three StatCards (Books / Notes / Streak).
    // StatCard owns its own internal styles; this is just layout.
    goalsWrap: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      justifyContent: 'space-between',
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
          onManageGoals={() => guardedNavigate('Goals')}
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
              onPress={() => guardedNavigate('Add')}
              activeOpacity={0.7}
            >
              <Text style={s.welcomeStepIcon}>📚</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.welcomeStepTitle}>Add your first book</Text>
                <Text style={s.welcomeStepBody}>
                  Search OpenLibrary, or add a book, article, or PDF by hand.
                </Text>
              </View>
              <Ionicons name={FORWARD_CHEVRON} size={16} color={C.inkFaint} />
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
              <Ionicons name={FORWARD_CHEVRON} size={16} color={C.inkFaint} />
            </TouchableOpacity>
          </View>
        ) : readingBooks.length > 0 ? (() => {
          // Clamp inline as well so the first render after readingBooks
          // shrinks (e.g. user just deleted the active book) doesn't use
          // the stale activeIdx for dots / hero indexing.
          const safeActiveIdx = Math.min(activeIdx, readingBooks.length - 1);
          return (
          <View style={s.heroCard}>
            <FlatList
              ref={heroScrollRef}
              data={readingBooks}
              keyExtractor={b => b.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={HERO_W}
              snapToAlignment="start"
              disableIntervalMomentum
              style={{ height: 260 }}
              // Virtualization windows — most users have 1–3 currently-reading
              // books, but this caps memory if someone keeps a long shelf.
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              getItemLayout={(_, index) => ({
                length: HERO_W,
                offset: HERO_W * index,
                index,
              })}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
                setActiveIdx(Math.min(idx, readingBooks.length - 1));
              }}
              renderItem={({ item: book }) => (
                <HeroBookCard
                  book={book}
                  noteCount={noteCountByBook.get(book.id) || 0}
                  onOpen={() => guardedNavigate('BookDetail', { bookId: book.id, tab: 'notes' })}
                  onAddNote={() => setNoteEditorBook(book)}
                  styles={s}
                />
              )}
            />

            {/* Dots — preserved exactly */}
            {readingBooks.length > 1 && (() => {
              const total = readingBooks.length;
              const MAX   = 4;
              if (total <= MAX) {
                return (
                  <View style={s.dotsRow} pointerEvents="none">
                    {Array.from({ length: total }, (_, i) => (
                      <View key={i} style={[s.dot, i === safeActiveIdx && s.dotActive]} />
                    ))}
                  </View>
                );
              }
              let windowStart;
              if (safeActiveIdx <= 1)              windowStart = 0;
              else if (safeActiveIdx >= total - 2) windowStart = total - MAX;
              else                                 windowStart = safeActiveIdx - 2;
              return (
                <View style={s.dotsRow} pointerEvents="none">
                  {Array.from({ length: MAX }, (_, k) => {
                    const realIdx = windowStart + k;
                    const isActive = realIdx === safeActiveIdx;
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
          );
        })() : (
          <TouchableOpacity
            style={s.emptyHero}
            onPress={() => guardedNavigate('Add')}
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
          <StatCard
            icon="flame"
            iconColor={C.rose}
            value={currentStreak > 0 ? currentStreak : '—'}
            label="Active Day Streak"
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
                // Expand effective tap target to ≥48pt vertical without
                // changing the visual padding — keeps the dense tab strip
                // but clears WCAG 2.2 target-size (44×44 iOS / 48×48 dp).
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
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
            {sortedReflections.length === 0 ? (
              <View style={s.collectionEmpty}>
                <Text style={s.collectionEmptyTxt}>
                  No reflections yet. Tap a date on the calendar above to write your first.
                </Text>
              </View>
            ) : (
              sortedReflections.map(r => {
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
                      <Ionicons name="create" size={16} color={C.amber} importantForAccessibility="no" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reflectionRowDate}>{dayLabel}</Text>
                      <Text style={s.reflectionRowBody} numberOfLines={2}>
                        {firstLine}
                      </Text>
                    </View>
                    <Ionicons name={FORWARD_CHEVRON} size={14} color={C.inkFaint} importantForAccessibility="no" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
    </>
  );

  const renderTile = ({ item: b }) => {
    const statusSuffix = b.status === 'finished' ? ', finished' : '';
    return (
      <TouchableOpacity
        style={[s.tile, { marginBottom: TILE_GUTTER }]}
        onPress={() => guardedNavigate('BookDetail', { bookId: b.id })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${b.title}${b.author ? `, by ${b.author}` : ''}${statusSuffix}`}
        accessibilityHint="Opens book details"
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
            <View style={s.tileCheck} importantForAccessibility="no-hide-descendants">
              <Ionicons name="checkmark" size={11} color={C.white} />
            </View>
          )}
        </View>
        <Text style={s.tileTitle} numberOfLines={2} importantForAccessibility="no">{b.title}</Text>
        <Text style={s.tileAuthor} numberOfLines={1} importantForAccessibility="no">{b.author}</Text>
      </TouchableOpacity>
    );
  };

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
              onPress={() => guardedNavigate('Add')}
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

      {/* Hero "Add Note" — opens the rich note editor with the hero book
          pre-selected so the BookPicker step is skipped. */}
      <RichNoteEditor
        visible={!!noteEditorBook}
        books={books}
        defaultBook={noteEditorBook}
        initialNote={null}
        onSave={(data) => {
          addNote({
            bookId: noteEditorBook?.id,
            bookTitle: noteEditorBook?.title,
            ...data,
          });
          setNoteEditorBook(null);
        }}
        onClose={() => setNoteEditorBook(null)}
      />
    </SafeAreaView>
  );
}