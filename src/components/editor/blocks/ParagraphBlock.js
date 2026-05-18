/**
 * ParagraphBlock — default body block. Supports markdown shortcuts at the
 * start of an empty paragraph (# → heading, - → bullet, > / " → quote) and
 * exposes [[wiki-link]] autocomplete when the cursor lands inside an
 * unclosed `[[ ` pair.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppTextInput as TextInput } from '../../AppText';
import { useTheme } from '../../../theme';
import {
  useBlkStyles, useWikiLinkAutocomplete, useMarkdownChildren,
  FORMAT_DELIMS, MD_SHORTCUTS, wrapSelection,
} from '../shared';
import { WikiLinkSuggestions } from '../WikiLinkSuggestions';

export const ParagraphBlock = React.forwardRef(function ParagraphBlock(
  { block, onChange, onRemove, placeholder, autoFocus, onFocus, allNotes, allBooks },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const mdChildren = useMarkdownChildren(block.text);

  // Auto-focus on mount if marked (used when block is appended via tail tap)
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // Expose applyFormat to parent so toolbar buttons can wrap selection
  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      // Defer cursor update until after the text change has rendered
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  // [[wiki-link]] autocomplete — only suggests when this block is focused
  // and the cursor is inside an unclosed `[[ ` pair. Suggestions are drawn
  // below the input by the WikiLinkSuggestions component.
  const wiki = useWikiLinkAutocomplete({
    text: block.text,
    selection,
    allNotes: focused ? allNotes : null,
    allBooks: focused ? allBooks : null,
  });

  const handleCommitLink = (label) => {
    const safe = (label || '').trim();
    if (!safe) return;
    const { from, to } = wiki.range;
    if (from < 0 || to < 0) return;
    const inserted = `[[${safe}]] `;
    const newText = block.text.slice(0, from) + inserted + block.text.slice(to);
    onChange({ ...block, text: newText });
    const newCursor = from + inserted.length;
    setTimeout(() => {
      inputRef.current?.setNativeProps?.({ selection: { start: newCursor, end: newCursor } });
      setSelection({ start: newCursor, end: newCursor });
    }, 16);
    wiki.close();
  };

  // Markdown auto-shortcuts — only fire on an empty paragraph when the
  // user types a trigger pattern at the start. Notion/Craft/Bear pattern.
  const handleChangeText = (newText) => {
    if (block.text === '') {
      const shortcut = MD_SHORTCUTS[newText];
      if (shortcut) {
        onChange({ ...block, type: shortcut, text: '', autoFocus: true });
        return;
      }
    }
    onChange({ ...block, text: newText });
  };

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={blk.paragraphWrap}>
          <TextInput
            ref={inputRef}
            style={blk.paragraph}
            value={block.text}
            onChangeText={handleChangeText}
            onFocus={() => { setFocused(true); onFocus && onFocus(); }}
            onBlur={() => setFocused(false)}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder={placeholder}
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
      <WikiLinkSuggestions
        visible={focused && wiki.isOpen}
        query={wiki.query}
        suggestions={wiki.suggestions}
        onCommit={handleCommitLink}
      />
    </View>
  );
});
