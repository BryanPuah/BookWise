/**
 * AppText / AppTextInput — thin wrappers that default to the app's
 * reading serif (DM Serif Display) without mutating Text.defaultProps.
 *
 * React 19 flags defaultProps on function components as deprecated, so
 * the old `Text.defaultProps.style = ...` approach in App.js generates
 * a warning. These wrappers apply the same default via style merging
 * and let any caller override fontFamily by passing their own style.
 *
 * Usage — the codebase aliases on import to minimise JSX churn:
 *
 *   import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
 *
 * Later split (serif vs sans by purpose) can land here without touching
 * call sites.
 */

import React, { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { F } from '../theme';

// DM Serif Display (and the other selectable reading faces) ship no CJK
// glyphs, so Chinese/Japanese/Korean would otherwise render as tofu or
// the device default. When children contain any CJK codepoint, fall back
// to F.sans (System), which resolves to a CJK-capable face on both iOS
// and Android. Covers: CJK Symbols/Punctuation, Hiragana, Katakana, CJK
// Extension A, Unified Ideographs, Hangul Syllables, CJK Compatibility
// Ideographs, and Halfwidth/Fullwidth Forms.
const CJK_RE = /[　-ヿ㐀-鿿가-힯豈-﫿＀-￯]/;

function containsCJK(value) {
  if (value == null || value === false) return false;
  if (typeof value === 'string' || typeof value === 'number') {
    return CJK_RE.test(String(value));
  }
  if (Array.isArray(value)) return value.some(containsCJK);
  return false;
}

// Read F.serif at render time (not module-load time) so font swaps via
// setFont() propagate to every text node on the next render pass.
export function AppText({ style, ...rest }) {
  const fontFamily = containsCJK(rest.children) ? F.sans : F.serif;
  return <RNText {...rest} style={[{ fontFamily }, style]} />;
}

// forwardRef so callers can programmatically focus the input — used by
// the tap-target wrappers in LoginScreen / ConfirmNameScreen and by the
// next-field chain in EditProfileModal.
export const AppTextInput = forwardRef(function AppTextInput({ style, ...rest }, ref) {
  const sample = rest.value != null ? rest.value : rest.defaultValue;
  const fontFamily = containsCJK(sample) ? F.sans : F.serif;
  return <RNTextInput ref={ref} {...rest} style={[{ fontFamily }, style]} />;
});
