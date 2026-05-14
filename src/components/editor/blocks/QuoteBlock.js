/**
 * QuoteBlock — italic body + optional attribution line. Visually marked
 * by a thin left rule and a serif italic face.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppTextInput as TextInput } from '../../AppText';
import { useTheme } from '../../../theme';
import { useBlkStyles, FORMAT_DELIMS, wrapSelection } from '../shared';

export const QuoteBlock = React.forwardRef(function QuoteBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const quoteRef = useRef(null);
  const attribRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => quoteRef.current?.focus(), 50);
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
        quoteRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => quoteRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => quoteRef.current?.focus()}>
      <View style={blk.quoteWrap}>
        <View style={blk.quoteRule} />
        <View style={{ flex: 1 }}>
          <TextInput
            ref={quoteRef}
            style={blk.quoteText}
            value={block.text}
            onChangeText={text => onChange({ ...block, text })}
            onFocus={onFocus}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="A quote that struck you…"
            placeholderTextColor={C.inkFaint}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            ref={attribRef}
            style={blk.attribution}
            value={block.attribution || ''}
            onChangeText={attribution => onChange({ ...block, attribution })}
            placeholder="— Author, Source"
            placeholderTextColor={C.inkFaint}
          />
        </View>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});
