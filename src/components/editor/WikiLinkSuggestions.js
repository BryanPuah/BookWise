/**
 * WikiLinkSuggestions — dropdown rendered inline below a block whose
 * cursor is sitting inside a `[[...` pattern. Tapping a row calls
 * onCommit with the chosen label.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../AppText';
import { useTheme } from '../../theme';

export function WikiLinkSuggestions({ visible, query, suggestions, onCommit }) {
  const { C, F, themeVersion } = useTheme();
  const ws = useMemo(() => StyleSheet.create({
    wrap: {
      marginHorizontal: 20, marginTop: -10, marginBottom: 14,
      backgroundColor: C.white,
      borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 10, elevation: 6,
      overflow: 'hidden',
      maxHeight: 280,
    },
    section: {
      paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
      fontFamily: F.sans, fontSize: 9, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1.2,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 9,
    },
    rowDivider: { borderBottomWidth: 0.5, borderBottomColor: C.border },
    rowIcon: { width: 14, alignItems: 'center' },
    rowTxt: { flex: 1, fontFamily: F.serif, fontSize: 13, color: C.ink },
    rowHint: { fontFamily: F.serif, fontSize: 11, color: C.inkFaint },
    createRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: C.cream,
    },
    createTxt: { fontFamily: F.serif, fontSize: 13, color: C.inkSoft, fontWeight: '600' },
  }), [themeVersion]);

  if (!visible) return null;

  const noteList = suggestions.notes || [];
  const bookList = suggestions.books || [];
  const hasMatches = noteList.length + bookList.length > 0;
  const trimmed = (query || '').trim();
  const showCreate = trimmed.length > 0 &&
    !noteList.some(n => n.title?.trim().toLowerCase() === trimmed.toLowerCase()) &&
    !bookList.some(b => b.title?.trim().toLowerCase() === trimmed.toLowerCase());

  return (
    <View style={ws.wrap}>
      {noteList.length > 0 && (
        <View>
          <Text style={ws.section}>NOTES</Text>
          {noteList.map((n, i) => (
            <TouchableOpacity
              key={`n-${n.id}`}
              style={[ws.row, i < noteList.length - 1 && ws.rowDivider]}
              activeOpacity={0.6}
              onPress={() => onCommit(n.title.trim())}
            >
              <View style={ws.rowIcon}>
                <Ionicons name="reader-outline" size={13} color={C.inkSoft} />
              </View>
              <Text style={ws.rowTxt} numberOfLines={1}>{n.title.trim()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {bookList.length > 0 && (
        <View>
          <Text style={ws.section}>BOOKS</Text>
          {bookList.map((b, i) => (
            <TouchableOpacity
              key={`b-${b.id}`}
              style={[ws.row, i < bookList.length - 1 && ws.rowDivider]}
              activeOpacity={0.6}
              onPress={() => onCommit(b.title)}
            >
              <View style={ws.rowIcon}>
                <Ionicons name="book-outline" size={13} color={C.inkSoft} />
              </View>
              <Text style={ws.rowTxt} numberOfLines={1}>{b.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showCreate && (
        <TouchableOpacity
          style={ws.createRow}
          activeOpacity={0.7}
          onPress={() => onCommit(trimmed)}
        >
          <Ionicons name="add" size={13} color={C.inkSoft} />
          <Text style={ws.createTxt}>Insert "{trimmed}" as new link</Text>
        </TouchableOpacity>
      )}

      {!hasMatches && !showCreate && (
        <View style={ws.row}>
          <Text style={ws.rowHint}>Keep typing to search notes & books…</Text>
        </View>
      )}
    </View>
  );
}
