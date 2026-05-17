/**
 * Toolbar — horizontal strip of media, inline-format, and block-type
 * buttons for RichNoteEditor. Sits above the blocks scroll view.
 *
 * Inline-format buttons (B / I / U / ==) call onFormat(kind) which the
 * editor routes to the imperative handle of the currently focused block
 * — see EditorScreen.handleFormat for the dispatch.
 */

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../AppText';
import { useTheme } from '../../theme';

export function Toolbar({ onInsert, onFormat, onPickFromGallery, onTakePhoto }) {
  const { C, F, themeVersion } = useTheme();
  const tb = useMemo(() => StyleSheet.create({
    scrollContent: { paddingHorizontal: 20 },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderRadius: 10,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 4, paddingVertical: 4,
      gap: 0,
    },
    btn: {
      paddingHorizontal: 9, paddingVertical: 7,
      borderRadius: 6,
      alignItems: 'center', justifyContent: 'center',
      minWidth: 30,
    },
    btnTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontStyle: 'italic' },
    btnTxtBold: { fontStyle: 'normal', fontWeight: '700', fontSize: 15 },
    btnTxtUnderline: { fontStyle: 'normal', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
    btnTxtHighlight: {
      fontStyle: 'normal', fontWeight: '700', fontSize: 12,
      color: C.ink,
      backgroundColor: C.amberPale,
      paddingHorizontal: 4, borderRadius: 3,
    },
    divider: { width: 1, height: 14, backgroundColor: C.border, opacity: 0.7 },
    sectionDivider: { width: 1, height: 20, backgroundColor: C.borderMid, marginHorizontal: 4 },
  }), [themeVersion]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tb.scrollContent}
      keyboardShouldPersistTaps="always"
    >
      <View
        style={tb.bar}
        accessibilityRole="toolbar"
        accessibilityLabel="Note formatting toolbar"
      >
        {/* Media buttons */}
        <TouchableOpacity
          style={tb.btn}
          onPress={onPickFromGallery}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert image from library"
        >
          <Ionicons name="image-outline" size={17} color={C.inkSoft} importantForAccessibility="no" />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity
          style={tb.btn}
          onPress={onTakePhoto}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Take photo with camera"
        >
          <Ionicons name="camera-outline" size={18} color={C.inkSoft} importantForAccessibility="no" />
        </TouchableOpacity>

        <View style={tb.sectionDivider} />

        {/* Inline format buttons — wrap the focused block's selection in
            markdown delimiters via the editor's imperative dispatch. */}
        {onFormat ? (
          <>
            <TouchableOpacity
              style={tb.btn}
              onPress={() => onFormat('bold')}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Bold"
            >
              <Text style={[tb.btnTxt, tb.btnTxtBold]}>B</Text>
            </TouchableOpacity>
            <View style={tb.divider} />
            <TouchableOpacity
              style={tb.btn}
              onPress={() => onFormat('italic')}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Italic"
            >
              <Text style={tb.btnTxt}>I</Text>
            </TouchableOpacity>
            <View style={tb.divider} />
            <TouchableOpacity
              style={tb.btn}
              onPress={() => onFormat('underline')}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Underline"
            >
              <Text style={[tb.btnTxt, tb.btnTxtUnderline]}>U</Text>
            </TouchableOpacity>
            <View style={tb.divider} />
            <TouchableOpacity
              style={tb.btn}
              onPress={() => onFormat('highlight')}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Highlight"
            >
              <Text style={tb.btnTxtHighlight}>==</Text>
            </TouchableOpacity>

            <View style={tb.sectionDivider} />
          </>
        ) : null}

        {/* Block-type buttons */}
        <TouchableOpacity
          style={tb.btn}
          onPress={() => onInsert('heading')}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert heading"
        >
          <Text style={[tb.btnTxt, tb.btnTxtBold]}>H</Text>
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity
          style={tb.btn}
          onPress={() => onInsert('bullet')}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert bullet list"
        >
          <Ionicons name="list-outline" size={17} color={C.inkSoft} importantForAccessibility="no" />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity
          style={tb.btn}
          onPress={() => onInsert('quote')}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert quote"
        >
          <Text style={tb.btnTxt}>99</Text>
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity
          style={tb.btn}
          onPress={() => onInsert('thought')}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert thought"
        >
          <Ionicons name="bulb-outline" size={16} color={C.inkSoft} importantForAccessibility="no" />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity
          style={tb.btn}
          onPress={() => onInsert('paragraph')}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Insert paragraph"
        >
          <Ionicons name="text-outline" size={16} color={C.inkSoft} importantForAccessibility="no" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
