/**
 * ProfileScreen — identity + workspace stats at a glance.
 *
 * Layout:
 *   1. Avatar + name + live header subtitle (notes · reflections · streak)
 *   2. STATS — 2×2 grid: Notes, Reflections, Books with notes, Streak
 *   3. ACCOUNT — Email row (taps EditProfileModal)
 *   4. PREFERENCES — Settings row → SettingsScreen
 *   5. Logout (outlined rose)
 *
 * Configuration (appearance, workspace, data, about) lives in
 * SettingsScreen so the Profile tab stays focused on identity rather
 * than scrolling past chrome every time it's opened.
 */

import React, { useState, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore, todayKey } from '../store';
import {
  EditProfileModal, getAvatarColor, getInitials,
} from '../components/EditProfileModal';
import { useTheme } from '../theme';
import { SettingRow } from '../components/SettingsRows';

// Build a Markdown document from the user's notes + reflections. The
// shape is friendly for re-import into Obsidian / Bear / Notion: H3 per
// book, blockquote for `isQuote` notes, italic metadata line per note,
// trailing reflections grouped chronologically. Empty fields are
// skipped to keep the output tight.
//
// Exported so SettingsScreen can call it from the Export Notes row.
export function buildMarkdownExport({ notes, reflections, books, user }) {
  const lines = [];
  const today = todayKey();
  const owner = user?.name?.trim() || 'My';
  lines.push(`# ${owner} — Bookwise Export`);
  lines.push(`_Generated ${today} · ${notes.length} notes · ${reflections.length} reflections_`);
  lines.push('');

  if (notes.length) {
    lines.push('## Notes');
    lines.push('');
    // Group notes by book so the export reads like a commonplace book
    const byBook = new Map();
    notes.forEach(n => {
      const key = n.bookId || '__unattached__';
      const title =
        n.bookTitle ||
        books.find(b => b.id === n.bookId)?.title ||
        'Unattached';
      if (!byBook.has(key)) byBook.set(key, { title, list: [] });
      byBook.get(key).list.push(n);
    });

    byBook.forEach(({ title, list }) => {
      lines.push(`### ${title}`);
      lines.push('');
      list
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .forEach(n => {
          const typeLabel = n.isQuote
            ? 'Quote'
            : (Array.isArray(n.types) && n.types[0]) || n.type || 'Note';
          const meta = [typeLabel];
          if (n.page) meta.push(`p. ${n.page}`);
          if (n.chapter) meta.push(n.chapter);
          if (n.date) meta.push(n.date);

          if (n.title) lines.push(`#### ${n.title}`);
          lines.push(`_${meta.join(' · ')}_`);
          lines.push('');

          // Prefer block content, fall back to legacy single-text notes
          let body = (n.text || '').trim();
          if (!body && Array.isArray(n.blocks)) {
            body = n.blocks
              .filter(b => b && typeof b.text === 'string' && b.text.trim())
              .map(b => b.text.trim())
              .join('\n\n');
          }
          if (n.isQuote && body) {
            body = body.split('\n').map(l => `> ${l}`).join('\n');
          }
          if (body) lines.push(body);
          if (n.thinking?.trim()) {
            lines.push('');
            lines.push(`**Reflection:** ${n.thinking.trim()}`);
          }
          lines.push('');
          lines.push('---');
          lines.push('');
        });
    });
  }

  if (reflections.length) {
    lines.push('## Daily Reflections');
    lines.push('');
    reflections
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach(r => {
        lines.push(`### ${r.date}`);
        lines.push('');
        lines.push(r.text);
        lines.push('');
      });
  }

  if (!notes.length && !reflections.length) {
    lines.push('_No notes or reflections yet — start writing to build your library._');
  }

  return lines.join('\n');
}

