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

import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { F } from '../theme';

const defaultTextStyle = { fontFamily: F.serif };

export function AppText({ style, ...rest }) {
  return <RNText {...rest} style={[defaultTextStyle, style]} />;
}

export function AppTextInput({ style, ...rest }) {
  return <RNTextInput {...rest} style={[defaultTextStyle, style]} />;
}
