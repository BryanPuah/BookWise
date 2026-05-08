import React, { useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { ReadingTimeline } from '../components/ReadingTimeline';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');
const HERO_W = SW - 40; // matches marginHorizontal: 20 on the card

export function HomeScreen({ navigation }) {
  const { books, notes, cards, dueCards, readingBooks } = useStore();
  const [activeIdx, setActiveIdx] = React.useState(0);
  const heroScrollRef = useRef(null);

  const currentBook = readingBooks[activeIdx] || null;
  const finished   = books.filter(b => b.status === 'finished');
  const wantToRead = books.filter(b => b.status === 'want_to_read');

  // Streak — days since last note or review (simple: just show notes count as momentum)
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const recentNotes = notes.filter(n => {
    const d = new Date(n.date);
    const today = new Date();
    const diff = (today - d) / 86400000;
    return diff <= 7;
  }).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── TOP BAR ─────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <View>
            <Text style={s.greeting}>{greeting}</Text>
          </View>
        </View>

        {/* ── READING TIMELINE ────────────────────────────────────── */}
        <ReadingTimeline notes={notes} cards={cards} books={books} />

        {/* ── YOUR LIBRARY label ──────────────────────────────────── */}
        <Text style={s.libraryLabel}>Your Library</Text>

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
                        <View style={s.heroBadge}>
                          <Text style={s.heroBadgeTxt}>NOW READING</Text>
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

            {/* Dots inside card */}
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

        {/* ── STATS — reframed as growth metrics ──────────────────── */}
        <View style={s.statsRow}>

          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('FinishedBooks')}
          >
            <Text style={s.statNum}>{finished.length}</Text>
            <Text style={s.statLbl}>Finished</Text>
            <Text style={s.statArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.75}
            onPress={() => navigation.getParent('MainTabs')?.navigate('Notes')}
          >
            <Text style={s.statNum}>{notes.length}</Text>
            <Text style={s.statLbl}>All notes</Text>
            <Text style={s.statArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.statCard, dueCards.length > 0 && s.statCardAmber]}
            activeOpacity={0.75}
            onPress={() => navigation.getParent('MainTabs')?.navigate('Review')}
          >
            <Text style={[s.statNum, dueCards.length > 0 && { color: C.amber }]}>
              {recentNotes}
            </Text>
            <Text style={s.statLbl}>This week</Text>
            {recentNotes > 0 && <Text style={[s.statArrow, { color: C.amber }]}>🔥</Text>}
          </TouchableOpacity>

        </View>

        {/* ── REVIEW PROMPT — stronger copy ───────────────────────── */}
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

        {/* ── WANT TO READ — always visible ────────────────────────── */}
        {/* ── READ LATER label above card ── */}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Top bar — headline-forward
  topBar: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
  },
  greeting: { fontSize: 30, color: C.ink, fontWeight: '700', letterSpacing: -0.6 },
  pageTitle: { fontSize: 13, color: C.inkMuted, fontWeight: '400', marginTop: 2 },
  libraryLabel: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 12 },
  addBtn: {
    backgroundColor: C.ink, paddingHorizontal: 14,
    paddingVertical: 9, borderRadius: 22, marginTop: 4,
  },
  addBtnTxt: { color: C.white, fontSize: 12, fontWeight: '600' },

  // Hero card
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
  heroBadge: {
    backgroundColor: 'rgba(200,131,42,0.25)',
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, marginBottom: 10,
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
  dotNear:   { width: 6, height: 6, opacity: 0.6 },
  dotEdge:   { width: 4, height: 4, borderRadius: 2, opacity: 0.3 },
  heroContinueBtn: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    alignSelf: 'flex-start', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroContinueTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Empty hero
  emptyHero: {
    marginHorizontal: 20, backgroundColor: C.creamDark, borderRadius: 20,
    padding: 32, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
  },
  emptyHeroGrad:   {},
  emptyHeroIcon:   { fontSize: 36, marginBottom: 12 },
  emptyHeroTitle:  { fontSize: 16, color: C.ink, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyHeroSub:    { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyHeroSub:    {},
  emptyHeroBtn:    { backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  emptyHeroBtnTxt: { color: C.white, fontSize: 13, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: C.cream, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  statCardAmber: { backgroundColor: C.amberPale, borderColor: 'rgba(184,114,10,0.25)' },
  statNum: { fontSize: 28, fontWeight: '700', color: C.ink, lineHeight: 32 },
  statLbl: { fontSize: 10, color: C.inkMuted, marginTop: 3, fontWeight: '400' },
  statArrow: { fontSize: 13, color: C.inkFaint, marginTop: 5 },

  // Review banner — stronger
  reviewBanner: {
    marginHorizontal: 20, backgroundColor: C.amberPale, borderRadius: 14,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(184,114,10,0.2)', marginBottom: 8,
  },
  reviewLeft: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
  },
  reviewNum: { fontSize: 18, fontWeight: '800', color: C.white },
  reviewTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  reviewSub: { fontSize: 11, color: C.inkMuted, marginTop: 2 },

  // Shelves
  section: { marginTop: 20 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
  sectionCount: { fontSize: 13, color: C.inkMuted },
  shelfEmpty:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 18 },
  shelfEmptyIcon: { fontSize: 18, color: C.inkFaint },
  shelfEmptyTxt:  { flex: 1, fontSize: 13, color: C.inkMuted },
  shelfEmptyArrow:{ fontSize: 14, color: C.amber, fontWeight: '600' },
  shelfBook: { width: 96, marginRight: 12 },
  shelfTitle: { fontSize: 11, fontWeight: '600', color: C.ink, marginTop: 9, lineHeight: 15 },
  shelfAuthor: { fontSize: 10, color: C.inkMuted, marginTop: 2 },

  // Want to read — pill card
  readLaterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  readLaterTitle:  { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4, paddingHorizontal: 0 },
  shelfCard: {
    marginHorizontal: 20, marginTop: 0,
    backgroundColor: C.cream,
    borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  shelfCardHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  shelfCardLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shelfCardIcon: { fontSize: 16 },
  shelfCardBadge: {
    backgroundColor: C.ink, paddingHorizontal: 9,
    paddingVertical: 3, borderRadius: 20,
  },
  shelfCardBadgeTxt: { fontSize: 11, color: C.white, fontWeight: '700' },
});