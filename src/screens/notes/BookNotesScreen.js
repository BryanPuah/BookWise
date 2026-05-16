/**
 * BookNotesScreen — dedicated full-screen list of every note for a single
 * book. Reached by tapping a book row inside ByBookView.
 */

import React, { useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { BookCover } from '../../components/BookCover';
import { useTheme } from '../../theme';
import { NoteCard } from './NoteCard';
import { useNT, noteHasType } from './shared';

export function BookNotesScreen({ book, notes, onStar, onDelete, onEdit, onBack, navigation }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
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

  const starred = notes.filter(n => n.starred).length;

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

      <FlatList
        data={sorted}
        keyExtractor={n => n.id}
        renderItem={({ item }) => (
          <NoteCard note={item} onDelete={onDelete} onEdit={onEdit} />
        )}
        ListEmptyComponent={
          <View style={bns.empty}>
            <Text style={bns.emptyIcon}>📝</Text>
            <Text style={bns.emptyTitle}>No notes yet</Text>
            <Text style={bns.emptySub}>Tap the + button to capture your first thought.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={11}
        maxToRenderPerBatch={8}
      />
    </View>
  );
}
