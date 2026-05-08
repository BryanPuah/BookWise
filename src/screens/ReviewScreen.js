/**
 * ProfileScreen — User profile & settings
 *
 * Sections:
 *   PROFILE    → avatar, name, email (editable inline)
 *   APPEARANCE → theme / dark mode toggle
 *   DATA       → export notes, backup, clear data
 *   ABOUT      → version, feedback, privacy
 *
 * Note: exported as `ReviewScreen` to keep navigator wiring intact.
 * Rename later when you're ready to update the route.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { C } from '../theme';

const APP_VERSION = '1.0.0';

// ── Section header ─────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>;
}

// ── Settings row (tappable) ────────────────────────────────────────────
function SettingsRow({ icon, label, sub, onPress, right, danger, isLast }) {
  return (
    <TouchableOpacity
      style={[s.row, isLast && s.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      {icon ? <Text style={s.rowIcon}>{icon}</Text> : null}
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, danger && { color: '#BE3B3B' }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right !== undefined ? right : (onPress ? <Text style={s.rowChevron}>›</Text> : null)}
    </TouchableOpacity>
  );
}

// ── Settings group (card containing rows) ──────────────────────────────
function SettingsGroup({ children }) {
  // Inject isLast into the last child for divider styling
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.group}>
      {items.map((child, i) =>
        React.cloneElement(child, { isLast: i === items.length - 1, key: i })
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export function ReviewScreen() {
  const { notes, books } = useStore();

  // Local-only profile state for now. Wire to your store when ready.
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [editing,  setEditing]  = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const initials = useMemo(() => {
    const n = name.trim();
    if (!n) return '👤';
    const parts = n.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  // ── Handlers (stubs — wire to your store / file system later) ─────
  const handleExport = () => {
    Alert.alert(
      'Export notes',
      `Export ${notes.length} note${notes.length !== 1 ? 's' : ''} across ${books.length} book${books.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => console.log('TODO: export notes') },
      ],
    );
  };

  const handleBackup = () => {
    Alert.alert('Backup', 'Backup feature coming soon.');
  };

  const handleClear = () => {
    Alert.alert(
      'Clear all data?',
      'This will permanently delete all your books and notes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => console.log('TODO: clear store') },
      ],
    );
  };

  const handleFeedback = () => {
    Alert.alert('Send feedback', 'Feedback feature coming soon.');
  };

  const handlePrivacy = () => {
    Alert.alert('Privacy policy', 'Privacy policy coming soon.');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Profile header ────────────────────────────────────── */}
        <LinearGradient colors={[C.heroTop, C.heroBot]} style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initials}</Text>
          </View>

          {editing ? (
            <View style={s.editWrap}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={s.editInput}
                autoFocus
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[s.editInput, { fontSize: 13, marginTop: 6 }]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={s.editDone}
                onPress={() => setEditing(false)}
                activeOpacity={0.85}
              >
                <Text style={s.editDoneTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.heroName}>{name || 'Your name'}</Text>
              <Text style={s.heroEmail}>{email || 'Tap to add details'}</Text>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => setEditing(true)}
                activeOpacity={0.85}
              >
                <Text style={s.editBtnTxt}>Edit profile</Text>
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>

        {/* ── Body ──────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* Appearance */}
          <SectionHeader title="Appearance" />
          <SettingsGroup>
            <SettingsRow
              icon="🌙"
              label="Dark mode"
              sub="Reduce glare in low light"
              right={
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{ false: C.creamDark, true: C.amber }}
                  thumbColor={C.white}
                />
              }
            />
          </SettingsGroup>

          {/* Data */}
          <SectionHeader title="Your data" />
          <SettingsGroup>
            <SettingsRow
              icon="📤"
              label="Export notes"
              sub={`${notes.length} note${notes.length !== 1 ? 's' : ''} ready to export`}
              onPress={handleExport}
            />
            <SettingsRow
              icon="☁️"
              label="Backup"
              sub="Save a copy to the cloud"
              onPress={handleBackup}
            />
            <SettingsRow
              icon="🗑"
              label="Clear all data"
              sub="Permanently delete all books and notes"
              onPress={handleClear}
              danger
            />
          </SettingsGroup>

          {/* About */}
          <SectionHeader title="About" />
          <SettingsGroup>
            <SettingsRow
              icon="✉️"
              label="Send feedback"
              sub="Help shape the app"
              onPress={handleFeedback}
            />
            <SettingsRow
              icon="🔒"
              label="Privacy policy"
              onPress={handlePrivacy}
            />
            <SettingsRow
              icon="ℹ️"
              label="Version"
              right={<Text style={s.versionTxt}>{APP_VERSION}</Text>}
            />
          </SettingsGroup>

          <Text style={s.footer}>Made for readers, by readers.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarTxt: {
    fontSize: 32,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.5,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 16,
  },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  editBtnTxt: {
    fontSize: 12,
    color: C.white,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  editWrap: {
    width: '100%',
    alignItems: 'center',
  },
  editInput: {
    width: '80%',
    fontSize: 16,
    fontWeight: '600',
    color: C.white,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editDone: {
    backgroundColor: C.amber,
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 12,
  },
  editDoneTxt: {
    fontSize: 12,
    color: C.white,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Body
  body: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: C.inkFaint,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Settings group
  group: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    gap: 14,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  rowChevron: {
    fontSize: 22,
    color: C.inkFaint,
    fontWeight: '300',
  },

  versionTxt: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: '500',
  },

  footer: {
    fontSize: 11,
    color: C.inkFaint,
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
});