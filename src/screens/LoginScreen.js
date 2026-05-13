/**
 * LoginScreen — minimal entry gate.
 *
 * Shown when `user.name` in the store is empty. User types a name, taps
 * Continue, and we set `user` in the store with a random avatar seed so
 * the app immediately has an identity to render.
 *
 * No real auth — this is just a placeholder so the Logout button in
 * ProfileScreen has somewhere to return to. Email is auto-generated from
 * the name and can be edited later via the profile editor.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useTheme } from '../theme';

// Build the same avatar URL used by ProfileScreen so the user has an
// avatar from the moment they log in (replaceable later via edit).
function buildAvatarUrl(seed) {
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=200`;
}

// Generate a fresh, lowercase, slug-like seed. We use the name plus a small
// random suffix so two people named "John" get different avatars.
function makeSeed(name) {
  const slug = (name || 'reader').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const tail = Math.random().toString(36).slice(2, 6);
  return `${slug}-${tail}`;
}

export function LoginScreen() {
  const { C, F, themeVersion } = useTheme();
  const { updateUser } = useStore();
  const [name, setName] = useState('');

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    container: {
      flex: 1,
      paddingHorizontal: 32,
      paddingTop: 80,
    },

    // Brand
    brand: {
      marginBottom: 60,
    },
    brandKicker: {
      fontFamily: F.serif,
      fontSize: 11,
      fontWeight: '700',
      color: C.amber,
      letterSpacing: 2,
      marginBottom: 16,
    },
    brandTitle: {
      fontFamily: F.serif,
      fontSize: 44,
      color: C.ink,
      letterSpacing: -0.6,
      lineHeight: 50,
      marginBottom: 12,
    },
    brandSubtitle: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.inkMuted,
      lineHeight: 22,
    },

    // Form
    formWrap: {
      gap: 8,
    },
    label: {
      fontFamily: F.serif,
      fontSize: 11,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1,
      marginBottom: 4,
    },
    input: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: F.serif,
      fontSize: 16,
      color: C.ink,
      marginBottom: 16,
    },
    cta: {
      backgroundColor: C.ink,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaTxt: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.white,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    hint: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkFaint,
      marginTop: 14,
      lineHeight: 18,
    },
  }), [themeVersion]);

  const canContinue = name.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    const cleanName = name.trim();
    const seed = makeSeed(cleanName);
    // Auto-generate an email from the name; user can change it later
    const email = `${cleanName.toLowerCase().replace(/\s+/g, '.')}@bookwise.app`;
    updateUser({ name: cleanName, email, avatarSeed: seed });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.container}>
          {/* Brand mark — small mark + serif name */}
          <View style={s.brand}>
            <Text style={s.brandKicker}>BOOKWISE</Text>
            <Text style={s.brandTitle}>Welcome</Text>
            <Text style={s.brandSubtitle}>
              Track what you read, capture what you think.
            </Text>
          </View>

          {/* Name input */}
          <View style={s.formWrap}>
            <Text style={s.label}>Your name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Julian Barnes"
              placeholderTextColor={C.inkFaint}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />

            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.85}
              style={[s.cta, !canContinue && { opacity: 0.4 }]}
              disabled={!canContinue}
            >
              <Text style={s.ctaTxt}>Continue</Text>
            </TouchableOpacity>

            <Text style={s.hint}>
              No password, no email verification. This is just to personalise
              your library.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
