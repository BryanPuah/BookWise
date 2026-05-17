/**
 * TrashView — soft-deleted notes awaiting auto-purge.
 *
 * Notes land here when the user swipes-to-delete or taps Delete in the
 * editor. Each row offers Restore (un-trash) and Delete forever (purge
 * now). A 30-day retention window auto-purges on the next hydration —
 * see `TRASH_RETENTION_MS` in store.js.
 */

import React, { useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { useStore, TRASH_RETENTION_MS } from '../../store';
import { useTheme } from '../../theme';
import { NotesEmptyState } from './shared';

function daysUntilPurge(deletedAt) {
  const t = Date.parse(deletedAt || '');
  if (Number.isNaN(t)) return null;
  const remainingMs = (t + TRASH_RETENTION_MS) - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export function TrashView() {
  const { C, F, themeVersion } = useTheme();
  const { trashedNotes, restoreNote, purgeNote, purgeAllTrashed } = useStore();

  const s = useMemo(() => StyleSheet.create({
    banner: {
      marginHorizontal: 20, marginBottom: 10, marginTop: 4,
      paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    bannerTxt: {
      flex: 1, fontFamily: F.serif, fontSize: 12,
      color: C.inkMuted, lineHeight: 18,
    },
    emptyBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.white,
      borderWidth: 0.5, borderColor: C.border,
    },
    emptyBtnTxt: { fontFamily: F.serif, fontSize: 12, color: C.rose, fontWeight: '700' },

    row: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      marginBottom: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    rowHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, marginBottom: 6,
    },
    rowTitle: { flex: 1, fontFamily: F.serif, fontSize: 15, color: C.ink, letterSpacing: -0.2 },
    rowMeta: { fontFamily: F.sans, fontSize: 10, color: C.inkFaint, fontWeight: '700', letterSpacing: 0.6 },
    rowBody: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, lineHeight: 19, marginBottom: 10 },
    actions: {
      flexDirection: 'row', gap: 8, justifyContent: 'flex-end',
    },
    restoreBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: C.sagePale,
    },
    restoreTxt: { fontFamily: F.serif, fontSize: 12, color: C.ink, fontWeight: '700' },
    purgeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: C.white,
      borderWidth: 0.5, borderColor: C.border,
    },
    purgeTxt: { fontFamily: F.serif, fontSize: 12, color: C.rose, fontWeight: '700' },
  }), [themeVersion]);

  const handlePurge = (note) => {
    Alert.alert(
      'Delete this note forever?',
      'This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: () => purgeNote(note.id) },
      ],
    );
  };

  const handleEmpty = () => {
    Alert.alert(
      'Empty Trash?',
      `Permanently delete ${trashedNotes.length} note${trashedNotes.length === 1 ? '' : 's'}. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Empty Trash', style: 'destructive', onPress: purgeAllTrashed },
      ],
    );
  };

  const renderRow = ({ item }) => {
    const head = (item.title?.trim()) || (item.text || '').split('\n')[0]?.slice(0, 80) || 'Untitled';
    const body = (item.text || '').split('\n').slice(0, 2).join(' · ').slice(0, 140);
    const days = daysUntilPurge(item.deletedAt);
    const dayLabel = days == null ? '' : days === 0 ? 'PURGING SOON' : `${days}D LEFT`;
    return (
      <View style={s.row}>
        <View style={s.rowHead}>
          <Text style={s.rowTitle} numberOfLines={2}>{head}</Text>
          {dayLabel ? <Text style={s.rowMeta}>{dayLabel}</Text> : null}
        </View>
        {body ? <Text style={s.rowBody} numberOfLines={3}>{body}</Text> : null}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.purgeBtn}
            onPress={() => handlePurge(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete forever"
          >
            <Ionicons name="trash-outline" size={13} color={C.rose} />
            <Text style={s.purgeTxt}>Delete forever</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.restoreBtn}
            onPress={() => restoreNote(item.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Restore note"
          >
            <Ionicons name="arrow-undo" size={13} color={C.ink} />
            <Text style={s.restoreTxt}>Restore</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={trashedNotes}
      keyExtractor={n => n.id}
      renderItem={renderRow}
      ListHeaderComponent={
        trashedNotes.length > 0 ? (
          <View style={s.banner}>
            <Ionicons name="information-circle-outline" size={16} color={C.inkMuted} />
            <Text style={s.bannerTxt}>
              Notes in Trash are deleted automatically after 30 days.
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={handleEmpty}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Empty Trash"
            >
              <Text style={s.emptyBtnTxt}>Empty</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <NotesEmptyState
          icon="🗑"
          title="Trash is empty"
          sub="Deleted notes appear here for 30 days, then are removed automatically."
        />
      }
      ListFooterComponent={<View style={{ height: 140 }} />}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
