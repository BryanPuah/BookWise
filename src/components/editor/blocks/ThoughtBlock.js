/**
 * ThoughtBlock — sage-tinted card with a lightbulb header for capturing
 * the reader's own thinking. Visually distinct from a paragraph so it
 * reads as commentary rather than direct content.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../../AppText';
import { useTheme } from '../../../theme';
import { useBlkStyles, FORMAT_DELIMS, wrapSelection } from '../shared';

export const ThoughtBlock = React.forwardRef(function ThoughtBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.thoughtWrap}>
        <View style={blk.thoughtHeader}>
          <Ionicons name="bulb-outline" size={11} color={C.inkSoft} />
          <Text style={blk.thoughtLabel}>THOUGHT</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={blk.thoughtText}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="What does this connect to? What surprised you?"
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        />
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtnAbs} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});
