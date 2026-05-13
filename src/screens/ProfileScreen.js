/**
 * ProfileScreen — the user's notetaking workspace at a glance.
 *
 * Layout:
 *   1. Avatar + name + live header subtitle (notes · reflections · streak)
 *   2. STATS — 2×2 grid: Notes, Reflections, Books with notes, Streak
 *   3. ACCOUNT — Email row (taps EditProfileModal)
 *   4. APPEARANCE — Dark Mode switch + Accent + Background swatch pickers
 *   5. WORKSPACE — Goals & Habits (navigates to GoalsScreen),
 *                  Reading Reminders switch (local state)
 *   6. DATA — Export Notes (Markdown via Share sheet)
 *   7. ABOUT — Send Feedback (mailto), Version
 *   8. SUPPORT & LEGAL — Help Center, Privacy Policy
 *   9. Logout (outlined rose)
 *
 * Appearance — tapping an accent or background swatch calls
 * setAccent()/setBackground() from useTheme(); the Dark Mode switch
 * calls setMode() which flips the ink palette and surface tones
 * independently of the user's chosen light-mode background.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Switch, Share, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { EditProfileModal, buildAvatarUrl } from '../components/EditProfileModal';
import { useTheme } from '../theme';

const APP_VERSION = '1.0.0';
const FEEDBACK_EMAIL = 'feedback@bookwise.app';

// Build a Markdown document from the user's notes + reflections. The
// shape is friendly for re-import into Obsidian / Bear / Notion: H3 per
// book, blockquote for `isQuote` notes, italic metadata line per note,
// trailing reflections grouped chronologically. Empty fields are
// skipped to keep the output tight.
function buildMarkdownExport({ notes, reflections, books, user }) {
  const lines = [];
  const today = new Date().toISOString().slice(0, 10);
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

// Generic swatch picker row — collapsible. Tap header to expand grid.
// `variant` controls swatch styling:
//   • 'accent'     — saturated chips with shadow + white check mark
//   • 'background' — paper-tone chips with a thin border (so light
//                    swatches stay visible against the card surface)
function SwatchPicker({ icon, label, entries, activeKey, onPick, variant = 'accent' }) {
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
            shadowColor: '#000',
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
      fontFamily: F.serif,
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
    themes, themeName, setAccent,
    backgrounds, backgroundName, setBackground,
    mode, setMode,
  } = useTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [reminders, setReminders] = useState(true);

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

  // Build the export string lazily — only on tap — so we don't churn
  // through every note on every render of the profile screen.
  const handleExportNotes = async () => {
    if (!notes.length && !reflections.length) {
      Alert.alert(
        'Nothing to export yet',
        'Capture a note or write a reflection first — then come back here to share your library.',
      );
      return;
    }
    try {
      const message = buildMarkdownExport({ notes, reflections, books, user });
      await Share.share({
        message,
        title: 'Bookwise — Notes Export',
      });
    } catch (e) {
      Alert.alert('Export failed', 'Could not open the share sheet. Try again.');
    }
  };

  const handleSendFeedback = async () => {
    const subject = encodeURIComponent('Bookwise feedback');
    const body = encodeURIComponent(`App version: ${APP_VERSION}\n\n`);
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(
        'No mail app',
        `Send feedback to ${FEEDBACK_EMAIL}.`,
      );
      return;
    }
    Linking.openURL(url);
  };

  const handleOpenGoals = () => {
    // Profile lives in a sibling tab to LibraryStack — hop through the
    // Library tab to reach the Goals screen nested in that stack.
    navigation.navigate('Library', { screen: 'Goals' });
  };

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
            value={user.email || 'Add email'}
            rightChevron
            onPress={() => setEditOpen(true)}
          />
        </View>

        {/* APPEARANCE — dark mode + accent + background */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.card}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            switchValue={mode === 'dark'}
            onSwitchChange={(v) => setMode(v ? 'dark' : 'light')}
          />
          <View style={s.divider} />
          <SwatchPicker
            icon="color-palette-outline"
            label="Accent Color"
            entries={Object.entries(themes)}
            activeKey={themeName}
            onPick={setAccent}
            variant="accent"
          />
          <View style={s.divider} />
          <SwatchPicker
            icon="contrast-outline"
            label="Background"
            entries={Object.entries(backgrounds)}
            activeKey={backgroundName}
            onPick={setBackground}
            variant="background"
          />
        </View>

        {/* WORKSPACE — entry to goals/habits (data the store already tracks) */}
        <Text style={s.sectionLabel}>WORKSPACE</Text>
        <View style={s.card}>
          <SettingRow
            icon="checkmark-circle-outline"
            label="Goals & Habits"
            rightChevron
            onPress={handleOpenGoals}
          />
          <View style={s.divider} />
          <SettingRow
            icon="notifications-outline"
            label="Reading Reminders"
            switchValue={reminders}
            onSwitchChange={setReminders}
          />
        </View>

        {/* DATA — export keeps the user's notes portable */}
        <Text style={s.sectionLabel}>DATA</Text>
        <View style={s.card}>
          <SettingRow
            icon="share-outline"
            label="Export Notes (Markdown)"
            rightChevron
            onPress={handleExportNotes}
          />
        </View>

        {/* ABOUT */}
        <Text style={s.sectionLabel}>ABOUT</Text>
        <View style={s.card}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Send Feedback"
            rightChevron
            onPress={handleSendFeedback}
          />
          <View style={s.divider} />
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            value={APP_VERSION}
          />
        </View>

        {/* SUPPORT & LEGAL */}
        <Text style={s.sectionLabel}>SUPPORT & LEGAL</Text>
        <View style={s.card}>
          <SettingRow
            icon="help-circle-outline"
            label="Help Center"
            rightChevron
            onPress={() => Alert.alert('Help Center', 'Coming soon.')}
          />
          <View style={s.divider} />
          <SettingRow
            icon="shield-outline"
            label="Privacy Policy"
            rightChevron
            onPress={() => Alert.alert('Privacy Policy', 'Coming soon.')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={logout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={C.rose} />
          <Text style={s.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </SafeAreaView>
  );
}
