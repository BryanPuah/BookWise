/**
 * SettingsScreen — Appearance + Workspace + Data + About.
 *
 * Reached from ProfileScreen via a "Settings →" row. Keeping these
 * configuration surfaces here, rather than scrolling past them every
 * time the user opens their profile, means the Profile tab can stay
 * focused on the user's identity + workspace stats.
 *
 * Sections:
 *   APPEARANCE — Dark Mode switch, Accent picker, Background picker
 *   WORKSPACE  — Goals & Habits (navigates to GoalsScreen)
 *   DATA       — Export Notes (Markdown via Share sheet)
 *   ABOUT      — Send Feedback (mailto), Version
 */

import React, { useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Share, Linking, Alert,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { SettingRow, SwatchPicker, FontPicker } from '../components/SettingsRows';
import { buildMarkdownExport } from './ProfileScreen';

const APP_VERSION = '1.0.0';
const FEEDBACK_EMAIL = 'feedback@bookwise.app';

export function SettingsScreen({ navigation }) {
  const { user, notes, reflections, books } = useStore();
  const {
    C, F, themeVersion,
    themes, themeName, setAccent,
    backgrounds, backgroundName, setBackground,
    fonts, fontName, setFont,
    mode, setMode,
  } = useTheme();

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    topNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 56,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    screenTitle: {
      fontFamily: F.serif,
      fontSize: 28,
      color: C.ink,
      letterSpacing: -0.4,
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 18,
    },

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
  }), [themeVersion]);

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
      Alert.alert("Couldn't share that", 'Something went wrong opening the share menu — give it another try.');
    }
  };

  const handleSendFeedback = async () => {
    const subject = encodeURIComponent('Bookwise feedback');
    const body = encodeURIComponent(`App version: ${APP_VERSION}\n\n`);
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Email us directly', `Send your feedback to ${FEEDBACK_EMAIL}.`);
      return;
    }
    Linking.openURL(url);
  };

  const handleOpenGoals = () => navigation.navigate('Goals');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={s.topNav}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <Text style={s.screenTitle}>Settings</Text>

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
          <View style={s.divider} />
          <FontPicker
            icon="text-outline"
            label="Font Style"
            entries={Object.entries(fonts)}
            activeKey={fontName}
            onPick={setFont}
          />
        </View>

        <Text style={s.sectionLabel}>WORKSPACE</Text>
        <View style={s.card}>
          <SettingRow
            icon="checkmark-circle-outline"
            label="Goals & Habits"
            rightChevron
            onPress={handleOpenGoals}
          />
        </View>

        <Text style={s.sectionLabel}>DATA</Text>
        <View style={s.card}>
          <SettingRow
            icon="share-outline"
            label="Export Notes (Markdown)"
            rightChevron
            onPress={handleExportNotes}
          />
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}
