/**
 * BookPicker — step 1 of the new-note flow. Shows the user's active books
 * (anything not in "want to read") so they can choose which book the new
 * note is about. Skipped when a default book is passed in.
 */

import React, { useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../AppText';
import { BookCover } from '../BookCover';
import { useTheme } from '../../theme';

export function BookPicker({ books, onPick, onCancel }) {
  const { C, F, themeVersion } = useTheme();
  const bp = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    cancel: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted },
    title: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
    strip: { backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    stripTxt: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
    bookRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.white, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: C.border,
    },
    bookTitle: { fontFamily: F.serif, fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
    bookAuthor: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginBottom: 8 },
    statusPill: { alignSelf: 'flex-start', backgroundColor: C.amberPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statusTxt: { fontFamily: F.serif, fontSize: 11, fontWeight: '600', color: C.ink },
  }), [themeVersion]);
  const activeBooks = books.filter(b => b.status !== 'want_to_read');

  return (
    <SafeAreaView style={bp.safe}>
      <View style={bp.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={bp.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={bp.title}>New Note</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={bp.strip}>
        <Text style={bp.stripTxt}>Which book is this note about?</Text>
      </View>

      {activeBooks.length === 0 ? (
        <View style={bp.empty}>
          <Text style={bp.emptyIcon}>📚</Text>
          <Text style={bp.emptyTitle}>No books in progress</Text>
          <Text style={bp.emptySub}>Go to the Add tab to find your first book — then come back here to capture notes.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          {activeBooks.map(b => (
            <TouchableOpacity
              key={b.id}
              style={bp.bookRow}
              onPress={() => onPick(b)}
              activeOpacity={0.85}
            >
              <BookCover title={b.title} author={b.author} cover={b.cover}
                coverId={b.coverId} width={48} height={68} />
              <View style={{ flex: 1 }}>
                <Text style={bp.bookTitle} numberOfLines={2}>{b.title}</Text>
                <Text style={bp.bookAuthor}>{b.author}</Text>
                <View style={bp.statusPill}>
                  <Text style={bp.statusTxt}>
                    {b.status === 'reading' ? '📖 Reading' : b.status === 'finished' ? '✓ Finished' : 'Want to read'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
