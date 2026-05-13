import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { useTheme } from '../theme';
import Ionicons from '@expo/vector-icons/Ionicons';

const APP_VERSION = '1.0.0';

// ── Style builder shared across sub-components in this file ───────────
function useReviewStyles() {
  const { C, F, themeVersion } = useTheme();
  return useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    hero: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 32,
      alignItems: 'center',
      position: 'relative',
    },

    backBtn: {
      position: 'absolute',
      top: 18,
      left: 16,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    avatarTxt: {
      fontFamily: F.serif,
      fontSize: 32,
      fontWeight: '700',
      color: C.white,
    },

    heroName: {
      fontFamily: F.serif,
      fontSize: 22,
      fontWeight: '700',
      color: C.white,
    },

    heroEmail: {
      fontFamily: F.serif,
      fontSize: 13,
      color: 'rgba(255,255,255,0.6)',
      marginBottom: 16,
    },

    editBtn: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 20,
    },

    editBtnTxt: {
      fontFamily: F.serif,
      color: C.white,
      fontWeight: '600',
    },

    editWrap: { width: '100%', alignItems: 'center' },

    editInput: {
      fontFamily: F.serif,
      width: '80%',
      fontSize: 16,
      color: C.white,
      textAlign: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 8,
    },

    editDone: {
      backgroundColor: C.amber,
      paddingHorizontal: 22,
      paddingVertical: 9,
      borderRadius: 20,
      marginTop: 12,
    },

    editDoneTxt: {
      fontFamily: F.serif,
      color: C.white,
      fontWeight: '700',
    },

    body: { padding: 20 },

    sectionHeader: {
      fontFamily: F.serif,
      fontSize: 11,
      fontWeight: '700',
      color: C.inkFaint,
      marginTop: 18,
      marginBottom: 10,
    },

    group: {
      backgroundColor: C.white,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },

    rowLast: { borderBottomWidth: 0 },

    rowIcon: { fontSize: 18, width: 24 },

    rowBody: { flex: 1 },

    rowLabel: { fontFamily: F.serif, fontSize: 15, color: C.ink },

    rowSub: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted },

    rowChevron: { fontFamily: F.serif, fontSize: 20, color: C.inkFaint },
  }), [themeVersion]);
}

// ── Section header ─────────────────────────────────────────────────────
function SectionHeader({ title }) {
  const s = useReviewStyles();
  return <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>;
}

// ── Settings row ───────────────────────────────────────────────────────
function SettingsRow({ icon, label, sub, onPress, right, danger, isLast }) {
  const s = useReviewStyles();
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

// ── Settings group ─────────────────────────────────────────────────────
function SettingsGroup({ children }) {
  const s = useReviewStyles();
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
export function ReviewScreen({ navigation }) {
  const { C, F } = useTheme();
  const s = useReviewStyles();
  const { notes, books } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const initials = useMemo(() => {
    const n = name.trim();
    if (!n) return '👤';
    const parts = n.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── PROFILE HEADER ────────────────────────────────────── */}
        <LinearGradient colors={[C.heroTop, C.heroBot]} style={s.hero}>

          {/* BACK BUTTON */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={s.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>

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
              >
                <Text style={s.editBtnTxt}>Edit profile</Text>
              </TouchableOpacity>
            </>
          )}

        </LinearGradient>

        {/* ── BODY ──────────────────────────────────────────────── */}
        <View style={s.body}>

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

          <SectionHeader title="Your data" />
          <SettingsGroup>
            <SettingsRow icon="📤" label="Export notes" sub={`${notes.length} notes`} />
            <SettingsRow icon="☁️" label="Backup" sub="Save a copy to the cloud" />
            <SettingsRow icon="🗑" label="Clear all data" danger />
          </SettingsGroup>

          <SectionHeader title="About" />
          <SettingsGroup>
            <SettingsRow icon="✉️" label="Send feedback" />
            <SettingsRow icon="🔒" label="Privacy policy" />
            <SettingsRow icon="ℹ️" label="Version" right={<Text>{APP_VERSION}</Text>} />
          </SettingsGroup>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
