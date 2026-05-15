/**
 * ReflectionPage — full-screen modal for viewing and editing a single
 * reflection. Opens from the "Reflections" collection tab in the Library.
 *
 * Layout:
 *   1. Top bar — back chevron + edit pencil button
 *   2. Date header — serif, large
 *   3. Body — reflection text, scrollable if long, tappable to edit
 *
 * Tapping the body (or the edit button) flips into edit mode: the body
 * becomes a TextInput with Save / Cancel actions. Save calls
 * upsertReflection from the store — same path as DayPanel's inline editor.
 *
 * If the user clears all text and saves, the reflection is deleted (matches
 * DayPanel behaviour) and the page closes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';

// Format the date as "Tuesday, May 12, 2026"
function formatLongDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Short date — fallback if formatLongDate fails (shouldn't, but defensive)
function formatShortDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ReflectionPage({ visible, dateKey, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const p = useMemo(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 4,
  },
  cancelTxt: {
    fontFamily: F.serif,
    fontSize: 14,
    color: C.inkMuted,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: C.ink,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnTxt: {
    fontFamily: F.serif,
    fontSize: 13,
    color: C.white,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Date header
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  kicker: {
    fontFamily: F.sans,
    fontSize: 10,
    fontWeight: '700',
    color: C.amber,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  dateHeader: {
    fontFamily: F.serif,
    fontSize: 30,
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 8,
  },
  metaTxt: {
    fontFamily: F.serif,
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: '500',
  },

  // Body — read mode
  bodyWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  bodyTxt: {
    fontFamily: F.serif,
    fontSize: 16,
    color: C.ink,
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  editHint: {
    fontFamily: F.serif,
    fontSize: 12,
    color: C.inkFaint,
    marginTop: 18,
    fontStyle: 'italic',
  },

  // Body — edit mode
  editor: {
    fontFamily: F.serif,
    fontSize: 16,
    color: C.ink,
    lineHeight: 26,
    letterSpacing: -0.1,
    paddingHorizontal: 24,
    paddingTop: 4,
    minHeight: 200,
  },

  // Empty fallback (defensive)
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTxt: {
    fontFamily: F.serif,
    fontSize: 14,
    color: C.inkMuted,
    textAlign: 'center',
  },
  emptyLink: {
    fontFamily: F.serif,
    fontSize: 13,
    color: C.ink,
    fontWeight: '700',
  },
  }), [themeVersion]);
  const { reflectionForDate, upsertReflection } = useStore();
  const reflection = dateKey ? reflectionForDate(dateKey) : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(reflection?.text || '');

  // Reset state when the page opens or the dateKey changes
  useEffect(() => {
    if (visible) {
      setEditing(false);
      setDraft(reflection?.text || '');
    }
  }, [visible, dateKey, reflection?.id, reflection?.text]);

  const handleSave = () => {
    upsertReflection(dateKey, draft);
    setEditing(false);
    // If the user cleared everything and saved, close the page since the
    // reflection no longer exists
    if (!draft.trim()) {
      onClose?.();
    }
  };

  const handleCancel = () => {
    setDraft(reflection?.text || '');
    setEditing(false);
  };

  // Word and reading time hints — minor but nice meta context
  const wordCount = (reflection?.text || '').trim().split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 220));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={p.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar — back chevron on left, edit pencil on right (read mode only) */}
          <View style={p.topBar}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={p.iconBtn}
            >
              <Ionicons name="chevron-back" size={22} color={C.ink} />
            </TouchableOpacity>

            {editing ? (
              <View style={p.editActions}>
                <TouchableOpacity onPress={handleCancel} activeOpacity={0.6}>
                  <Text style={p.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  activeOpacity={0.85}
                  style={p.saveBtn}
                >
                  <Text style={p.saveBtnTxt}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={p.iconBtn}
              >
                <Ionicons name="create-outline" size={20} color={C.ink} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date header */}
            <View style={p.header}>
              <Text style={p.kicker}>DAILY REFLECTION</Text>
              <Text style={p.dateHeader}>{formatLongDate(dateKey)}</Text>
              {wordCount > 0 && (
                <Text style={p.metaTxt}>
                  {wordCount} {wordCount === 1 ? 'word' : 'words'} · {readMinutes} min read
                </Text>
              )}
            </View>

            {/* Body — read mode (tappable) or edit mode (TextInput) */}
            {editing ? (
              <TextInput
                style={p.editor}
                value={draft}
                onChangeText={setDraft}
                placeholder="What's on your mind today?"
                placeholderTextColor={C.inkFaint}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            ) : reflection?.text ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setEditing(true)}
                style={p.bodyWrap}
              >
                <Text style={p.bodyTxt}>{reflection.text}</Text>
                <Text style={p.editHint}>Tap to edit</Text>
              </TouchableOpacity>
            ) : (
              // Shouldn't normally happen (we open this page from existing
              // reflections only) but defensive for the "deleted then
              // re-opened" case.
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setEditing(true)}
                style={p.emptyWrap}
              >
                <Ionicons name="create-outline" size={28} color={C.inkMuted} />
                <Text style={p.emptyTxt}>No reflection yet for this day.</Text>
                <Text style={p.emptyLink}>Tap to write one</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

