/**
 * HeadingBlock — bigger serif type to break a long note into sections.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppTextInput as TextInput } from '../../AppText';
import { useTheme } from '../../../theme';
import { useBlkStyles, useMarkdownChildren, FORMAT_DELIMS, wrapSelection } from '../shared';

export const HeadingBlock = React.forwardRef(function HeadingBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const mdChildren = useMarkdownChildren(block.text);

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
      <View style={blk.headingWrap}>
        <TextInput
          ref={inputRef}
          style={blk.heading}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="Heading"
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        >
          {mdChildren}
        </TextInput>
        {block.text.length === 0 && onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});
