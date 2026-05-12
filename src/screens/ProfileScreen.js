/**
 * ProfileScreen — sectioned settings page (Figma-faithful).
 *
 * Layout (matches the screenshot):
 *   1. Avatar with edit pencil badge + serif name + role subtitle
 *   2. ACCOUNT SETTINGS — Email row + Change Password row
 *   3. JOURNALING PREFERENCES — Typography, Theme, Reading Reminders
 *   4. SUPPORT & LEGAL — Help Center, Privacy Policy
 *   5. Logout button (outlined red)
 *
 * What works:
 *   - Tap avatar / header → opens EditProfileModal (real edit flow)
 *   - Logout button → clears user from store, app routes to LoginScreen
 *   - Reading Reminders toggle has working visual state (in-memory only)
 *   - Theme toggle has visual light/dark icons (no actual theming)
 *
 * What's a placeholder (alert on tap):
 *   - Email row, Change Password, Typography, Help Center, Privacy Policy
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { EditProfileModal, buildAvatarUrl } from '../components/EditProfileModal';
import { C, F } from '../theme';

// Initials fallback when no avatar seed (legacy users)
function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Reusable row — left icon + label + right value/chevron/toggle
function SettingRow({ icon, label, value, rightChevron, switchValue, onSwitchChange, onPress, isCustomRight }) {
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
        {isCustomRight ? null : value ? <Text style={s.rowValue}>{value}</Text> : null}
        {rightChevron && <Ionicons name="chevron-forward" size={16} color={C.inkFaint} />}
      </View>
    </TouchableOpacity>
  );
}

export function ProfileScreen() {
  const { user, logout } = useStore();
  const [editOpen, setEditOpen] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [theme, setTheme] = useState('light'); // 'light' | 'dark' (visual only)

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
          {/* Theme — light/dark toggle (visual only) */}
          <View style={s.row}>
            <View style={s.rowIconWrap}>
              <Ionicons name="moon-outline" size={18} color={C.inkMuted} />
            </View>
            <Text style={s.rowLabel}>Theme</Text>
            <View style={s.themeToggleWrap}>
              <TouchableOpacity
                style={[s.themeBtn, theme === 'light' && s.themeBtnActive]}
                onPress={() => {
                  if (theme !== 'light') {
                    showComingSoon('Theme switching');
                    setTheme('light');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="sunny" size={14} color={theme === 'light' ? C.ink : C.inkMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.themeBtn, theme === 'dark' && s.themeBtnActive]}
                onPress={() => {
                  if (theme !== 'dark') {
                    showComingSoon('Theme switching');
                    setTheme('dark');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="moon" size={14} color={theme === 'dark' ? C.ink : C.inkMuted} />
              </TouchableOpacity>
            </View>
          </View>
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
          <Ionicons name="log-out-outline" size={18} color={C.rose || '#C0392B'} />
          <Text style={s.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </SafeAreaView>
  );
}

const ROSE = '#C0392B';

const s = StyleSheet.create({
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
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: '500',
  },

  // Section
  sectionLabel: {
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

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIconWrap: {
    width: 30,
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: C.ink,
    fontWeight: '500',
    marginLeft: 6,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: '500',
  },

  // Theme toggle
  themeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: C.cream,
    borderRadius: 18,
    padding: 3,
    gap: 2,
  },
  themeBtn: {
    width: 30,
    height: 28,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnActive: {
    backgroundColor: C.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
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
    fontSize: 14,
    color: ROSE,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});