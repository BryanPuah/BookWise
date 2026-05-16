/**
 * ByTypeView — list of note types that have notes, with counts. Tapping a
 * row drills into the TypeNotesScreen for that type.
 *
 * Both views live in this file because TypeNotesScreen is only ever reached
 * from ByTypeView and shares its shape.
 */

import React, { useMemo, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { useTheme } from '../../theme';
import { NoteCard } from './NoteCard';
import { useNT, noteHasType } from './shared';

function TypeNotesScreen({ typeKey, typeMeta, notes, onDelete, onEdit, onBack }) {
  const { C, F, themeVersion } = useTheme();
  const tns = useMemo(() => StyleSheet.create({
    header: { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 18 },
    backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
    backTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontWeight: '600' },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
    iconWrap: {
      width: 52, height: 52, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 24 },
    typeTitle: { fontFamily: F.serif, fontSize: 20, color: C.ink, lineHeight: 26, letterSpacing: -0.3 },
    typeDesc: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 3 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const starred = notes.filter(n => n.starred).length;
  const sorted  = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={tns.header}>
        <TouchableOpacity onPress={onBack} style={tns.backBtn} activeOpacity={0.8}>
          <Text style={tns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={tns.headerInfo}>
          <View style={[tns.iconWrap, { backgroundColor: typeMeta.bg }]}>
            <Text style={tns.icon}>{typeMeta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tns.typeTitle}>{typeMeta.label}</Text>
            <Text style={tns.typeDesc}>{typeMeta.desc}</Text>
            <View style={tns.countRow}>
              <Text style={tns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={tns.starCount}>★ {starred}</Text>}
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={n => n.id}
        renderItem={({ item }) => (
          <NoteCard note={item} onDelete={onDelete} onEdit={onEdit} showBook />
        )}
        ListEmptyComponent={
          <View style={tns.empty}>
            <Text style={tns.emptyIcon}>{typeMeta.icon}</Text>
            <Text style={tns.emptyTitle}>No {typeMeta.label.toLowerCase()} notes yet</Text>
            <Text style={tns.emptySub}>Tap the + button to capture your first thought.</Text>
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

export function ByTypeView({ notes, onDelete, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
  const btv = useMemo(() => StyleSheet.create({
    typeBlock: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    typeHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
    iconWrap: {
      width: 44, height: 44, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    icon: { fontSize: 20 },
    typeMeta: { flex: 1 },
    typeTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
    typeDesc: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, marginTop: 2 },
    countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
    noteCount: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    starCount: { fontFamily: F.serif, fontSize: 11, color: C.amber, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const [selectedType, setSelectedType] = useState(null);

  const grouped = useMemo(() => {
    return Object.entries(NT).reduce((acc, [key, meta]) => {
      const typeNotes = notes.filter(n => noteHasType(n, key));
      if (typeNotes.length > 0) {
        acc.push({ key, meta, notes: typeNotes });
      }
      return acc;
    }, []);
  }, [notes]);

  if (selectedType) {
    const group = grouped.find(g => g.key === selectedType);
    if (group) {
      return (
        <TypeNotesScreen
          typeKey={group.key}
          typeMeta={group.meta}
          notes={group.notes}
          onDelete={onDelete}
          onEdit={onEdit}
          onBack={() => setSelectedType(null)}
        />
      );
    }
  }

  const renderType = ({ item }) => {
    const { key, meta, notes: tn } = item;
    const starred = tn.filter(n => n.starred).length;
    return (
      <TouchableOpacity
        style={btv.typeBlock}
        onPress={() => setSelectedType(key)}
        activeOpacity={0.85}
      >
        <View style={btv.typeHead}>
          <View style={[btv.iconWrap, { backgroundColor: meta.bg }]}>
            <Text style={btv.icon}>{meta.icon}</Text>
          </View>
          <View style={btv.typeMeta}>
            <Text style={btv.typeTitle}>{meta.label}</Text>
            <Text style={btv.typeDesc} numberOfLines={1}>{meta.desc}</Text>
            <View style={btv.countRow}>
              <Text style={btv.noteCount}>{tn.length} note{tn.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={btv.starCount}>★ {starred}</Text>}
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
      keyExtractor={g => g.key}
      renderItem={renderType}
      ListEmptyComponent={
        <View style={btv.empty}>
          <Text style={btv.emptyIcon}>📝</Text>
          <Text style={btv.emptyTitle}>No notes yet</Text>
          <Text style={btv.emptySub}>
            Tap the + button to capture your first thought.
          </Text>
        </View>
      }
      ListFooterComponent={<View style={{ height: 140 }} />}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
