/**
 * ByBookView — list of books that have notes attached, ordered freely.
 * Tapping a row drills into the BookNotesScreen for that book.
 */

import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { BookCover } from '../../components/BookCover';
import { useTheme } from '../../theme';
import { useNT, NotesEmptyState } from './shared';
import { BookNotesScreen } from './BookNotesScreen';

export function ByBookView({ notes, books, onStar, onDelete, navigation, onEdit, onCapture }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
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
  }), [themeVersion]);

  const [selectedBook, setSelectedBook] = useState(null);

  const grouped = useMemo(() => {
    const ids = [...new Set(notes.map(n => n.bookId))];
    return ids.map(id => {
      const book = books.find(b => b.id === id);
      const groupNotes = notes.filter(n => n.bookId === id);
      // Synthesize a placeholder book for orphan groups (book deleted, or
      // note saved without a bookId) so the notes don't disappear from the
      // view. Title falls back to whatever was denormalized on the note.
      const bookForGroup = book || {
        id: id || '__unattached__',
        title: groupNotes[0]?.bookTitle?.trim() || 'Removed book',
        author: '',
        cover: 'slate',
        coverId: null,
      };
      return { book: bookForGroup, notes: groupNotes, isOrphan: !book };
    });
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
          onCapture={onCapture}
          onBack={() => setSelectedBook(null)}
          navigation={navigation}
        />
      );
    }
  }

  const renderGroup = ({ item }) => {
    const { book, notes: bn, isOrphan } = item;
    const starred = bn.filter(n => n.starred).length;
    const typeCounts = Object.entries(NT).reduce((a, [k]) => {
      const c = bn.filter(n => n.type === k).length;
      if (c > 0) a.push({ key: k, count: c, ...NT[k] });
      return a;
    }, []);

    return (
      <TouchableOpacity
        style={bbv.bookBlock}
        onPress={() => setSelectedBook(book.id)}
        activeOpacity={0.85}
      >
        <View style={bbv.bookHead}>
          <BookCover title={book.title} author={book.author} cover={book.cover}
            coverId={book.coverId} width={48} height={68} />
          <View style={bbv.bookMeta}>
            <Text style={bbv.bookTitle} numberOfLines={1}>{book.title}</Text>
            <Text style={bbv.bookAuthor}>
              {isOrphan ? 'Book no longer in library' : book.author}
            </Text>
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
  };

  return (
    <FlatList
      data={grouped}
      keyExtractor={g => g.book.id}
      renderItem={renderGroup}
      ListEmptyComponent={
        <NotesEmptyState
          icon="📚"
          title="No notes yet"
          sub="Notes you capture from your books will gather here, grouped under each title."
          onCapture={onCapture}
        />
      }
      ListFooterComponent={<View style={{ height: 140 }} />}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={10}
      windowSize={11}
      maxToRenderPerBatch={10}
    />
  );
}
