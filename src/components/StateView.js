/**
 * StateView — shared placeholder UI for empty / loading / error states.
 *
 * The app is currently in-memory only, so loading/error are rarely needed
 * today. Once persistence lands, every list screen will need these — this
 * file establishes a shared visual vocabulary so they look consistent
 * instead of each screen reinventing its own empty block.
 *
 * Three components, one base layout:
 *   <EmptyState icon title sub action />   — list/section has no items
 *   <LoadingState message />               — async work in flight
 *   <ErrorState kind onRetry secondary />  — fetch failed; kind = 'offline' | 'server' | 'generic'
 *
 * All accept `compact` to render inline at smaller sizes (for horizontal
 * rails / inline sections) vs. the default full-page treatment.
 */

import React, { useMemo } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { AppText as Text } from './AppText';
import { useTheme } from '../theme';

function StateShell({ icon, title, sub, primary, secondary, compact, children }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: {
      alignItems: 'center',
      paddingTop: compact ? 32 : 80,
      paddingHorizontal: compact ? 24 : 40,
      paddingBottom: compact ? 24 : 40,
    },
    icon: { fontSize: compact ? 36 : 52, marginBottom: compact ? 10 : 16 },
    title: {
      fontFamily: F.serif,
      fontSize: compact ? 16 : 20,
      fontWeight: '700',
      color: C.ink,
      marginBottom: compact ? 6 : 8,
      textAlign: 'center',
    },
    sub: {
      fontFamily: F.serif,
      fontSize: compact ? 13 : 14,
      color: C.inkMuted,
      textAlign: 'center',
      lineHeight: compact ? 18 : 22,
      marginBottom: (primary || secondary) ? (compact ? 14 : 24) : 0,
    },
    primaryBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
    },
    primaryBtnTxt: { fontFamily: F.sans, fontSize: 14, color: C.white, fontWeight: '700' },
    secondaryBtn: { marginTop: 14 },
    secondaryBtnTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },
  }), [themeVersion, compact, primary, secondary]);

  return (
    <View style={s.wrap}>
      {icon ? <Text style={s.icon}>{icon}</Text> : null}
      {title ? <Text style={s.title}>{title}</Text> : null}
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
      {children}
      {primary ? (
        <TouchableOpacity style={s.primaryBtn} onPress={primary.onPress} activeOpacity={0.85}>
          <Text style={s.primaryBtnTxt}>{primary.label}</Text>
        </TouchableOpacity>
      ) : null}
      {secondary ? (
        <TouchableOpacity style={s.secondaryBtn} onPress={secondary.onPress} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={s.secondaryBtnTxt}>{secondary.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = '📭', title, sub, action, secondary, compact = false }) {
  return (
    <StateShell
      icon={icon}
      title={title}
      sub={sub}
      primary={action}
      secondary={secondary}
      compact={compact}
    />
  );
}

export function LoadingState({ message, compact = false, size }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: {
      flex: compact ? 0 : 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: compact ? 24 : 40,
      gap: 12,
    },
    msg: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted },
  }), [themeVersion, compact]);
  return (
    <View style={s.wrap}>
      <ActivityIndicator size={size || (compact ? 'small' : 'large')} color={C.amber} />
      {message ? <Text style={s.msg}>{message}</Text> : null}
    </View>
  );
}

const ERROR_PRESETS = {
  offline: {
    icon: '📡',
    title: "You're offline",
    sub: 'Reconnect to the internet and try again.',
  },
  server: {
    icon: '⚠️',
    title: "Couldn't reach the server",
    sub: 'Something went wrong on the other end. Try again in a moment.',
  },
  generic: {
    icon: '⚠️',
    title: 'Something went wrong',
    sub: 'Try again, or come back later.',
  },
};

export function ErrorState({
  kind = 'generic',
  title,
  sub,
  onRetry,
  retryLabel = 'Retry',
  secondary,
  compact = false,
}) {
  const preset = ERROR_PRESETS[kind] || ERROR_PRESETS.generic;
  return (
    <StateShell
      icon={preset.icon}
      title={title ?? preset.title}
      sub={sub ?? preset.sub}
      primary={onRetry ? { label: retryLabel, onPress: onRetry } : null}
      secondary={secondary}
      compact={compact}
    />
  );
}

/**
 * Classify a caught fetch error as 'offline' vs 'server'.
 *
 * In React Native, `fetch()` throws `TypeError: Network request failed` when
 * there's no connectivity (or DNS fails) — that's the only signal we have
 * without pulling in NetInfo. An `AbortError` from our own AbortController
 * timeout is treated the same way: the user sees a hang and assumes their
 * connection is bad, so the "you're offline" copy fits better than a vague
 * server error. Anything else (including our explicit `throw new Error(\`HTTP
 * \${res.status}\`)`) is treated as a server error.
 */
export function classifyFetchError(err) {
  if (err?.name === 'AbortError') return 'offline';
  const msg = err?.message || String(err || '');
  if (/Network request failed/i.test(msg)) return 'offline';
  return 'server';
}
