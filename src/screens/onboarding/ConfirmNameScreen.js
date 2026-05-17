/**
 * ConfirmNameScreen — post-login, pre-tabs.
 *
 * The LoginScreen derives a display name from the email local-part, which
 * is often wrong ("bp.learn123" → "Bp Learn123"). This screen surfaces
 * that guess and lets the user correct it before they land in the app.
 * Submitting flips `user.hasOnboarded` so the gate in App.js routes them
 * to the tabs from then on.
 *
 * Single screen by design — the "first book?" prompt was descoped. If a
 * second onboarding step lands later, wrap this in an OnboardingStack
 * rather than chaining screens here.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  View, TouchableOpacity, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { useTheme } from '../../theme';

export function ConfirmNameScreen() {
  const { C, F, themeVersion } = useTheme();
  const { user, updateUser } = useStore();

  const [name, setName] = useState(user.name || '');
  const [focused, setFocused] = useState(false);
  const nameRef = useRef(null);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    scroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      justifyContent: 'center',
    },

    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 24,
    },
    monogram: {
      width: 30, height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramTxt: {
      fontFamily: F.serif,
      fontSize: 18,
      color: '#FFFFFF',
      includeFontPadding: false,
      marginTop: 2,
    },
    wordmark: {
      fontFamily: F.sans,
      fontSize: 11,
      fontWeight: '800',
      color: C.ink,
      letterSpacing: 2.4,
    },

    hero: { marginBottom: 24 },
    kicker: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.sage,
      letterSpacing: 2,
      marginBottom: 10,
    },
    title: {
      fontFamily: F.serif,
      fontSize: 30,
      color: C.ink,
      letterSpacing: -0.4,
      lineHeight: 36,
      marginBottom: 8,
    },
    titleAccent: {
      fontFamily: F.serifItalic,
      color: C.ink,
    },
    subtitle: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkMuted,
      lineHeight: 20,
      maxWidth: 320,
    },

    fieldWrap: { marginBottom: 14 },
    label: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1.4,
      marginBottom: 6,
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 48,
    },
    inputShellFocus: {
      borderColor: C.sage,
      shadowColor: C.sage,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      fontFamily: F.sans,
      fontSize: 15,
      color: C.ink,
    },

    cta: {
      backgroundColor: C.sage,
      borderRadius: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: C.sage,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    ctaTxt: {
      fontFamily: F.sans,
      fontSize: 15,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    hint: {
      marginTop: 14,
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkFaint,
      textAlign: 'center',
    },
  }), [themeVersion]);

  const trimmed = name.trim();
  const canContinue = trimmed.length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    updateUser({ name: trimmed, hasOnboarded: true });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.brandRow}>
            <LinearGradient
              colors={[C.sage, C.heroTop]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.monogram}
            >
              <Text style={s.monogramTxt}>B</Text>
            </LinearGradient>
            <Text style={s.wordmark}>BOOKWISE</Text>
          </View>

          <View style={s.hero}>
            <Text style={s.kicker}>ONE QUICK THING</Text>
            <Text style={s.title}>
              What should we{' '}
              <Text style={s.titleAccent}>call you?</Text>
            </Text>
            <Text style={s.subtitle}>
              We guessed this from your email — fix it if it’s off.
            </Text>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>YOUR NAME</Text>
            <Pressable
              onPress={() => nameRef.current?.focus()}
              style={[s.inputShell, focused && s.inputShellFocus]}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={focused ? C.sage : C.inkFaint}
                style={{ marginRight: 10 }}
              />
              <TextInput
                ref={nameRef}
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={C.inkFaint}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleContinue}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.88}
            style={[s.cta, !canContinue && { opacity: 0.45, shadowOpacity: 0 }]}
            disabled={!canContinue}
          >
            <Text style={s.ctaTxt}>Continue</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={s.hint}>You can change this later in Settings.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
