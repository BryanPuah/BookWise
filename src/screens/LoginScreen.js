/**
 * LoginScreen — entry gate.
 *
 * Shown when `user.name` in the store is empty. The screen is purely a
 * design surface today: there's no real auth. Apple / Google buttons open
 * a confirmation sheet (mirrors the dismissible OS sheets) and the email
 * + password form all funnel into the same `updateUser` call so the rest
 * of the app has an identity to render against.
 *
 * Layout follows the editorial language used elsewhere in Bookwise —
 * serif display headline, small uppercase kicker labels, paper-tone
 * surfaces, sage accent. Brand sits at the top, hero gets generous
 * breathing room, the action stack anchors the lower third, footer pins
 * to the bottom — benchmarked against Things, Linear, Headspace.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  View, TouchableOpacity, Pressable, StyleSheet, Modal,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useTheme } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Provider metadata for the OAuth confirmation sheet.
const PROVIDERS = {
  apple:  { label: 'Apple',  icon: 'logo-apple',  email: 'reader@privaterelay.appleid.com', name: 'Apple Reader' },
  google: { label: 'Google', icon: 'logo-google', email: 'reader@gmail.com',                 name: 'Google Reader' },
};

export function LoginScreen() {
  const { C, F, themeVersion } = useTheme();
  const { updateUser } = useStore();

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [oauth, setOauth] = useState(null);    // 'apple' | 'google' | null
  const [oauthBusy, setOauthBusy] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
    },
    container: {
      width: '100%',
      maxWidth: 380,
      alignSelf: 'center',
    },

    // ── Brand row (anchored top) ────────────────────────────────
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 28,
    },
    monogram: {
      width: 32, height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramTxt: {
      fontFamily: F.serif,
      fontSize: 19,
      color: '#FFFFFF',
      includeFontPadding: false,
      marginTop: 2,
    },
    wordmark: {
      fontFamily: F.sans,
      fontSize: 11,
      fontWeight: '800',
      color: C.ink,
      letterSpacing: 2.6,
    },

    // ── Hero copy ───────────────────────────────────────────────
    hero: { marginBottom: 28 },
    kicker: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.sage,
      letterSpacing: 2,
      marginBottom: 14,
    },
    title: {
      fontFamily: F.serif,
      fontSize: 34,
      color: C.ink,
      letterSpacing: -0.5,
      lineHeight: 42,
      marginBottom: 12,
    },
    titleAccent: {
      fontFamily: F.serifItalic,
      color: C.ink,
    },
    subtitle: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.inkMuted,
      lineHeight: 22,
      maxWidth: 320,
    },

    // ── Action stack ────────────────────────────────────────────
    actions: {},

    // ── Social buttons ──────────────────────────────────────────
    socialStack: { gap: 10 },
    socialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 10,
    },
    socialApple:  { backgroundColor: C.ink },
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

    // ── OR divider ──────────────────────────────────────────────
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 18,
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

    // ── Form ────────────────────────────────────────────────────
    fieldWrap: { marginBottom: 12 },
    label: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1.4,
      marginBottom: 8,
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 50,
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
    eye: { paddingHorizontal: 4, paddingVertical: 6 },

    useEmailRow: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 10,
    },
    useEmailLink: {
      fontFamily: F.sans,
      fontSize: 13,
      fontWeight: '600',
      color: C.inkMuted,
      letterSpacing: 0.2,
    },

    // ── Primary CTA ─────────────────────────────────────────────
    cta: {
      marginTop: 18,
      backgroundColor: C.sage,
      borderRadius: 14,
      paddingVertical: 15,
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
    backToSocial: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 6,
    },
    backToSocialTxt: {
      fontFamily: F.sans,
      fontSize: 13,
      fontWeight: '600',
      color: C.inkMuted,
    },

    // ── Footer ──────────────────────────────────────────────────
    footer: {
      marginTop: 18,
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

    // ── OAuth sheet ─────────────────────────────────────────────
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.paper,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 10,
      paddingHorizontal: 22,
      paddingBottom: 28,
    },
    sheetGrabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.borderMid,
      marginBottom: 18,
    },
    sheetIconWrap: {
      alignSelf: 'center',
      width: 48, height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    sheetTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      textAlign: 'center',
      marginBottom: 6,
    },
    sheetSub: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 18,
      paddingHorizontal: 8,
    },
    sheetAccount: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      gap: 12,
      marginBottom: 16,
    },
    sheetAvatar: {
      width: 36, height: 36,
      borderRadius: 18,
      backgroundColor: C.sagePale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetAvatarTxt: {
      fontFamily: F.sans,
      fontSize: 14,
      fontWeight: '700',
      color: C.sage,
    },
    sheetAccountName: {
      fontFamily: F.sans,
      fontSize: 14,
      fontWeight: '600',
      color: C.ink,
    },
    sheetAccountEmail: {
      fontFamily: F.sans,
      fontSize: 12,
      color: C.inkMuted,
      marginTop: 2,
    },
    sheetCta: {
      backgroundColor: C.ink,
      borderRadius: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 8,
    },
    sheetCtaTxt: {
      fontFamily: F.sans,
      fontSize: 15,
      fontWeight: '700',
      color: C.white,
      letterSpacing: 0.2,
    },
    sheetCancel: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    sheetCancelTxt: {
      fontFamily: F.sans,
      fontSize: 14,
      fontWeight: '600',
      color: C.inkMuted,
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

  // Open the dismissible confirmation sheet. The actual identity write
  // happens when the user confirms inside the sheet, so backing out is
  // free — mirrors the OS Apple / Google sheets the user expects.
  const openOauthSheet = (provider) => {
    if (!PROVIDERS[provider]) return;
    setOauth(provider);
    setOauthBusy(false);
  };
  const closeOauthSheet = () => {
    if (oauthBusy) return;
    setOauth(null);
  };
  const confirmOauth = () => {
    const id = PROVIDERS[oauth];
    if (!id) return;
    setOauthBusy(true);
    // Tiny delay so the spinner registers — feels like a real handoff
    // rather than an instant teleport into the app.
    setTimeout(() => {
      updateUser({ name: id.name, email: id.email, avatarSeed: '' });
    }, 450);
  };

  const provider = oauth ? PROVIDERS[oauth] : null;
  const providerInitial = provider ? provider.label[0] : '';
  const providerIsApple = oauth === 'apple';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
         <View style={s.container}>
          {/* Brand row — monogram + wordmark, anchored top */}
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

          {/* Hero copy */}
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

          {/* Action stack — pushed to the lower third by marginTop:'auto' */}
          <View style={s.actions}>
            {!showEmail ? (
              <>
                <View style={s.socialStack}>
                  <TouchableOpacity
                    style={[s.socialBtn, s.socialApple]}
                    activeOpacity={0.85}
                    onPress={() => openOauthSheet('apple')}
                  >
                    <Ionicons name="logo-apple" size={18} color={C.white} />
                    <Text style={[s.socialTxt, s.socialTxtLight]}>
                      Continue with Apple
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.socialBtn, s.socialGoogle]}
                    activeOpacity={0.85}
                    onPress={() => openOauthSheet('google')}
                  >
                    <Ionicons name="logo-google" size={16} color={C.ink} />
                    <Text style={[s.socialTxt, s.socialTxtDark]}>
                      Continue with Google
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={s.useEmailRow}
                  onPress={() => setShowEmail(true)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Text style={s.useEmailLink}>Use email instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.divider}>
                  <View style={s.rule} />
                  <Text style={s.dividerTxt}>SIGN IN WITH EMAIL</Text>
                  <View style={s.rule} />
                </View>

                {/* Email */}
                <View style={s.fieldWrap}>
                  <Text style={s.label}>EMAIL</Text>
                  <Pressable
                    onPress={() => emailRef.current?.focus()}
                    style={[s.inputShell, focused === 'email' && s.inputShellFocus]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={16}
                      color={focused === 'email' ? C.sage : C.inkFaint}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      ref={emailRef}
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
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </Pressable>
                </View>

                {/* Password */}
                <View style={s.fieldWrap}>
                  <Text style={s.label}>PASSWORD</Text>
                  <Pressable
                    onPress={() => passwordRef.current?.focus()}
                    style={[s.inputShell, focused === 'password' && s.inputShellFocus]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color={focused === 'password' ? C.sage : C.inkFaint}
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      ref={passwordRef}
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
                  </Pressable>
                </View>

                {/* Primary CTA — sign-in vs. sign-up is detected on submit */}
                <TouchableOpacity
                  onPress={handleContinue}
                  activeOpacity={0.88}
                  style={[s.cta, !canContinue && { opacity: 0.45, shadowOpacity: 0 }]}
                  disabled={!canContinue}
                >
                  <Text style={s.ctaTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.backToSocial}
                  onPress={() => { setShowEmail(false); setEmail(''); setPassword(''); }}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Text style={s.backToSocialTxt}>Back to sign-in options</Text>
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
          </View>
         </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OAuth confirmation sheet — dismissible, mirrors the OS sheets
          for Apple / Google sign-in so users can back out before any
          identity is written. */}
      <Modal
        visible={!!oauth}
        transparent
        animationType="fade"
        onRequestClose={closeOauthSheet}
      >
        <Pressable style={s.sheetBackdrop} onPress={closeOauthSheet}>
          <Pressable onPress={() => {}}>
            <View style={s.sheet}>
              <View style={s.sheetGrabber} />

              <View
                style={[
                  s.sheetIconWrap,
                  { backgroundColor: providerIsApple ? C.ink : C.white,
                    borderWidth: providerIsApple ? 0 : 1,
                    borderColor: C.borderMid },
                ]}
              >
                {provider && (
                  <Ionicons
                    name={provider.icon}
                    size={24}
                    color={providerIsApple ? C.white : C.ink}
                  />
                )}
              </View>

              <Text style={s.sheetTitle}>
                Sign in with {provider?.label}
              </Text>
              <Text style={s.sheetSub}>
                Bookwise will receive your name and email to set up your
                reading notebook.
              </Text>

              <View style={s.sheetAccount}>
                <View style={s.sheetAvatar}>
                  <Text style={s.sheetAvatarTxt}>{providerInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetAccountName}>{provider?.name}</Text>
                  <Text style={s.sheetAccountEmail}>{provider?.email}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={C.sage} />
              </View>

              <TouchableOpacity
                style={[s.sheetCta, oauthBusy && { opacity: 0.7 }]}
                onPress={confirmOauth}
                activeOpacity={0.88}
                disabled={oauthBusy}
              >
                {oauthBusy ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <>
                    <Text style={s.sheetCtaTxt}>Continue</Text>
                    <Ionicons name="arrow-forward" size={16} color={C.white} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.sheetCancel}
                onPress={closeOauthSheet}
                disabled={oauthBusy}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={s.sheetCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
