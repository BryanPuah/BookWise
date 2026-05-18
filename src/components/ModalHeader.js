/**
 * ModalHeader — shared header bar for modal / full-screen surfaces.
 *
 * Centralises the small variations that previously fragmented across
 * EditProfile, StreakActivity, GlobalSearch, LinkedNotesPicker,
 * ReflectionPage, CalendarModal, DayPanel, BookDetail, etc.: padding,
 * title alignment, back/close/cancel affordances, save-pill styling,
 * hit slop, divider, and accessibility roles.
 *
 * Slot API:
 *   left  / right — either a preset descriptor or a custom React node
 *
 * Preset descriptors:
 *   left:  { icon: 'back' | 'close' | 'cancel', onPress, label?, accessibilityLabel? }
 *   right: { kind: 'pill' | 'text' | 'icon', label, onPress, disabled?, icon? (for icon kind), accessibilityLabel? }
 *
 * When titleAlign is 'center' (default), the title is absolutely positioned
 * so unequal-width left / right slots can't drag the title off center.
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from './AppText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function LeftAffordance({ spec, C, F }) {
  if (!spec) return null;
  if (React.isValidElement(spec)) return spec;
  const { icon = 'back', onPress, label, accessibilityLabel, accessibilityHint } = spec;

  if (icon === 'cancel') {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={HIT_SLOP}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label || 'Cancel'}
        accessibilityHint={accessibilityHint}
      >
        <Text style={{ fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' }}>
          {label || 'Cancel'}
        </Text>
      </TouchableOpacity>
    );
  }

  const ionName = icon === 'close' ? 'close' : 'chevron-back';
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={HIT_SLOP}
      activeOpacity={0.7}
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (icon === 'close' ? 'Close' : 'Back')}
      accessibilityHint={accessibilityHint}
    >
      <Ionicons name={ionName} size={22} color={C.ink} importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

function RightAffordance({ spec, C, F }) {
  if (!spec) return null;
  if (React.isValidElement(spec)) return spec;
  const {
    kind = 'pill', label, onPress, disabled = false, icon,
    accessibilityLabel, accessibilityHint,
  } = spec;

  if (kind === 'icon') {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={HIT_SLOP}
        disabled={disabled}
        activeOpacity={0.7}
        style={{
          width: 36, height: 36,
          alignItems: 'center', justifyContent: 'center',
          marginRight: -8,
          opacity: disabled ? 0.4 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
      >
        <Ionicons name={icon} size={20} color={C.ink} importantForAccessibility="no" />
      </TouchableOpacity>
    );
  }

  if (kind === 'text') {
    return (
      <TouchableOpacity
        onPress={onPress}
        hitSlop={HIT_SLOP}
        disabled={disabled}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
      >
        <Text
          style={{
            fontFamily: F.serif,
            fontSize: 14,
            color: disabled ? C.inkFaint : C.ink,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  // pill (default)
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={HIT_SLOP}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        backgroundColor: C.ink,
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 18,
        opacity: disabled ? 0.4 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Text style={{ fontFamily: F.serif, fontSize: 13, color: C.white, fontWeight: '700' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ModalHeader({
  title,
  left,
  right,
  divider = true,
  titleAlign = 'center',
}) {
  const { C, F, themeVersion } = useTheme();

  const s = useMemo(() => StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      minHeight: 56,
      borderBottomWidth: divider ? 0.5 : 0,
      borderBottomColor: C.border,
      position: 'relative',
    },
    leftRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    leftSpacer: { width: 8 },
    titleCenter: {
      position: 'absolute',
      left: 60, right: 60,
      textAlign: 'center',
      fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2,
    },
    titleLeft: {
      fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2,
      marginLeft: 12,
      flexShrink: 1,
    },
    titleOnly: {
      fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2,
    },
  }), [themeVersion, divider]);

  const hasTitle = !!title;
  const showCenteredTitle = hasTitle && titleAlign === 'center';
  const showLeftTitle = hasTitle && titleAlign === 'left';

  return (
    <View style={s.bar}>
      <View style={s.leftRow}>
        {left ? <LeftAffordance spec={left} C={C} F={F} /> : null}
        {showLeftTitle && !left ? (
          <Text style={s.titleOnly} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {showLeftTitle && left ? (
          <Text style={s.titleLeft} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>

      {showCenteredTitle ? (
        <Text
          style={s.titleCenter}
          numberOfLines={1}
          accessibilityRole="header"
          pointerEvents="none"
        >
          {title}
        </Text>
      ) : null}

      {right ? <RightAffordance spec={right} C={C} F={F} /> : null}
    </View>
  );
}
