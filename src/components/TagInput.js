/**
 * TagInput — free-text custom-tag entry row used in RichNoteEditor.
 *
 * Lives below the hardcoded note-type row so users can layer their own
 * taxonomy (e.g. #stoicism, #commute-listen) on top of the six fixed types.
 *
 * UX rules:
 *  - Type any string, press space, comma, or return to commit a chip.
 *  - Backspace on empty input removes the last committed chip.
 *  - Tags are stored without the leading `#` (added only at render time).
 *  - Duplicates are silently de-duped on commit.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';

// Lowercase, trim, strip leading "#", collapse internal whitespace to "-".
// Keeps tag identity stable so "Stoicism" and "stoicism" merge correctly.
export function normalizeTag(raw) {
  return (raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function TagInput({ tags, onChange }) {
  const { C, F, themeVersion } = useTheme();
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');

  const commit = (raw) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (tags.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...tags, tag]);
    setDraft('');
  };

  const removeAt = (i) => onChange(tags.filter((_, idx) => idx !== i));

  // Commit on space / comma. Other characters flow through normally.
  const handleChangeText = (next) => {
    if (next.endsWith(' ') || next.endsWith(',')) {
      commit(next.slice(0, -1));
      return;
    }
    setDraft(next);
  };

  // Backspace on empty draft → pop the most recent tag.
  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const s = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      marginTop: 2,
      marginBottom: 12,
    },
    leadIcon: { marginRight: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.sagePale,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
    },
    chipTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.ink,
      fontWeight: '600',
    },
    input: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      minWidth: 90,
      paddingVertical: 4,
      paddingHorizontal: 6,
      padding: 0,
    },
  }), [themeVersion]);

  return (
    <View style={s.wrap}>
      <Ionicons name="pricetag-outline" size={12} color={C.inkMuted} style={s.leadIcon} />

      {tags.map((t, i) => (
        <View key={`${t}-${i}`} style={s.chip}>
          <Text style={s.chipTxt}>#{t}</Text>
          <TouchableOpacity
            onPress={() => removeAt(i)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="close" size={11} color={C.inkMuted} />
          </TouchableOpacity>
        </View>
      ))}

      <TextInput
        ref={inputRef}
        style={s.input}
        value={draft}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => { if (draft) commit(draft); }}
        placeholder={tags.length === 0 ? '+ Add #tag' : '#tag'}
        placeholderTextColor={C.inkFaint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        blurOnSubmit={false}
      />
    </View>
  );
}