// Compact 2×2 stats grid — surfaces the user's notetaking output at a
// glance. Numbers are derived live from the store on every render so the
// grid stays in sync as notes/reflections are added.
function StatsGrid({ stats }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: {
      marginHorizontal: 16,
      marginTop: 2,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: '50%',
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'flex-start',
    },
    cellTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    cellLabel: {
      fontFamily: F.sans,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 1.2,
    },
    cellValue: {
      fontFamily: F.serif,
      fontSize: 26,
      color: C.ink,
      letterSpacing: -0.5,
    },
    cellSubtitle: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      marginTop: 2,
    },
    divH: { height: 1, backgroundColor: C.border, width: '100%' },
    divV: { width: 1, backgroundColor: C.border },
  }), [themeVersion]);

  return (
    <View style={s.wrap}>
      {stats.map((stat, i) => {
        const isRightCol = i % 2 === 1;
        const isBottomRow = i >= 2;
        return (
          <View key={stat.label} style={[
            s.cell,
            !isRightCol && { borderRightWidth: 1, borderRightColor: C.border },
            !isBottomRow && { borderBottomWidth: 1, borderBottomColor: C.border },
          ]}>
            <View style={s.cellTopRow}>
              <Ionicons name={stat.icon} size={13} color={C.inkMuted} />
              <Text style={s.cellLabel}>{stat.label}</Text>
            </View>
            <Text style={s.cellValue}>{stat.value}</Text>
            {stat.subtitle ? <Text style={s.cellSubtitle}>{stat.subtitle}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation();
  const {
    user, logout,
    notes, reflections, books, currentStreak,
  } = useStore();
  const {
    C, F, themeVersion,
  } = useTheme();
  const [editOpen, setEditOpen] = useState(false);

  // Derived stats — books with at least one note (not "books read"),
  // since this app is a notetaking workspace, not a reading tracker.
  const booksWithNotes = useMemo(() => {
    const ids = new Set(notes.map(n => n.bookId).filter(Boolean));
    return ids.size;
  }, [notes]);

  const stats = useMemo(() => ([
    { label: 'NOTES',       value: notes.length,       icon: 'reader-outline',         subtitle: notes.length === 1 ? 'captured' : 'captured' },
    { label: 'REFLECTIONS', value: reflections.length, icon: 'journal-outline',        subtitle: reflections.length === 1 ? 'entry' : 'entries' },
    { label: 'BOOKS',       value: booksWithNotes,     icon: 'library-outline',        subtitle: `of ${books.length} in library` },
    { label: 'STREAK',      value: currentStreak,      icon: 'flame-outline',          subtitle: currentStreak === 1 ? 'day' : 'days' },
  ]), [notes.length, reflections.length, booksWithNotes, books.length, currentStreak]);

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
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 3,
    },
    avatarInitials: {
      fontFamily: F.serif,
      fontSize: 34,
      color: C.white,
      letterSpacing: -0.6,
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
    headerStats: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
      letterSpacing: 0.1,
    },
    rowValueMuted: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkFaint,
      fontWeight: '500',
      fontStyle: 'italic',
    },

    // Section
    sectionLabel: {
      fontFamily: F.sans,
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
      borderColor: C.rose,
      backgroundColor: C.white,
    },
    logoutTxt: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.rose,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  }), [themeVersion]);

  const handleOpenSettings = () => navigation.navigate('Settings');

  // Live subtitle under the user name — replaces the old hardcoded
  // "Archivist & Enthusiastic Reader" line with a meaningful summary.
  const headerSubtitle = (() => {
    const parts = [];
    if (notes.length)       parts.push(`${notes.length} note${notes.length === 1 ? '' : 's'}`);
    if (reflections.length) parts.push(`${reflections.length} reflection${reflections.length === 1 ? '' : 's'}`);
    if (currentStreak)      parts.push(`${currentStreak}-day streak`);
    return parts.length ? parts.join(' · ') : 'Your notetaking workspace';
  })();

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
            <View style={[s.avatar, { backgroundColor: getAvatarColor(user.avatarSeed, user.name) }]}>
              <Text style={s.avatarInitials}>{getInitials(user.name)}</Text>
            </View>
            {/* Edit pencil badge */}
            <View style={s.editBadge}>
              <Ionicons name="pencil" size={11} color={C.white} />
            </View>
          </View>
          <Text style={s.name} numberOfLines={2} ellipsizeMode="tail">{user.name || 'Reader'}</Text>
          <Text style={s.headerStats}>{headerSubtitle}</Text>
        </TouchableOpacity>

        {/* STATS — notes-first snapshot of the user's workspace */}
        <StatsGrid stats={stats} />

        {/* ACCOUNT */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <SettingRow
            icon="mail-outline"
            label="Email Address"
            value={user.email || 'Tap to add'}
            rightChevron
            onPress={() => setEditOpen(true)}
          />
        </View>

        {/* PREFERENCES — single entry into the full Settings screen */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <SettingRow
            icon="settings-outline"
            label="Settings"
            rightChevron
            onPress={handleOpenSettings}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() => Alert.alert(
            'Sign out?',
            "You'll need to sign back in to access your library.",
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: logout },
            ],
          )}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={C.rose} />
          <Text style={s.logoutTxt}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </SafeAreaView>
  );
}
