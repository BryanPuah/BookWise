import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { ReadingTimeline } from '../components/ReadingTimeline';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');
const HERO_W = SW - 40;

// ── Default goals (TODO: wire to store when goals slice exists) ────────
// ── Range definitions — single source of truth for label/order ────────
const RANGES = ['day', 'week', 'month', 'year'];
const RANGE_META = {
  day:   { label: 'today',      shortLabel: 'Today' },
  week:  { label: 'this week',  shortLabel: 'This week' },
  month: { label: 'this month', shortLabel: 'This month' },
  year:  { label: 'this year',  shortLabel: 'This year' },
};

// ── Helpers ────────────────────────────────────────────────────────────
function startOfRange(range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'day')   return d;
  if (range === 'week') {
    // Monday-start week
    const dayIdx = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayIdx);
    return d;
  }
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  /* year */             return new Date(d.getFullYear(), 0, 1);
}

// ── Range picker modal ────────────────────────────────────────────────
function RangePickerModal({ visible, currentRange, onSelect, onClose }) {
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
function GoalCard({ icon, baseLabel, current, range, onChangeRange }) {
  const meta = RANGE_META[range];
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={s.goalCard}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.7}
      >
        <View style={s.goalBody}>
          <View style={s.goalLabelWrap}>
            <Text style={s.goalIcon}>{icon}</Text>
            <Text style={s.goalLabel} numberOfLines={1}>
              {baseLabel} {meta.label}
            </Text>
          </View>
          <Text style={s.goalCountNum}>{current}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
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

// ── Main screen ────────────────────────────────────────────────────────
export function HomeScreen({ navigation }) {
  const { books, notes, cards, dueCards, readingBooks } = useStore();
  const [activeIdx, setActiveIdx] = useState(0);
  const heroScrollRef = useRef(null);

  // Per-card active range
  const [booksRange, setBooksRange] = useState('year');
  const [notesRange, setNotesRange] = useState('week');

  const finished   = books.filter(b => b.status === 'finished');
  const wantToRead = books.filter(b => b.status === 'want_to_read');

  // ── Goal counts (range-aware, computed from real data) ────────────
  // Books count reflects books marked as finished within the active range.
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

  // ── Greeting ───────────────────────────────────────────────────────
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ── Goals config ───────────────────────────────────────────────────
  const goalsConfig = [
    {
      id: 'books',
      icon: '📚',
      baseLabel: 'Books finished',
      current: booksInRange,
      range: booksRange,
      onChangeRange: setBooksRange,
    },
    {
      id: 'notes',
      icon: '✍️',
      baseLabel: 'Notes captured',
      current: notesInRange,
      range: notesRange,
      onChangeRange: setNotesRange,
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── TOP BAR ─────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <Text style={s.greeting}>{greeting}</Text>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-outline" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* ── READING TIMELINE ────────────────────────────────────── */}
        <ReadingTimeline notes={notes} cards={cards} books={books} />

        {/* ── YOUR LIBRARY label + Add pill ───────────────────────── */}
        <View style={s.libraryHeader}>
          <Text style={s.libraryHeaderTitle}>Your Library</Text>
          <TouchableOpacity
            style={s.addPill}
            onPress={() => navigation.navigate('Discover')}
            activeOpacity={0.8}
          >
            <Text style={s.addPillTxt}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── CURRENTLY READING HERO ──────────────────────────────── */}
        {readingBooks.length > 0 ? (
          <View style={s.heroCard}>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              style={{ height: 280 }}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
                setActiveIdx(Math.min(idx, readingBooks.length - 1));
              }}
            >
              {readingBooks.map((book) => {
                const bNotes = notes.filter(n => n.bookId === book.id);
                const prog   = book.currentPage / (book.pageCount || 1);
                return (
                  <TouchableOpacity
                    key={book.id}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('BookDetail', { bookId: book.id, tab: 'notes' })}
                    style={{ width: HERO_W }}
                  >
                    <LinearGradient
                      colors={[C.heroTop, C.heroBot]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.heroGradient}
                    >
                      <View style={s.heroCoverCol}>
                        <BookCover title={book.title} author={book.author}
                          cover={book.cover} coverId={book.coverId} width={118} height={168} />
                      </View>
                      <View style={s.heroInfoCol}>
                        <View style={s.heroBadgeRow}>
                          <View style={s.heroFormatBadge}>
                            <Text style={s.heroFormatBadgeTxt} numberOfLines={1}>
                              {(book.format || 'Book').toUpperCase()}
                            </Text>
                          </View>
                          <View style={s.heroBadge}>
                            <Text style={s.heroBadgeTxt}>NOW READING</Text>
                          </View>
                        </View>
                        <Text style={s.heroTitle} numberOfLines={3}>{book.title}</Text>
                        <Text style={s.heroAuthor}>{book.author}</Text>
                        <View style={s.heroProgressWrap}>
                          <View style={s.heroProgressRow}>
                            <Text style={s.heroProgressLbl}>Page {book.currentPage} of {book.pageCount}</Text>
                            <Text style={s.heroProgressPct}>{Math.round(prog * 100)}%</Text>
                          </View>
                          <View style={s.heroTrack}>
                            <View style={[s.heroFill, { width: `${Math.round(prog * 100)}%` }]} />
                          </View>
                        </View>
                        {bNotes.length > 0 && (
                          <Text style={s.heroNoteCount}>
                            📝 {bNotes.length} note{bNotes.length !== 1 ? 's' : ''}
                          </Text>
                        )}
                        <View style={s.heroContinueBtn}>
                          <Text style={s.heroContinueTxt}>Review Notes →</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Dots */}
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
            onPress={() => navigation.navigate('Discover')}
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

        {/* ── Goals ──────────────────────────────────────────────── */}
        <View style={s.goalsWrap}>
          {goalsConfig.map(g => (
            <GoalCard
              key={g.id}
              icon={g.icon}
              baseLabel={g.baseLabel}
              current={g.current}
              range={g.range}
              onChangeRange={g.onChangeRange}
            />
          ))}
        </View>

        {/* ── REVIEW PROMPT ───────────────────────────────────────── */}
        {dueCards.length > 0 && (
          <TouchableOpacity
            style={s.reviewBanner}
            onPress={() => navigation.getParent('MainTabs')?.navigate('Review')}
            activeOpacity={0.85}
          >
            <View style={s.reviewLeft}>
              <Text style={s.reviewNum}>{dueCards.length}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reviewTitle}>Flashcards ready</Text>
              <Text style={s.reviewSub}>Review now to retain what you've read</Text>
            </View>
            <Text style={{ color: C.amber, fontSize: 20, fontWeight: '600' }}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── READ LATER ──────────────────────────────────────────── */}
        <View style={s.readLaterHeader}>
          <Text style={s.readLaterTitle}>🔖  Read Later</Text>
          {wantToRead.length > 0 && (
            <View style={s.shelfCardBadge}>
              <Text style={s.shelfCardBadgeTxt}>{wantToRead.length}</Text>
            </View>
          )}
        </View>

        <View style={[s.shelfCard, { marginBottom: 110 }]}>
          {wantToRead.length === 0 ? (
            <TouchableOpacity
              style={s.shelfEmpty}
              onPress={() => navigation.navigate('Discover')}
              activeOpacity={0.8}
            >
              <Text style={s.shelfEmptyIcon}>＋</Text>
              <Text style={s.shelfEmptyTxt}>Save books to read next</Text>
              <Text style={s.shelfEmptyArrow}>→</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 20, paddingTop: 16, gap: 14 }}
            >
              {wantToRead.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={s.shelfBook}
                  onPress={() => navigation.navigate('BookDetail', { bookId: b.id })}
                  activeOpacity={0.8}
                >
                  <BookCover
                    title={b.title}
                    author={b.author}
                    cover={b.cover}
                    coverId={b.coverId}
                    width={96}
                    height={136}
                  />
                  <Text style={s.shelfTitle} numberOfLines={2}>{b.title}</Text>
                  <Text style={s.shelfAuthor} numberOfLines={1}>{b.author}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
  },
  greeting: { fontSize: 30, color: C.ink, fontWeight: '700', letterSpacing: -0.6 },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.cream,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section headers
  sectionH1: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 12 },

  // Your Library heading row (title + Add pill)
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  libraryHeaderTitle: {
    fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4,
  },
  addPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.amberPale,
    borderWidth: 1,
    borderColor: C.amber,
  },
  addPillTxt: {
    fontSize: 13, fontWeight: '600', color: C.amber, letterSpacing: -0.1,
  },

  // Hero card (unchanged)
  heroCard: {
    marginHorizontal: 20, borderRadius: 20, overflow: 'hidden',
    marginBottom: 16, height: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
  },
  heroGradient: {
    flexDirection: 'row', padding: 20, gap: 18,
    alignItems: 'flex-start', height: 280, paddingBottom: 36,
  },
  heroCoverCol: {
    shadowColor: '#000', shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  heroInfoCol: { flex: 1, paddingTop: 4 },
  heroBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  heroFormatBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  heroFormatBadgeTxt: {
    fontSize: 9, color: 'rgba(255,255,255,0.85)',
    fontWeight: '700', letterSpacing: 1.5,
  },
  heroBadge: {
    backgroundColor: 'rgba(200,131,42,0.25)',
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  heroBadgeTxt: { fontSize: 9, color: '#F0C878', fontWeight: '700', letterSpacing: 1.8 },
  heroTitle: {
    fontSize: 20, color: '#FFFFFF', fontWeight: '700',
    lineHeight: 26, letterSpacing: -0.3, marginBottom: 5,
  },
  heroAuthor: { fontSize: 12, color: 'rgba(255,255,255,0.50)', fontWeight: '300', marginBottom: 16 },
  heroProgressWrap: { marginBottom: 8 },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  heroProgressLbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  heroProgressPct: { fontSize: 11, color: '#F0C878', fontWeight: '600' },
  heroTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  heroFill: { height: 3, backgroundColor: C.amberLight, borderRadius: 2 },
  heroNoteCount: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  dotsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, position: 'absolute', bottom: 10, left: 0, right: 0 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: C.amber },
  dotEdge:   { width: 4, height: 4, borderRadius: 2, opacity: 0.3 },
  heroContinueBtn: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    alignSelf: 'flex-start', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroContinueTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  emptyHero: {
    marginHorizontal: 20, backgroundColor: C.creamDark, borderRadius: 20,
    padding: 32, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
  },
  emptyHeroIcon:   { fontSize: 36, marginBottom: 12 },
  emptyHeroTitle:  { fontSize: 16, color: C.ink, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyHeroSub:    { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyHeroBtn:    { backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  emptyHeroBtnTxt: { color: C.white, fontSize: 13, fontWeight: '600' },

  // ── Goals ────────────────────────────────────────────────────────
  goalsWrap: {
    marginHorizontal: 20,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  goalBody: {
    flex: 1,
  },
  goalLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  goalIcon:  { fontSize: 15 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: C.inkSoft, letterSpacing: -0.1 },
  goalCountNum: {
    fontSize: 36, fontWeight: '800', color: C.ink,
    letterSpacing: -1.2, lineHeight: 40,
  },

  // ── Review banner ────────────────────────────────────────────────
  reviewBanner: {
    marginHorizontal: 20, backgroundColor: C.amberPale, borderRadius: 14,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(184,114,10,0.2)',
    marginTop: 24, marginBottom: 8,
  },
  reviewLeft: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
  },
  reviewNum: { fontSize: 18, fontWeight: '800', color: C.white },
  reviewTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  reviewSub: { fontSize: 11, color: C.inkMuted, marginTop: 2 },

  // ── Read Later ───────────────────────────────────────────────────
  readLaterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  readLaterTitle:  { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  shelfCard: {
    marginHorizontal: 20, marginTop: 0,
    backgroundColor: C.cream,
    borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  shelfCardBadge: {
    backgroundColor: C.ink, paddingHorizontal: 9,
    paddingVertical: 3, borderRadius: 20,
  },
  shelfCardBadgeTxt: { fontSize: 11, color: C.white, fontWeight: '700' },
  shelfEmpty:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 18 },
  shelfEmptyIcon: { fontSize: 18, color: C.inkFaint },
  shelfEmptyTxt:  { flex: 1, fontSize: 13, color: C.inkMuted },
  shelfEmptyArrow:{ fontSize: 14, color: C.amber, fontWeight: '600' },
  shelfBook: { width: 96, marginRight: 12 },
  shelfTitle: { fontSize: 11, fontWeight: '600', color: C.ink, marginTop: 9, lineHeight: 15 },
  shelfAuthor: { fontSize: 10, color: C.inkMuted, marginTop: 2 },
});

// ── Goal editor styles ───────────────────────────────────────────────
// ── Range picker styles ───────────────────────────────────────────────
const rp = StyleSheet.create({
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
    fontSize: 15, fontWeight: '500', color: C.ink, letterSpacing: -0.2,
  },
  rowTxtActive: {
    color: C.amber, fontWeight: '700',
  },
});

// ── Goal editor styles ────────────────────────────────────────────────
const ge = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.paper,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3, marginBottom: 4 },
  sub: { fontSize: 13, color: C.inkMuted, marginBottom: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
    paddingVertical: 10,
  },
  unit: { fontSize: 14, color: C.inkMuted, fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnGhost: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12,
    backgroundColor: C.cream,
  },
  btnGhostTxt: { fontSize: 14, color: C.inkSoft, fontWeight: '600' },
  btnPrimary: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderRadius: 12,
    backgroundColor: C.ink,
  },
  btnPrimaryTxt: { fontSize: 14, color: C.white, fontWeight: '700' },
});