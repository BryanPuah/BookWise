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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme, AVATAR_COLORS } from '../theme';
import { ModalHeader } from './ModalHeader';

export { AVATAR_COLORS };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [name, setName]   = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [seed, setSeed]   = useState(user.avatarSeed || '');
  const [emailError, setEmailError] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(user.name || '');
      setEmail(user.email || '');
      setSeed(user.avatarSeed || '');
      setEmailError(false);
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
      shadowColor: C.shadow,
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
    inputError: {
      borderColor: C.rose,
    },
    errorTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.rose,
      marginHorizontal: 22,
      marginTop: 6,
    },
  }), [themeVersion]);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail.length === 0 || EMAIL_RE.test(trimmedEmail);
  const canSave = trimmedName.length > 0 && emailValid;

  const handleSave = () => {
    if (!canSave) {
      if (!emailValid) setEmailError(true);
      return;
    }
    updateUser({
      name: trimmedName,
      email: trimmedEmail,
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ModalHeader
            title="Edit Profile"
            left={{ icon: 'cancel', onPress: onClose }}
            right={{ kind: 'pill', label: 'Save', onPress: handleSave, disabled: !canSave }}
          />

          <ScrollView
            contentContainerStyle={{ paddingBottom: 200 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar preview */}
            <Text style={p.sectionLabel}>AVATAR</Text>
            <View style={p.previewWrap}>
              <View style={[p.previewCircle, { backgroundColor: previewColor }]}>
                {showInitials ? (
                  <Text style={p.previewInitials}>{previewInitials}</Text>
                ) : (
                  <Ionicons name="person" size={40} color="#FFFFFF" />
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
              autoCorrect={false}
              returnKeyType="next"
              textContentType="name"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Email */}
            <Text style={p.sectionLabel}>EMAIL</Text>
            <TextInput
              ref={emailRef}
              style={[p.input, emailError && p.inputError]}
              value={email}
              onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(false); }}
              onBlur={() => setEmailError(trimmedEmail.length > 0 && !emailValid)}
              placeholder="you@example.com"
              placeholderTextColor={C.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            {emailError ? (
              <Text style={p.errorTxt}>Enter a valid email address.</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
