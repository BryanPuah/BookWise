/**
 * AppHeader — the top bar used across all main screens.
 * "Modern Library" serif brand on the left, search + avatar circle on the right.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { AppText as Text } from './AppText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, AVATAR_COLORS } from '../theme';
import { useStore } from '../store';
import { getAvatarColor, getInitials } from './EditProfileModal';
import { GlobalSearchModal } from './GlobalSearchModal';

export function AppHeader({ onAvatarPress, brand = 'Modern Library', avatarUri }) {
  const { C, F, themeVersion } = useTheme();
  const { user } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  // Reset on every avatarUri change so a new URL gets a fresh shot at loading
  // — otherwise a one-time 404 would lock the avatar to the initials fallback.
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [avatarUri]);

  // Show the colored initials avatar only once the user has typed a name
  // AND picked an explicit color in the profile settings. Otherwise fall
  // back to the no-face person icon on the ink (navy) background — the
  // original "default" look.
  const hasName = !!(user?.name && user.name.trim());
  const hasColor = AVATAR_COLORS.some(c => c.key === user?.avatarSeed);
  const showInitials = hasName && hasColor;
  const initials = showInitials ? getInitials(user.name) : '';
  const avatarBg = showInitials ? getAvatarColor(user.avatarSeed, user.name) : C.ink;

  const s = useMemo(() => StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
    },
    left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
    brand: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      letterSpacing: -0.2,
    },
    right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchBtn: {
      width: 36, height: 36, borderRadius: 999,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.cream,
    },
    avatar: {
      width: 36, height: 36, borderRadius: 999,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarInitials: {
      fontFamily: F.serif,
      fontSize: 13,
      fontWeight: '700',
      color: C.white,
      letterSpacing: -0.2,
    },
  }), [themeVersion]);

  return (
    <View style={s.bar}>
      <View style={s.left}>
        <Text style={s.brand} numberOfLines={1} ellipsizeMode="tail">{brand}</Text>
      </View>

      <View style={s.right}>
        <TouchableOpacity
          style={s.searchBtn}
          onPress={() => setSearchOpen(true)}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="search" size={22} color={C.ink} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.avatar, { backgroundColor: avatarBg }]}
          onPress={onAvatarPress}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {avatarUri && !imgError ? (
            <Image
              source={{ uri: avatarUri }}
              style={s.avatarImg}
              onError={() => setImgError(true)}
            />
          ) : showInitials ? (
            <Text style={s.avatarInitials}>{initials}</Text>
          ) : (
            <Ionicons name="person" size={16} color={C.white} />
          )}
        </TouchableOpacity>
      </View>

      <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}
