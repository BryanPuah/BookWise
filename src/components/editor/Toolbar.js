/**
 * Toolbar — horizontal strip of block-type buttons + media buttons for
 * RichNoteEditor. Sits above the blocks scroll view.
 */

import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../AppText';
import { useTheme } from '../../theme';

export function Toolbar({ onInsert, onPickFromGallery, onTakePhoto }) {
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
    divider: { width: 1, height: 14, backgroundColor: C.border, opacity: 0.7 },
    sectionDivider: { width: 1, height: 20, backgroundColor: C.borderMid, marginHorizontal: 4 },
    highlightSwatch: {
      backgroundColor: C.amberPale,
      paddingHorizontal: 5,
      borderRadius: 3,
    },
  }), [themeVersion]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tb.scrollContent}
      keyboardShouldPersistTaps="always"
    >
      <View style={tb.bar}>
        {/* Media buttons */}
        <TouchableOpacity style={tb.btn} onPress={onPickFromGallery} activeOpacity={0.6}>
          <Ionicons name="image-outline" size={17} color={C.inkSoft} />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity style={tb.btn} onPress={onTakePhoto} activeOpacity={0.6}>
          <Ionicons name="camera-outline" size={18} color={C.inkSoft} />
        </TouchableOpacity>

        <View style={tb.sectionDivider} />

        {/* Block-type buttons */}
        <TouchableOpacity style={tb.btn} onPress={() => onInsert('heading')} activeOpacity={0.6}>
          <Text style={[tb.btnTxt, tb.btnTxtBold]}>H</Text>
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity style={tb.btn} onPress={() => onInsert('bullet')} activeOpacity={0.6}>
          <Ionicons name="list-outline" size={17} color={C.inkSoft} />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity style={tb.btn} onPress={() => onInsert('quote')} activeOpacity={0.6}>
          <Text style={tb.btnTxt}>99</Text>
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity style={tb.btn} onPress={() => onInsert('thought')} activeOpacity={0.6}>
          <Ionicons name="bulb-outline" size={16} color={C.inkSoft} />
        </TouchableOpacity>
        <View style={tb.divider} />
        <TouchableOpacity style={tb.btn} onPress={() => onInsert('paragraph')} activeOpacity={0.6}>
          <Ionicons name="text-outline" size={16} color={C.inkSoft} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
