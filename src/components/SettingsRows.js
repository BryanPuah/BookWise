/**
 * Shared list-row primitives used by both ProfileScreen and SettingsScreen.
 *
 * SettingRow   — single row: icon + label + optional switch/value/chevron.
 * SwatchPicker — collapsible row that expands to a grid of color swatches.
 * FontPicker   — collapsible row that expands to a list of typography samples.
 */

import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import { AppText as Text } from './AppText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';

export function SettingRow({
  icon, label, value, rightChevron,
  switchValue, onSwitchChange, onPress,
}) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowIconWrap: { width: 30, alignItems: 'center' },
    rowLabel: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      fontWeight: '500',
      marginLeft: 6,
    },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },
  }), [themeVersion]);

  // Resolve a row-level press handler. A row carrying a switch should be
  // tappable across its full width — not just the small switch element —
  // so users can hit the label or padding to toggle. Falls back to the
  // explicit onPress for chevron rows.
  const hasSwitch = switchValue !== undefined;
  const rowPress = onPress || (hasSwitch && onSwitchChange
    ? () => onSwitchChange(!switchValue)
    : undefined);

  return (
    <TouchableOpacity
      style={s.row}
      onPress={rowPress}
      activeOpacity={rowPress ? 0.7 : 1}
      disabled={!rowPress}
    >
      <View style={s.rowIconWrap}>
        <Ionicons name={icon} size={18} color={C.inkMuted} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        {hasSwitch && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: C.cream, true: C.sage }}
            thumbColor={C.white}
            ios_backgroundColor={C.cream}
          />
        )}
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {rightChevron && <Ionicons name="chevron-forward" size={16} color={C.inkFaint} />}
      </View>
    </TouchableOpacity>
  );
}

// `variant` controls swatch styling:
//   • 'accent'     — saturated chips with shadow + white check mark
//   • 'background' — paper-tone chips with a thin border (so light
//                    swatches stay visible against the card surface)
export function SwatchPicker({ icon, label, entries, activeKey, onPick, variant = 'accent' }) {
  const { C, F, themeVersion } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isBackground = variant === 'background';

  const s = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowIconWrap: { width: 30, alignItems: 'center' },
    rowLabel: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      fontWeight: '500',
      marginLeft: 6,
    },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },
    divider: {
      height: 0.5,
      backgroundColor: C.border,
      marginLeft: 50,
    },
    gridWrap: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
      ...(isBackground
        ? { borderWidth: 1, borderColor: C.borderMid }
        : {
            shadowColor: C.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }),
    },
  }), [themeVersion, isBackground]);

  const activeEntry = entries.find(([k]) => k === activeKey);
  const activeLabel = activeEntry?.[1]?.label || 'Default';

  return (
    <View>
      <TouchableOpacity
        style={s.row}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <View style={s.rowIconWrap}>
          <Ionicons name={icon} size={18} color={C.inkMuted} />
        </View>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={s.rowRight}>
          <Text style={s.rowValue}>{activeLabel}</Text>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={C.inkFaint}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <>
          <View style={s.divider} />
          <View style={s.gridWrap}>
            <View style={s.grid}>
              {entries.map(([key, item]) => {
                const active = key === activeKey;
                // Background check mark needs to contrast against the
                // light paper swatch — use ink. Accent check uses white.
                const checkColor = isBackground ? C.ink : C.white;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.swatchWrap, active && s.swatchWrapActive]}
                    onPress={() => onPick(key)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${item.label} ${isBackground ? 'background' : 'accent'}`}
                  >
                    <View style={[s.swatch, { backgroundColor: item.swatch }]}>
                      {active && (
                        <Ionicons name="checkmark" size={22} color={checkColor} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// Collapsible picker for the reading font. Each row previews the face
// inline ("Aa  Label") so the user sees what they're picking before
// committing. The active row gets the accent pale background + check.
export function FontPicker({ icon, label, entries, activeKey, onPick }) {
  const { C, F, themeVersion } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowIconWrap: { width: 30, alignItems: 'center' },
    rowLabel: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      fontWeight: '500',
      marginLeft: 6,
    },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },
    divider: {
      height: 0.5,
      backgroundColor: C.border,
      marginLeft: 50,
    },
    listWrap: {
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 10,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      marginVertical: 2,
    },
    optionRowActive: {
      backgroundColor: C.sagePale,
    },
    sample: {
      width: 38,
      fontSize: 22,
      color: C.ink,
    },
    optionLabel: {
      flex: 1,
      fontSize: 15,
      color: C.ink,
      marginLeft: 10,
    },
  }), [themeVersion]);

  const activeEntry = entries.find(([k]) => k === activeKey);
  const activeLabel = activeEntry?.[1]?.label || 'Default';

  return (
    <View>
      <TouchableOpacity
        style={s.row}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <View style={s.rowIconWrap}>
          <Ionicons name={icon} size={18} color={C.inkMuted} />
        </View>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={s.rowRight}>
          <Text style={s.rowValue}>{activeLabel}</Text>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={C.inkFaint}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <>
          <View style={s.divider} />
          <View style={s.listWrap}>
            {entries.map(([key, item]) => {
              const active = key === activeKey;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.optionRow, active && s.optionRowActive]}
                  onPress={() => onPick(key)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${item.label} font`}
                >
                  <Text style={[s.sample, { fontFamily: item.serif }]}>Aa</Text>
                  <Text style={[s.optionLabel, { fontFamily: item.serif }]}>
                    {item.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={18} color={C.sage} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
