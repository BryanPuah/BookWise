/**
 * ImageBlock — picked/captured image with an optional caption row beneath.
 * Frame aspect ratio mirrors the source dimensions; falls back to 4:3
 * when dimensions aren't known.
 */

import React, { useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../../AppText';
import { useTheme } from '../../../theme';
import { useBlkStyles } from '../shared';

export function ImageBlock({ block, onChange, onRemove }) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  // Aspect ratio: fall back to 4:3 if dimensions unknown
  const aspect = (block.width && block.height) ? (block.width / block.height) : (4 / 3);
  // Track load failure so the "Image unavailable" placeholder kicks in even
  // when uri is set — same fallback already used for the no-uri case.
  const [broken, setBroken] = useState(false);
  const showImage = block.uri && !broken;

  return (
    <View style={blk.imageWrap}>
      {showImage ? (
        <View style={[blk.imageFrame, { aspectRatio: aspect }]}>
          <Image
            source={{ uri: block.uri }}
            style={blk.image}
            resizeMode="cover"
            onError={() => setBroken(true)}
          />
          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={blk.imageRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[blk.imagePlaceholder, { aspectRatio: 4 / 3 }]}>
          <Ionicons name="image-outline" size={28} color={C.inkFaint} />
          <Text style={blk.imagePlaceholderTxt}>Image unavailable</Text>
          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={blk.imageRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <TextInput
        style={blk.imageCaption}
        value={block.text}
        onChangeText={text => onChange({ ...block, text })}
        placeholder="Add a caption…"
        placeholderTextColor={C.inkFaint}
        multiline
      />
    </View>
  );
}
