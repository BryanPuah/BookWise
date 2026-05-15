/**
 * LinkedNotesPicker — modal used by RichNoteEditor when the user has tagged
 * a note with the "Connection" type. Lets them pick one or more other notes
 * to link to. Selected note IDs are persisted on the note as `linkedNoteIds`
 * and surface as inline chips on the note card.
 *
 * Search is over title + body so the user can find a note they wrote
 * yesterday without remembering the exact title.
 */

import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, Modal, ScrollView,
  StyleSheet, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';

// Same plain-text helper as the search modal — strips inline markdown so the
// preview row reads cleanly.
function plain(text) {
  return (text || '')
    .replace(/\*\*|__|==|\*/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function LinkedNotesPicker({
  visible,
  excludeNoteId,        // omit the note being edited from its own picker
  selectedIds,
  onChange,
  onClose,
}) {
  const { C, F, themeVersion } = useTheme();
  const { notes } = useStore();
  const [query, setQuery] = useState('');

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    cancelTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontWeight: '600' },
    title: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
    doneBtn: {
      backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    },
    doneTxt: { fontFamily: F.serif, fontSize: 13, color: C.white, fontWeight: '700' },

    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.cream,
      borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      marginHorizontal: 16, marginTop: 12, marginBottom: 6,
    },
    searchInput: { flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink, padding: 0 },

    scrollBody: { paddingBottom: 60 },

    sectionLabel: {
      fontFamily: F.sans, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1.2,
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
    },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    rowBody: { flex: 1 },
    rowTitle: { fontFamily: F.serif, fontSize: 15, color: C.ink, letterSpacing: -0.2 },
    rowSub: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 2 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6,
      borderWidth: 1.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.white,
    },
    checkboxActive: { backgroundColor: C.ink, borderColor: C.ink },

    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, marginBottom: 6, textAlign: 'center' },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const q = query.trim().toLowerCase();
  // Selected first, then unselected. Within each group, filter by query.
  // Excluding the current note prevents self-reference.
  const eligible = useMemo(() => {
    return notes.filter(n => n.id !== excludeNoteId);
  }, [notes, excludeNoteId]);

  const filtered = useMemo(() => {
    if (!q) return eligible;
    return eligible.filter(n => {
      const hay = `${n.title || ''}  ${n.text || ''}  ${n.bookTitle || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [eligible, q]);

  const toggle = (id) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id));
    else                          onChange([...selectedIds, id]);
  };

  // Show currently-selected notes at the top even when filter is empty,
  // so the user can always uncheck them without finding them in the list.
  const selectedNotes = filtered.filter(n => selectedIds.includes(n.id));
  const unselectedNotes = filtered.filter(n => !selectedIds.includes(n.id));

  const renderRow = (n) => {
    const isSelected = selectedIds.includes(n.id);
    const title = plain(n.title) || plain(n.text).slice(0, 60) || 'Untitled note';
    const sub = [n.bookTitle, n.date].filter(Boolean).join(' · ');
    return (
      <TouchableOpacity
        key={n.id}
        style={s.row}
        activeOpacity={0.6}
        onPress={() => toggle(n.id)}
      >
        <View style={[s.checkbox, isSelected && s.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color={C.white} />}
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Link notes</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={s.doneBtn}>
            <Text style={s.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={15} color={C.inkMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Find a note to link…"
            placeholderTextColor={C.inkFaint}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={15} color={C.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                {q ? 'No matches' : 'No other notes to link yet'}
              </Text>
              <Text style={s.emptySub}>
                {q
                  ? 'Try a different word — search looks inside titles and body text.'
                  : 'Capture another note first, then come back to link them together.'}
              </Text>
            </View>
          )}

          {selectedNotes.length > 0 && (
            <View>
              <Text style={s.sectionLabel}>SELECTED · {selectedNotes.length}</Text>
              {selectedNotes.map(renderRow)}
            </View>
          )}

          {unselectedNotes.length > 0 && (
            <View>
              {selectedNotes.length > 0 && <Text style={s.sectionLabel}>ALL NOTES</Text>}
              {unselectedNotes.map(renderRow)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
