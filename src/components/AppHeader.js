/**
 * AppHeader — the top bar used across all main screens.
 * Matches Figma: hamburger left, "Modern Library" serif brand centre-left,
 * avatar circle right.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, F } from '../theme';

export function AppHeader({ onMenuPress, onAvatarPress, brand = 'Modern Library', avatarUri }) {
  return (
    <View style={s.bar}>
      <View style={s.left}>
        <TouchableOpacity
          onPress={onMenuPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Ionicons name="menu" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.brand} numberOfLines={1} ellipsizeMode="tail">{brand}</Text>
      </View>

      <TouchableOpacity
        style={s.avatar}
        onPress={onAvatarPress}
        activeOpacity={0.75}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatarImg} />
        ) : (
          <Ionicons name="person" size={16} color={C.white} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 },
  brand: {
    fontFamily: F.serif,
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.2,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
});