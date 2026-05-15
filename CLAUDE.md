# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start         # expo start — Metro bundler + QR
npm run ios       # expo start --ios
npm run android   # expo start --android
```

No test runner, linter, or type checker is configured. To sanity-check syntax on a single file: `node --check <file>`.

## Architecture

Expo SDK 54 / React Native 0.81 / React 19. Single-user reading + notetaking app. No persistence — all state lives in React useState (resets on every reload). No real auth (LoginScreen just stamps a name into the store). This is by design for the current design/refinement phase.

### Navigation (`App.js`)
Root is a `Tab.Navigator` ("MainTabs") with four tabs: Library, Add (Discover), Notes, Profile. Library/Discover/Profile each wrap a `Stack.Navigator`. A floating `CaptureFAB` overlays the tabs and opens `RichNoteEditor` globally. `StreakTracker` calls `markDayActive()` once on mount. Auth gate: if `user.name` is empty, `<LoginScreen />` replaces `<Tabs />`.

### Global store (`src/store.js`)
Single React context (`StoreContext`) holding `books`, `notes`, `goals`, `goalCompletions`, `activeDays`, `reflections`, `user`. All mutations are local `setState` updaters — there is no reducer, no middleware, no async layer.

Domain shapes are not formally typed; `App.js` `handleSave` shows the note shape (id, bookId, blocks[], types[], thinking, tags, linkedNoteIds, isQuote, starred, date). Goals support four recurrence modes: `daily | weekly | monthly | once` — filtering for a date happens in `goalsForDate()`. Streak logic in `currentStreak` allows a one-day grace period (counts from yesterday if today not marked).

### Theming (`src/theme.js`)
Two independent axes — **accent** (`THEMES`) and **background** (`BACKGROUNDS`) — plus light/dark **mode**. `setAccent`, `setBackground`, `setMode` mutate the singleton `C` palette and `covers` objects in place and bump `_themeVersion`.

Components subscribe via `useTheme()` and **must** thread `themeVersion` into the `useMemo` dependency array around their `StyleSheet.create({...})` — this is the only way styles re-create on theme switch:

```js
const { C, F, themeVersion } = useTheme();
const s = useMemo(() => StyleSheet.create({ safe: { backgroundColor: C.paper } }), [themeVersion]);
```

Legacy palette keys (`sage`, `sagePale`, `amber`, `amberPale`, `amberLight`, `heroTop`, `heroBot`) are remapped from the active accent — do not rename call sites to use the accent keys directly; the legacy names are the public API.

### Typography (`src/components/AppText.js`)
DM Serif Display is the reading face. Always import:

```js
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
```

These wrappers apply the serif by default without touching `Text.defaultProps` (React 19 deprecates that). For small chrome/labels/inputs, override with `fontFamily: F.sans`.

### Note editor (`src/components/RichNoteEditor.js` + `src/components/editor/`)
Two-step modal: (1) `BookPicker` selects the book (skipped when `defaultBook` or `initialNote` is passed); (2) `EditorScreen` is the block editor. Block kinds live one-per-file in `editor/blocks/`: Paragraph, Quote, Thought, Heading, Bullet, Image. Helpers (`newBlock`, `blocksToText`) live in `editor/shared.js`.

Saved notes carry both `blocks[]` and a derived `text` (concatenated), plus `types[]` and a primary `type` — this dual shape keeps older list views working. `MarkdownText` renders inline `**bold**`, `*italic*`, `__underline__`, `==highlight==`, and `[[wiki-links]]` (priority order matters — wiki-links match first).

### Notes screen (`src/screens/NotesScreen.js` + `src/screens/notes/`)
Tab strip switches between four views, each in its own file: `ExploreView`, `ByBookView`, `ByTypeView`, `GraphView`. `GraphView` is an Obsidian-style force-directed SVG graph with pan/pinch via `react-native-gesture-handler`. The `+ Add Note` FAB is in `App.js`, not in this screen.

### Performance caveat
Lists render via `ScrollView`, not `FlatList` (except calendar views). Will degrade past ~hundreds of items — relevant when adding bulk-data features.

## Conventions

- Path: deeply-nested working dir name `bookwise2 2` contains a space — quote all paths in shell commands.
- Don't mutate `C` or `covers` directly; use `setAccent` / `setBackground` / `setMode`.
- Don't reintroduce `Text.defaultProps` overrides — use the `AppText` wrappers.
- Dates in store/state are `YYYY-MM-DD` strings (see `todayKey()` in `store.js`). Stay consistent — `goalsForDate`, `isGoalCompletedOn`, reflection lookups all key off this format.
