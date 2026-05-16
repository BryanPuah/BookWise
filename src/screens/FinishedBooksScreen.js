import React, { useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { useTheme } from '../theme';

function StarRow({ rating = 0 }) {
  const { C, F } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Text key={s} style={{ fontFamily: F.serif, fontSize: 11, color: s <= rating ? C.amber : C.creamDark }}>
          {s <= rating ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

export function FinishedBooksScreen({ navigation }) {
  const { C, F, themeVersion } = useTheme();
  const { books } = useStore();
  // Newest-finished first. Reads `finishedAt` / `dateAdded` (schema fields)
  // and parses each to a numeric timestamp. Missing values sort to the end
  // (treated as -Infinity) so freshly-finished books surface at the top.
  const tsOf = (b) => {
    const raw = b.finishedAt || b.dateAdded;
    if (!raw) return -Infinity;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  const finished = books
    .filter(b => b.status === 'finished')
    .sort((a, b) => tsOf(b) - tsOf(a));

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: {
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    backBtnTxt: { fontFamily: F.serif, fontSize: 14, color: C.amber, fontWeight: '600' },
    title: { fontFamily: F.serif, fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.6 },
    sub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, marginTop: 4 },

    emptyWrap: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    emptyIcon: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { fontFamily: F.serif, fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    browseBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
    },
    browseBtnTxt: { fontFamily: F.sans, fontSize: 15, color: C.white, fontWeight: '700' },

    list: { padding: 20, gap: 12 },

    bookRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.white,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    bookInfo: { flex: 1 },
    bookTitle: {
      fontFamily: F.serif,
      fontSize: 15,
      fontWeight: '700',
      color: C.ink,
      lineHeight: 21,
      marginBottom: 3,
    },
    bookAuthor: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      marginBottom: 2,
    },
    bookMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 8,
    },
    metaPill: {
      backgroundColor: C.creamDark,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    metaPillTxt: { fontFamily: F.serif, fontSize: 10, color: C.inkMuted, fontWeight: '500' },
    arrow: { fontFamily: F.serif, fontSize: 22, color: C.inkFaint, fontWeight: '300' },
  }), [themeVersion]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={s.backBtnTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Books Read</Text>
        <Text style={s.sub}>
          {finished.length} book{finished.length !== 1 ? 's' : ''} completed
        </Text>
      </View>

      {/* Empty state */}
      {finished.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyIcon}>📗</Text>
          <Text style={s.emptyTitle}>No finished books yet</Text>
          <Text style={s.emptySub}>
            When you finish a book, mark it as finished from the book page and it will appear here.
          </Text>
          <TouchableOpacity
            style={s.browseBtn}
            onPress={() => navigation.navigate('Add')}
            activeOpacity={0.8}
          >
            <Text style={s.browseBtnTxt}>Add a book →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List of finished books */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.list}>
          {finished.map(book => (
            <TouchableOpacity
              key={book.id}
              style={s.bookRow}
              onPress={() => navigation.navigate('BookDetail', { bookId: book.id })}
              activeOpacity={0.8}
            >
              {/* Cover */}
              <BookCover
                title={book.title}
                author={book.author}
                cover={book.cover}
                coverId={book.coverId}
                width={64}
                height={92}
              />

              {/* Info */}
              <View style={s.bookInfo}>
                <Text style={s.bookTitle} numberOfLines={2}>{book.title}</Text>
                <Text style={s.bookAuthor} numberOfLines={1}>{book.author}</Text>
                {book.rating > 0 && <StarRow rating={book.rating} />}
                <View style={s.bookMeta}>
                  {book.pageCount > 0 && (
                    <View style={s.metaPill}>
                      <Text style={s.metaPillTxt}>{book.pageCount} pages</Text>
                    </View>
                  )}
                  {book.year && (
                    <View style={s.metaPill}>
                      <Text style={s.metaPillTxt}>{book.year}</Text>
                    </View>
                  )}
                  {book.genres?.[0] && (
                    <View style={s.metaPill}>
                      <Text style={s.metaPillTxt}>{book.genres[0]}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Arrow */}
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
