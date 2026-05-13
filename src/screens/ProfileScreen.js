/**
 * ProfileScreen — sectioned settings page (Figma-faithful).
 *
 * Layout:
 *   1. Avatar with edit pencil badge + serif name + role subtitle
 *   2. ACCOUNT SETTINGS — Email row + Change Password row
 *   3. APPEARANCE — 10-theme color picker (Todoist-style)
 *   4. JOURNALING PREFERENCES — Typography, Reading Reminders
 *   5. SUPPORT & LEGAL — Help Center, Privacy Policy
 *   6. Logout button (outlined red)
 *
 * Theme picker — tapping a swatch calls setTheme() from useTheme(),
 * which mutates the live palette and re-renders every subscribed
 * component across the app.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { EditProfileModal, buildAvatarUrl } from '../components/EditProfileModal';
import { useTheme } from '../theme';

// Initials fallback when no avatar seed (legacy users)
function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Reusable row — left icon + label + right value/chevron/toggle
function SettingRow({ icon, label, value, rightChevron, switchValue, onSwitchChange, onPress }) {
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

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={s.rowIconWrap}>
        <Ionicons name={icon} size={18} color={C.inkMuted} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        {switchValue !== undefined && (
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

// Theme picker — collapsible row. Tap header to expand swatch grid.
function ThemePicker() {
  const { C, F, themes, themeName, setTheme, themeVersion } = useTheme();
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
  }), [themeVersion]);

  const entries = Object.entries(themes);
  const activeLabel = themes[themeName]?.label || 'Default';

  return (
    <View>
      <TouchableOpacity
        style={s.row}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <View style={s.rowIconWrap}>
          <Ionicons name="color-palette-outline" size={18} color={C.inkMuted} />
        </View>
        <Text style={s.rowLabel}>Color Theme</Text>
        <View style={s.rowRight}>
          <Ionicons name="chevron-forward" size={16} color={C.inkFaint} />
        </View>
      </TouchableOpacity>
      {expanded && (
        <>
          <View style={s.divider} />
          <View style={s.gridWrap}>
            <View style={s.grid}>
              {entries.map(([key, theme]) => {
                const active = key === themeName;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.swatchWrap, active && s.swatchWrapActive]}
                    onPress={() => setTheme(key)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${theme.label} theme`}
                  >
                    <View style={[s.swatch, { backgroundColor: theme.swatch }]}>
                      {active && (
                        <Ionicons name="checkmark" size={22} color={C.white} />
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

export function ProfileScreen() {
  const { user, logout } = useStore();
  const { C, F, themeVersion } = useTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [reminders, setReminders] = useState(true);

  const ROSE = '#C0392B';

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    // Header — avatar + name + role
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 28,
      paddingHorizontal: 20,
    },
    avatarWrap: {
      width: 88,
      height: 88,
      position: 'relative',
      marginBottom: 14,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.cream,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackTxt: {
      fontFamily: F.serif,
      fontSize: 28,
      color: C.ink,
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.ink,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.paper,
    },
    name: {
      fontFamily: F.serif,
      fontSize: 26,
      color: C.ink,
      letterSpacing: -0.4,
      marginBottom: 2,
    },
    role: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },

    // Section
    sectionLabel: {
      fontFamily: F.serif,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1.4,
      marginHorizontal: 24,
      marginTop: 18,
      marginBottom: 10,
    },
    card: {
      marginHorizontal: 16,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    divider: {
      height: 0.5,
      backgroundColor: C.border,
      marginLeft: 50,
    },

    // Logout
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 28,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: ROSE,
      backgroundColor: C.white,
    },
    logoutTxt: {
      fontFamily: F.serif,
      fontSize: 14,
      color: ROSE,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  }), [themeVersion]);

  const showComingSoon = (label) =>
    Alert.alert(label, 'Coming soon.');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header — avatar + name + role */}
        <TouchableOpacity
          style={s.header}
          onPress={() => setEditOpen(true)}
          activeOpacity={0.85}
        >
          <View style={s.avatarWrap}>
            {user.avatarSeed ? (
              <Image source={{ uri: buildAvatarUrl(user.avatarSeed, 240) }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarFallbackTxt}>{getInitials(user.name)}</Text>
              </View>
            )}
            {/* Edit pencil badge */}
            <View style={s.editBadge}>
              <Ionicons name="pencil" size={11} color={C.white} />
            </View>
          </View>
          <Text style={s.name}>{user.name || 'Reader'}</Text>
          <Text style={s.role}>Archivist & Enthusiastic Reader</Text>
        </TouchableOpacity>

        {/* ACCOUNT SETTINGS */}
        <Text style={s.sectionLabel}>ACCOUNT SETTINGS</Text>
        <View style={s.card}>
          <SettingRow
            icon="mail-outline"
            label="Email Address"
            value={user.email || 'you@example.com'}
            rightChevron
            onPress={() => setEditOpen(true)}
          />
          <View style={s.divider} />
          <SettingRow
            icon="lock-closed-outline"
            label="Change Password"
            rightChevron
            onPress={() => showComingSoon('Change Password')}
          />
        </View>

        {/* APPEARANCE — color theme picker */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.card}>
          <ThemePicker />
        </View>

        {/* JOURNALING PREFERENCES */}
        <Text style={s.sectionLabel}>JOURNALING PREFERENCES</Text>
        <View style={s.card}>
          <SettingRow
            icon="text-outline"
            label="Typography"
            value="Modern Library"
            rightChevron
            onPress={() => showComingSoon('Typography')}
          />
          <View style={s.divider} />
          <SettingRow
            icon="notifications-outline"
            label="Reading Reminders"
            switchValue={reminders}
            onSwitchChange={setReminders}
          />
        </View>

        {/* SUPPORT & LEGAL */}
        <Text style={s.sectionLabel}>SUPPORT & LEGAL</Text>
        <View style={s.card}>
          <SettingRow
            icon="help-circle-outline"
            label="Help Center"
            rightChevron
            onPress={() => showComingSoon('Help Center')}
          />
          <View style={s.divider} />
          <SettingRow
            icon="shield-outline"
            label="Privacy Policy"
            rightChevron
            onPress={() => showComingSoon('Privacy Policy')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={logout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={ROSE} />
          <Text style={s.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </SafeAreaView>
  );
}
