/**
 * EditProfileModal — name + email TextInputs + avatar grid picker.
 *
 * Avatars come from DiceBear (free SVG/PNG avatar generator). We render
 * a grid of 8 preset seeds; tapping selects one and stores it as the
 * user's `avatarSeed`. The same URL convention is used in ProfileScreen
 * to render the chosen avatar.
 *
 * Saves are applied via updateUser from the store. Cancel discards the
 * draft state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';

// Preset avatar seeds — 8 stylised characters. Each maps to a deterministic
// DiceBear avatar. To swap to bundled images later, replace the URL build
// with `require('../../assets/avatars/<seed>.png')`.
const PRESET_SEEDS = [
  'reader-1', 'reader-2', 'reader-3', 'reader-4',
  'reader-5', 'reader-6', 'reader-7', 'reader-8',
];

export function buildAvatarUrl(seed, size = 200) {
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function EditProfileModal({ visible, onClose }) {
  const { C, F, themeVersion } = useTheme();
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
    fontFamily: F.serif,
    fontSize: 10,
    fontWeight: '700',
    color: C.inkMuted,
    letterSpacing: 1,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },

  // Avatar grid
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  avatarOption: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  avatarOptionSelected: {
    borderColor: C.ink,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: C.cream,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs
  input: {
    fontFamily: F.serif,
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
            {/* Avatar grid */}
            <Text style={p.sectionLabel}>AVATAR</Text>
            <View style={p.avatarGrid}>
              {PRESET_SEEDS.map(s => {
                const isSelected = seed === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSeed(s)}
                    activeOpacity={0.7}
                    style={[p.avatarOption, isSelected && p.avatarOptionSelected]}
                  >
                    <Image source={{ uri: buildAvatarUrl(s) }} style={p.avatarImg} />
                    {isSelected && (
                      <View style={p.checkBadge}>
                        <Ionicons name="checkmark" size={14} color={C.white} />
                      </View>
                    )}
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

