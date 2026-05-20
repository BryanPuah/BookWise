/**
 * NoteCard — single note row used by every notes view (Explore, BookNotes,
 * TypeNotes, Graph preview overlay) and the book detail screen.
 *
 * The card renders the note's type chips, title, body, optional image
 * thumbnail, tags / linked-note chips, optional book footer, and a
 * "Referenced by" backlink strip derived from `[[Title]]` mentions in
 * other notes.
 *
 * Swipeable left-edge gesture surfaces a Delete action.
 */

import React, { memo, useMemo, useState } from 'react';
import {
  View, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text } from '../../components/AppText';
import { useNotesIndex } from '../../store';
import { MarkdownText } from '../../components/MarkdownText';
import { useTheme } from '../../theme';
import { useNT, typeAccent, timeAgo } from './shared';

function NoteCardImpl({ note, onDelete, onEdit, onStar, showBook = false }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
  // Subscribed to the narrower NotesIndexContext — only re-renders when
  // liveNotes changes, not on every store mutation (toast, goal toggle,
  // day-active mark) like a full useStore() would.
  const { noteById, backlinkIndex } = useNotesIndex();
  // Thumbnails point at file:// URIs that can disappear if the OS evicts the
  // image cache (legacy notes) or the user clears app storage. Track failure
  // per-card so the broken white box is replaced with a placeholder instead.
  const [thumbBroken, setThumbBroken] = useState(false);

  const hasBlocks = Array.isArray(note.blocks) && note.blocks.length > 0;

  // Types row — multi-type if note.types[] exists, otherwise primary type
  const typesList = Array.isArray(note.types) && note.types.length
    ? note.types
    : [note.type || 'insight'];

  const primaryType = typesList[0];
  const isQuote = primaryType === 'quote' || note.isQuote;

  const nc = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: C.white,
      borderRadius: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    body: { padding: 16 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12, gap: 8,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    },
    chipIcon: { fontSize: 10 },
    chipTxt: {
      fontFamily: F.serif, fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
    },
    chipMore: { backgroundColor: C.cream, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    chipMoreTxt: {
      fontFamily: F.serif, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 0.4,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    starBtn: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    date: {
      fontFamily: F.sans, fontSize: 10, color: C.inkFaint,
      fontWeight: '600', letterSpacing: 0.8,
    },

    title: {
      fontFamily: F.serif, fontSize: 15, color: C.ink,
      letterSpacing: -0.3, lineHeight: 22, marginBottom: 6,
    },
    titleQuote: {
      fontFamily: F.serif, fontStyle: 'italic', fontSize: 15,
      color: C.ink, lineHeight: 24, marginBottom: 6,
    },

    thumbnail: {
      width: '100%', height: 160, borderRadius: 10,
      backgroundColor: C.cream, marginTop: 6, marginBottom: 8,
    },
    thumbnailBroken: {
      width: '100%', height: 160, borderRadius: 10,
      backgroundColor: C.cream, marginTop: 6, marginBottom: 8,
      borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    thumbnailBrokenTxt: { fontFamily: F.serif, fontSize: 11, color: C.inkFaint },

    bodyTxt: {
      fontFamily: F.serif, fontSize: 14, color: C.inkSoft, lineHeight: 22,
    },
    bodyTxtQuote: {
      fontFamily: F.serif, fontStyle: 'italic', fontSize: 14,
      color: C.inkSoft, lineHeight: 22,
    },

    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      marginTop: 14, paddingTop: 11,
      borderTopWidth: 0.5, borderTopColor: C.border,
    },
    footerBook: { flex: 1, fontFamily: F.serif, fontSize: 13, color: C.ink, fontWeight: '800', letterSpacing: -0.2 },
    footerMeta: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, fontWeight: '500' },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
    tagChip: {
      backgroundColor: C.sagePale,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    tagChipTxt: { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600' },
    linkChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.amberPale,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    linkChipTxt: { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600' },

    backlinkWrap: {
      marginTop: 12, paddingTop: 10,
      borderTopWidth: 0.5, borderTopColor: C.border,
    },
    backlinkLabel: {
      fontFamily: F.sans, fontSize: 9, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1, marginBottom: 6,
    },
    backlinkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    backlinkChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.cream,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
      borderWidth: 0.5, borderColor: C.border,
    },
    backlinkChipTxt: {
      fontFamily: F.serif, fontSize: 11, color: C.inkSoft, fontWeight: '600',
    },

    deleteAction: { justifyContent: 'center', alignItems: 'flex-end', marginBottom: 14 },
    deleteBtn: {
      backgroundColor: C.rose, borderRadius: 16,
      width: 90, height: '100%',
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    deleteTxt: {
      fontFamily: F.serif, color: '#FFFFFF', fontSize: 12,
      fontWeight: '700', letterSpacing: 0.4,
    },
  }), [themeVersion]);

  // Find first image block (if any) — used to show a thumbnail on the card
  const firstImageBlock = hasBlocks
    ? note.blocks.find(b => b.type === 'image' && b.uri)
    : null;

  // Body — first paragraph block for block-based notes; legacy text otherwise.
  let bodyText = '';
  if (hasBlocks) {
    const firstPara = note.blocks.find(b => b.type === 'paragraph' && b.text?.trim());
    const firstAny  = note.blocks.find(b => b.text?.trim());
    bodyText = (firstPara || firstAny)?.text || '';
  } else {
    bodyText = note.text || '';
  }

  // Title — explicit title field if present, otherwise derive from first line
  // of body. If image-only with no caption, fall back to "Image note".
  const isImageOnly = !bodyText && firstImageBlock;
  const cardTitle = note.title?.trim()
    ? note.title.trim()
    : isImageOnly
      ? 'Image note'
      : bodyText.split('\n')[0].split('. ')[0].slice(0, 80);
  const cardBody = note.title?.trim()
    ? bodyText
    : isImageOnly
      ? ''
      : bodyText.slice(cardTitle.length).replace(/^[\.\s]+/, '');

  const renderRightActions = () => (
    <View style={nc.deleteAction}>
      <TouchableOpacity
        style={nc.deleteBtn}
        onPress={() => onDelete(note.id)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Delete note"
      >
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" importantForAccessibility="no" />
        <Text style={nc.deleteTxt} importantForAccessibility="no">Delete</Text>
      </TouchableOpacity>
    </View>
  );

  // Screen-reader summary — swiping isn't reachable via AT, so we surface
  // delete as an explicit `accessibilityActions` entry that the user can
  // trigger from VoiceOver's actions rotor / TalkBack's local context menu.
  const a11yCardLabel = (() => {
    const head = note.title?.trim() || bodyText.split('\n')[0]?.slice(0, 80) || 'Untitled note';
    const typeLabel = (NT[primaryType] || NT.insight).label;
    const bookSuffix = showBook && note.bookTitle ? `, from ${note.bookTitle}` : '';
    return `${typeLabel} note: ${head}${bookSuffix}`;
  })();

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={nc.card}
        onPress={() => onEdit && onEdit(note)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={a11yCardLabel}
        accessibilityHint="Opens the note. Use the actions rotor to delete."
        accessibilityActions={[{ name: 'delete', label: 'Delete note' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') onDelete(note.id);
        }}
      >
        <View style={nc.body}>
          {/* Header — type chips with icons, right-aligned star + date */}
          <View style={nc.header}>
            <View style={nc.chipsRow}>
              {typesList.slice(0, 2).map(typeKey => {
                const meta = NT[typeKey] || NT.insight;
                const acc = typeAccent(typeKey, C);
                return (
                  <View key={typeKey} style={[nc.chip, { backgroundColor: acc.chipBg }]}>
                    <Text style={nc.chipIcon}>{meta.icon}</Text>
                    <Text style={[nc.chipTxt, { color: acc.chipInk }]}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
              {typesList.length > 2 && (
                <View style={nc.chipMore}>
                  <Text style={nc.chipMoreTxt}>+{typesList.length - 2}</Text>
                </View>
              )}
            </View>
            <View style={nc.headerRight}>
              {onStar ? (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); onStar(note.id); }}
                  style={nc.starBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={note.starred ? 'Unstar note' : 'Star note'}
                  accessibilityState={{ selected: !!note.starred }}
                >
                  <Ionicons
                    name={note.starred ? 'star' : 'star-outline'}
                    size={16}
                    color={note.starred ? C.amber : C.inkFaint}
                    importantForAccessibility="no"
                  />
                </TouchableOpacity>
              ) : null}
              <Text style={nc.date}>{timeAgo(note.date).toUpperCase()}</Text>
            </View>
          </View>

          {cardTitle ? (
            <MarkdownText
              style={isQuote ? nc.titleQuote : nc.title}
              numberOfLines={2}
            >
              {isQuote ? `“${cardTitle}”` : cardTitle}
            </MarkdownText>
          ) : null}

          {firstImageBlock ? (
            thumbBroken ? (
              <View style={nc.thumbnailBroken}>
                <Ionicons name="image-outline" size={22} color={C.inkFaint} />
                <Text style={nc.thumbnailBrokenTxt}>Image unavailable</Text>
              </View>
            ) : (
              <Image
                source={{ uri: firstImageBlock.uri }}
                style={nc.thumbnail}
                resizeMode="cover"
                onError={() => setThumbBroken(true)}
              />
            )
          ) : null}

          {cardBody ? (
            <MarkdownText
              style={isQuote ? nc.bodyTxtQuote : nc.bodyTxt}
              numberOfLines={3}
            >
              {cardBody}
            </MarkdownText>
          ) : null}

          {(() => {
            // Combined chip cap — tags first, then links, max 5 total.
            // Anything past the cap collapses into a single "+N" pill so
            // a note with 12 tags + 8 links doesn't push 20 chips per card.
            const tags = Array.isArray(note.tags) ? note.tags : [];
            const linkIds = Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [];
            const totalCount = tags.length + linkIds.length;
            if (totalCount === 0) return null;
            const MAX = 5;
            const tagsShown = tags.slice(0, MAX);
            const linksBudget = Math.max(0, MAX - tagsShown.length);
            const linksShown = linkIds.slice(0, linksBudget);
            const overflow = totalCount - tagsShown.length - linksShown.length;
            return (
              <View style={nc.metaRow}>
                {tagsShown.map((t, i) => (
                  <View key={`t-${i}`} style={nc.tagChip}>
                    <Text style={nc.tagChipTxt}>#{t}</Text>
                  </View>
                ))}
                {linksShown.map(id => {
                  const linked = noteById.get(id);
                  if (!linked) return null;
                  const label = (linked.title?.trim()
                    || linked.text?.split('\n')[0]?.slice(0, 40)
                    || 'Untitled');
                  return (
                    <TouchableOpacity
                      key={`l-${id}`}
                      style={nc.linkChip}
                      activeOpacity={0.7}
                      onPress={() => onEdit && onEdit(linked)}
                    >
                      <Ionicons name="link" size={10} color={C.ink} />
                      <Text style={nc.linkChipTxt} numberOfLines={1}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
                {overflow > 0 && (
                  <View style={nc.chipMore}>
                    <Text style={nc.chipMoreTxt}>+{overflow}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {showBook && (
            <View style={nc.footer}>
              <Ionicons name="book-outline" size={13} color={C.inkMuted} />
              <Text style={nc.footerBook} numberOfLines={1}>{note.bookTitle}</Text>
              {note.page ? (
                <Text style={nc.footerMeta}>· p.{note.page}</Text>
              ) : null}
              {note.chapter ? (
                <Text style={nc.footerMeta} numberOfLines={1}>· {note.chapter}</Text>
              ) : null}
            </View>
          )}

          {/* Referenced-by backlinks — every note that mentions this one
              via [[Title]] surfaces as a small chip the user can tap to
              jump to the source. Lookup is O(1) against the store's
              memoized `backlinkIndex` (titleLower → Set<noteId>). */}
          {(() => {
            const targetTitle = note.title?.trim().toLowerCase();
            if (!targetTitle) return null;
            const ids = backlinkIndex.get(targetTitle);
            if (!ids || ids.size === 0) return null;
            const backlinks = [];
            for (const id of ids) {
              if (id === note.id) continue;
              const b = noteById.get(id);
              if (b) backlinks.push(b);
            }
            if (backlinks.length === 0) return null;
            return (
              <View style={nc.backlinkWrap}>
                <Text style={nc.backlinkLabel}>REFERENCED BY</Text>
                <View style={nc.backlinkRow}>
                  {backlinks.slice(0, 6).map(b => {
                    const label = b.title?.trim()
                      || b.text?.split('\n')[0]?.slice(0, 40)
                      || 'Untitled';
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={nc.backlinkChip}
                        activeOpacity={0.7}
                        onPress={() => onEdit && onEdit(b)}
                      >
                        <Ionicons name="return-up-back" size={10} color={C.inkSoft} />
                        <Text style={nc.backlinkChipTxt} numberOfLines={1}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {backlinks.length > 6 && (
                    <View style={nc.backlinkChip}>
                      <Text style={nc.backlinkChipTxt}>+{backlinks.length - 6}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// Memo'd so list re-renders (parent re-renders triggered by unrelated state
// changes — toasts, goal toggles, day-active marks) don't re-render every
// visible card. Default shallow prop comparison is enough because every
// prop here is either a stable object (note via memoized liveNotes) or a
// useCallback'd handler from the parent screen.
export const NoteCard = memo(NoteCardImpl);
