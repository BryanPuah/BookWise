/**
 * LoginScreen — entry gate.
 *
 * Shown when `user.name` in the store is empty. The screen is purely a
 * design surface today: there's no real auth. The Apple / Google buttons
 * and the email + password form all funnel into the same `updateUser`
 * call so the rest of the app has an identity to render against.
 *
 * Layout follows the editorial language used elsewhere in Bookwise —
 * serif display headline, small uppercase kicker labels, paper-tone
 * surfaces, sage accent. Social sign-in is the primary path; email +
 * password is revealed on demand. Sign-in vs. sign-up is detected on
 * submit, not surfaced as a UI choice.
 */

import React, { useState, useMemo } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useTheme } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { C, F, themeVersion } = useTheme();
  const { updateUser } = useStore();

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    scroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      justifyContent: 'center',
    },

    // ── Brand row ────────────────────────────────────────────────
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
      color: C.white,
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

    // ── Hero copy ────────────────────────────────────────────────
    hero: { marginBottom: 20 },
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

    // ── Social buttons ───────────────────────────────────────────
    socialStack: {
      gap: 8,
      marginBottom: 16,
    },
    socialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
      gap: 10,
    },
    socialApple: {
      backgroundColor: C.ink,
    },
    socialGoogle: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.borderMid,
    },
    socialTxt: {
      fontFamily: F.sans,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    socialTxtLight: { color: C.white },
    socialTxtDark:  { color: C.ink },

    // ── OR divider ───────────────────────────────────────────────
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 12,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.borderMid,
    },
    dividerTxt: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkFaint,
      letterSpacing: 1.6,
    },

    // ── Form ─────────────────────────────────────────────────────
    fieldWrap: { marginBottom: 10 },
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
    eye: {
      paddingHorizontal: 4,
      paddingVertical: 6,
    },

    useEmailRow: {
      alignItems: 'center',
      paddingVertical: 10,
      marginBottom: 4,
    },
    useEmailLink: {
      fontFamily: F.sans,
      fontSize: 13,
      fontWeight: '600',
      color: C.inkMuted,
    },

    // ── Primary CTA ──────────────────────────────────────────────
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
      color: C.white,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    // ── Footer ───────────────────────────────────────────────────
    footer: {
      marginTop: 20,
      alignItems: 'center',
      paddingHorizontal: 14,
    },
    footerTxt: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.inkFaint,
      textAlign: 'center',
      lineHeight: 16,
    },
    footerLink: {
      color: C.inkMuted,
      textDecorationLine: 'underline',
    },
  }), [themeVersion]);

  const canContinue = EMAIL_RE.test(email.trim()) && password.length > 0;

  // Derive a display name from the email local-part so the rest of the
  // app has something to render. "ada.lovelace@x.io" → "Ada Lovelace".
  const handleContinue = () => {
    if (!canContinue) return;
    const clean = email.trim();
    const local = clean.split('@')[0] || clean;
    const name = local
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') || 'Reader';
    updateUser({ name, email: clean, avatarSeed: '' });
  };

  // Placeholder identities until real OAuth lands. Distinct per provider
  // so it's obvious in development which path was taken.
  const handleSocial = (provider) => {
    const identities = {
      apple:  { name: 'Apple Reader',  email: 'reader@privaterelay.appleid.com' },
      google: { name: 'Google Reader', email: 'reader@gmail.com' },
    };
    const id = identities[provider];
    if (!id) return;
    updateUser({ ...id, avatarSeed: '' });
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
          {/* Brand row — monogram + wordmark */}
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

          {/* Hero copy — unified for new + returning readers */}
          <View style={s.hero}>
            <Text style={s.kicker}>A READER’S NOTEBOOK</Text>
            <Text style={s.title}>
              Capture what you{' '}
              <Text style={s.titleAccent}>read.</Text>
            </Text>
            <Text style={s.subtitle}>
              Quotes, questions, and insights — woven together over time.
            </Text>
          </View>

          {/* Social sign-in — primary path */}
          <View style={s.socialStack}>
            <TouchableOpacity
              style={[s.socialBtn, s.socialApple]}
              activeOpacity={0.85}
              onPress={() => handleSocial('apple')}
            >
              <Ionicons name="logo-apple" size={18} color={C.white} />
              <Text style={[s.socialTxt, s.socialTxtLight]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.socialBtn, s.socialGoogle]}
              activeOpacity={0.85}
              onPress={() => handleSocial('google')}
            >
              <Ionicons name="logo-google" size={16} color={C.ink} />
              <Text style={[s.socialTxt, s.socialTxtDark]}>
                Continue with Google
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email path — hidden until requested */}
          {!showEmail ? (
            <TouchableOpacity
              style={s.useEmailRow}
              onPress={() => setShowEmail(true)}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Text style={s.useEmailLink}>Use email instead</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Divider */}
              <View style={s.divider}>
                <View style={s.rule} />
                <Text style={s.dividerTxt}>OR WITH EMAIL</Text>
                <View style={s.rule} />
              </View>

              {/* Email */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>EMAIL</Text>
                <View style={[s.inputShell, focused === 'email' && s.inputShellFocus]}>
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={focused === 'email' ? C.sage : C.inkFaint}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={C.inkFaint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>PASSWORD</Text>
                <View style={[s.inputShell, focused === 'password' && s.inputShellFocus]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={focused === 'password' ? C.sage : C.inkFaint}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={C.inkFaint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={handleContinue}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    style={s.eye}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={C.inkMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary CTA — sign-in vs. sign-up is detected on submit */}
              <TouchableOpacity
                onPress={handleContinue}
                activeOpacity={0.88}
                style={[s.cta, !canContinue && { opacity: 0.45, shadowOpacity: 0 }]}
                disabled={!canContinue}
              >
                <Text style={s.ctaTxt}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={C.white} />
              </TouchableOpacity>
            </>
          )}

          {/* Footer — terms */}
          <View style={s.footer}>
            <Text style={s.footerTxt}>
              By continuing, you agree to our{' '}
              <Text style={s.footerLink}>Terms</Text> and acknowledge our{' '}
              <Text style={s.footerLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
