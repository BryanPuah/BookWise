/**
 * EditProfileModal — name + email TextInputs + avatar color picker.
 *
 * Avatars are colored circles with the user's initials — no third-party
 * face images. The user picks a color from a fixed palette; the choice is
 * stored as `avatarSeed` (e.g., 'olive', 'berry'). Empty / legacy seeds
 * fall back to a deterministic color derived from the user's name.
 *
 * Saves are applied via updateUser from the store. Cancel discards the
 * draft state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';

// Paper-friendly palette — same hue family as the accent themes so the
// avatar harmonises with the rest of the app regardless of which accent
// the user picked.
export const AVATAR_COLORS = [
  { key: 'olive',    label: 'Olive',    color: '#7A8B5E' },
  { key: 'berry',    label: 'Berry',    color: '#B7295A' },
  { key: 'red',      label: 'Red',      color: '#D1453B' },
  { key: 'orange',   label: 'Orange',   color: '#D97706' },
  { key: 'yellow',   label: 'Yellow',   color: '#C7A53A' },
  { key: 'forest',   label: 'Forest',   color: '#1F7A4D' },
  { key: 'teal',     label: 'Teal',     color: '#0F8B8D' },
  { key: 'sky',      label: 'Sky',      color: '#3A8DC4' },
  { key: 'indigo',   label: 'Indigo',   color: '#5B5FA8' },
  { key: 'plum',     label: 'Plum',     color: '#8B5076' },
  { key: 'charcoal', label: 'Charcoal', color: '#475569' },
];

// First letter of first word + first letter of last word, uppercased.
// "?" is the fallback for empty names so the circle is never blank.
export function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable string→int hash so the auto color picks the same hue every
// time for a given name (no random flicker on re-render).
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Resolve the avatar color from the stored seed + name. Priority:
//   1. seed matches a palette key  → use that color
//   2. seed is a legacy DiceBear slug → hash it for a stable color
//   3. nothing set → hash the user's name
export function getAvatarColor(seed, name) {
  const match = AVATAR_COLORS.find(c => c.key === seed);
  if (match) return match.color;
  const basis = (seed && seed.trim()) || (name && name.trim()) || 'reader';
  return AVATAR_COLORS[hashString(basis) % AVATAR_COLORS.length].color;
}

export function EditProfileModal({ visible, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const { user, updateUser } = useStore();
  const [name, setName]   = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [seed, setSeed]   = useState(user.avatarSeed);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setEmail(user.email);
      setSeed(user.avatarSeed);
    }
  }, [visible, user.name, user.email, user.avatarSeed]);

  const previewInitials = getInitials(name);
  // Auto = no explicit color key stored; circle uses the name-hashed color.
  const isAutoSelected = !AVATAR_COLORS.some(c => c.key === seed);
  const hasName = !!(name && name.trim());
  // Until the user has typed a name AND picked a color, show the same
  // no-face icon on the ink (navy) background that the rest of the app
  // uses as the default avatar.
  const showInitials = hasName && !isAutoSelected;
  const previewColor = showInitials ? getAvatarColor(seed, name) : C.ink;

  const p = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    title: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
    cancelTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' },
    saveBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 18,
    },
    saveBtnTxt: { fontFamily: F.serif, fontSize: 13, color: C.white, fontWeight: '700' },

    sectionLabel: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1,
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 10,
    },

    // Preview — large circle showing what the avatar will look like
    previewWrap: {
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 6,
    },
    previewCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewInitials: {
      fontFamily: F.serif,
      fontSize: 32,
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },

    // Color swatch grid
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      gap: 12,
    },
    swatchWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchWrapActive: {
      borderWidth: 2,
      borderColor: C.ink,
    },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    autoSwatch: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.borderMid,
    },
    autoSwatchTxt: {
      fontFamily: F.sans,
      fontSize: 11,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 0.8,
    },

    // Inputs
    input: {
      fontFamily: F.sans,
      marginHorizontal: 20,
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 15,
      color: C.ink,
    },
  }), [themeVersion]);

  const handleSave = () => {
    updateUser({
      name: name.trim() || user.name,
      email: email.trim() || user.email,
      avatarSeed: seed,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={p.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar */}
          <View style={p.topBar}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={p.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <Text style={p.title}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.85}
              style={p.saveBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={p.saveBtnTxt}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar preview */}
            <Text style={p.sectionLabel}>AVATAR</Text>
            <View style={p.previewWrap}>
              <View style={[p.previewCircle, { backgroundColor: previewColor }]}>
                {showInitials ? (
                  <Text style={p.previewInitials}>{previewInitials}</Text>
                ) : (
                  <Ionicons name="person" size={40} color={C.white} />
                )}
              </View>
            </View>

            {/* Color picker grid */}
            <Text style={p.sectionLabel}>AVATAR COLOR</Text>
            <View style={p.colorGrid}>
              {/* Auto — clears the seed so it follows the user's name hash */}
              <TouchableOpacity
                onPress={() => setSeed('')}
                activeOpacity={0.7}
                style={[p.swatchWrap, isAutoSelected && p.swatchWrapActive]}
                accessibilityLabel="Auto color"
              >
                <View style={[p.swatch, p.autoSwatch]}>
                  {isAutoSelected ? (
                    <Ionicons name="checkmark" size={20} color={C.ink} />
                  ) : (
                    <Text style={p.autoSwatchTxt}>AUTO</Text>
                  )}
                </View>
              </TouchableOpacity>

              {AVATAR_COLORS.map(c => {
                const active = seed === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setSeed(c.key)}
                    activeOpacity={0.7}
                    style={[p.swatchWrap, active && p.swatchWrapActive]}
                    accessibilityLabel={`${c.label} avatar`}
                  >
                    <View style={[p.swatch, { backgroundColor: c.color }]}>
                      {active && (
                        <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Name */}
            <Text style={p.sectionLabel}>NAME</Text>
            <TextInput
              style={p.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={C.inkFaint}
              autoCapitalize="words"
            />

            {/* Email */}
            <Text style={p.sectionLabel}>EMAIL</Text>
            <TextInput
              style={p.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.inkFaint}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
