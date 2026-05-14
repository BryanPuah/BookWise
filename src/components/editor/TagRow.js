/**
 * TagRow — hosts both the fixed note-type chips and the free-text custom
 * tags on a single line so the editor doesn't carry two parallel tag rows.
 *
 * Tapping "+ Add Tag" opens a small modal with an autocomplete input plus
 * the unselected note-type rows for quick toggling.
 */

import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, Pressable, StyleSheet, Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../AppText';
import { useTheme } from '../../theme';
import { normalizeTag } from '../TagInput';
import { TYPES } from './shared';

export function TagRow({ selectedTypes, onToggle, tags, onTagsChange }) {
  const { C, F, themeVersion } = useTheme();
  const [draft, setDraft] = useState('');

  const commitTag = (raw) => {
    const tag = normalizeTag(raw);
    setDraft('');
    if (!tag || tags.includes(tag)) return;
    onTagsChange([...tags, tag]);
  };
  const removeTagAt = (i) => onTagsChange(tags.filter((_, idx) => idx !== i));

  const tg = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 2, marginBottom: 10,
    },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.amberPale,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 12,
    },
    chipTxt: { fontFamily: F.serif, fontSize: 12, color: C.ink, fontWeight: '600' },
    customChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.sagePale,
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 10,
    },
    customChipTxt: { fontFamily: F.serif, fontSize: 12, color: C.ink, fontWeight: '600' },
    addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    addBtnTxt: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, fontWeight: '500' },
    pickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 40,
    },
    pickerCard: {
      width: '100%', maxWidth: 280,
      backgroundColor: C.paper,
      borderRadius: 16,
      paddingVertical: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
    },
    pickerTitle: {
      fontFamily: F.sans, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 13,
    },
    pickerIcon: { fontSize: 16 },
    pickerLabel: { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '500' },
    pickerDivider: {
      height: 1, backgroundColor: C.border, opacity: 0.5,
      marginVertical: 6, marginHorizontal: 12,
    },
    pickerInputWrap: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    },
    pickerInput: {
      flex: 1,
      fontFamily: F.serif, fontSize: 15, color: C.ink,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    pickerInputBtn: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: C.ink,
    },
    pickerInputBtnTxt: {
      fontFamily: F.serif, fontSize: 13, color: C.paper, fontWeight: '600',
    },
    pickerInputBtnDisabled: { opacity: 0.35 },
  }), [themeVersion]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const unselected = TYPES.filter(t => !selectedTypes.includes(t.key));

  return (
    <View style={tg.wrap}>
      <Ionicons name="pricetag-outline" size={13} color={C.inkMuted} />

      {selectedTypes.map(key => {
        const meta = TYPES.find(t => t.key === key);
        if (!meta) return null;
        return (
          <View key={key} style={tg.chip}>
            <Text style={tg.chipTxt}>{meta.label}</Text>
            <TouchableOpacity
              onPress={() => onToggle(key)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Ionicons name="close" size={11} color={C.inkMuted} />
            </TouchableOpacity>
          </View>
        );
      })}

      {tags.map((t, i) => (
        <View key={`tag-${t}-${i}`} style={tg.customChip}>
          <Text style={tg.customChipTxt}>{t}</Text>
          <TouchableOpacity
            onPress={() => removeTagAt(i)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="close" size={11} color={C.inkMuted} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={tg.addBtn}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.6}
      >
        <Text style={tg.addBtnTxt}>+ Add Tag</Text>
      </TouchableOpacity>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { setDraft(''); setPickerOpen(false); }}
      >
        <TouchableOpacity
          style={tg.pickerBackdrop}
          activeOpacity={1}
          onPress={() => { setDraft(''); setPickerOpen(false); }}
        >
          <Pressable style={tg.pickerCard} onPress={() => {}}>
            <Text style={tg.pickerTitle}>ADD TAG</Text>

            <View style={tg.pickerInputWrap}>
              <TextInput
                style={tg.pickerInput}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => {
                  const t = normalizeTag(draft);
                  if (!t) return;
                  commitTag(draft);
                  setPickerOpen(false);
                }}
                placeholder="Tag name"
                placeholderTextColor={C.inkFaint}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[
                  tg.pickerInputBtn,
                  !normalizeTag(draft) && tg.pickerInputBtnDisabled,
                ]}
                disabled={!normalizeTag(draft)}
                onPress={() => {
                  commitTag(draft);
                  setPickerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={tg.pickerInputBtnTxt}>Add</Text>
              </TouchableOpacity>
            </View>

            {unselected.length > 0 && <View style={tg.pickerDivider} />}

            {unselected.map(t => (
              <TouchableOpacity
                key={t.key}
                style={tg.pickerRow}
                onPress={() => { onToggle(t.key); setDraft(''); setPickerOpen(false); }}
                activeOpacity={0.6}
              >
                <Text style={tg.pickerIcon}>{t.icon}</Text>
                <Text style={tg.pickerLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
