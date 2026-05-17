import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, AppState,
} from 'react-native';
import { AppText as Text } from './src/components/AppText';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useFonts,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import { StoreProvider, useStore } from './src/store';
import { HomeScreen }          from './src/screens/HomeScreen';
import { FinishedBooksScreen } from './src/screens/FinishedBooksScreen';
import { BookDetailScreen }    from './src/screens/BookDetailScreen';
import { NotesScreen }         from './src/screens/NotesScreen';
import { DiscoverScreen }      from './src/screens/DiscoverScreen';
import { GoalsScreen }         from './src/screens/GoalsScreen';
import { ProfileScreen }       from './src/screens/ProfileScreen';
import { SettingsScreen }      from './src/screens/SettingsScreen';
import { LoginScreen }         from './src/screens/LoginScreen';
import { ConfirmNameScreen }   from './src/screens/onboarding/ConfirmNameScreen';
import { RichNoteEditor }      from './src/components/RichNoteEditor';
import { useTheme, F } from './src/theme';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function LibraryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibraryHome"   component={HomeScreen} />
      <Stack.Screen name="BookDetail"    component={BookDetailScreen} />
      <Stack.Screen name="FinishedBooks" component={FinishedBooksScreen} />
      <Stack.Screen name="Goals"         component={GoalsScreen} />
    </Stack.Navigator>
  );
}

function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverHome" component={DiscoverScreen} />
      <Stack.Screen name="BookDetail"   component={BookDetailScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Settings"    component={SettingsScreen} />
      <Stack.Screen name="Goals"       component={GoalsScreen} />
    </Stack.Navigator>
  );
}

// ── Tab item — icon + label, sage pill behind both when active ────────
function TabItem({ name, nameActive, label, active }) {
  const { C, themeVersion } = useTheme();
  const ti = useMemo(() => StyleSheet.create({
    item: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 3,
    },
    itemActive: {
      backgroundColor: C.sagePale,
    },
    label: {
      fontFamily: F.sans,
      fontSize: 10,
      color: C.inkMuted,
      fontWeight: '500',
    },
    labelActive: {
      color: C.ink,
      fontWeight: '600',
    },
  }), [themeVersion]);

  const iconName  = active ? nameActive : name;
  const iconColor = active ? C.ink : C.inkMuted;

  return (
    <View
      style={[ti.item, active && ti.itemActive]}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <Ionicons name={iconName} size={20} color={iconColor} importantForAccessibility="no" />
      <Text style={[ti.label, active && ti.labelActive]} importantForAccessibility="no">{label}</Text>
    </View>
  );
}

// ── ToastHost ─────────────────────────────────────────────────────────
// Renders the most recent toast above the tab bar. Toast queue lives in
// the store; this component is a pure consumer so any screen can fire one
// via `showToast({ message, action })` without prop-drilling.
function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const { C, themeVersion } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16, right: 86, // leave room for the FAB at the right
      alignItems: 'center',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.ink,
      borderRadius: 12,
      paddingLeft: 16, paddingRight: 6,
      paddingVertical: 6,
      minHeight: 44,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 10,
      maxWidth: 420,
    },
    msg: {
      flex: 1,
      color: '#FFFFFF',
      fontFamily: F.serif,
      fontSize: 13,
      letterSpacing: -0.1,
      paddingRight: 10,
    },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    actionTxt: {
      color: '#FFFFFF',
      fontFamily: F.serif,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  }), [themeVersion]);

  if (toasts.length === 0) return null;
  const t = toasts[toasts.length - 1];
  return (
    <View
      style={[s.wrap, { bottom: 86 + insets.bottom + 8 }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <View style={s.toast} pointerEvents="auto" accessibilityRole="alert">
        <Text style={s.msg} numberOfLines={2}>{t.message}</Text>
        {t.action ? (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => { t.action.onPress?.(); dismissToast(t.id); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.action.label}
          >
            <Text style={s.actionTxt}>{t.action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ── Floating "+" FAB ──────────────────────────────────────────────────
// Tab bar is 78 tall + paddingBottom 14, but iOS adds the home-indicator
// inset on top of that. We clear the tab bar (≈ 78) and lift further by the
// device's bottom inset so the FAB never overlaps the indicator.
function CaptureFAB({ onPress }) {
  const { C, themeVersion } = useTheme();
  const insets = useSafeAreaInsets();
  const fab = useMemo(() => StyleSheet.create({
    btn: {
      position: 'absolute',
      right: 20,
      bottom: 86 + insets.bottom,
      width: 56, height: 56,
      borderRadius: 14, // rounded-square per Figma
      backgroundColor: C.sage,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 10,
    },
  }), [themeVersion, insets.bottom]);

  return (
    <TouchableOpacity
      style={fab.btn}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="New note"
      accessibilityHint="Opens the note editor"
    >
      <Ionicons name="add" size={28} color="#FFFFFF" importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

// ── Tab navigator ──────────────────────────────────────────────────────
function Tabs() {
  const { books, addNote, user, currentBook, hydrated } = useStore();
  const { C } = useTheme();
  const [showCapture, setShowCapture] = useState(false);

  // Hydration gate — wait for AsyncStorage to populate state before deciding
  // whether to show the login screen. Without this, a returning user gets a
  // flash of LoginScreen for the ~50-200ms between mount and hydration.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator size="small" color={C.ink} />
      </View>
    );
  }

  // Auth + onboarding gate. Three states:
  //   no name              → LoginScreen (fresh install or post-logout)
  //   name, !hasOnboarded  → ConfirmNameScreen (correct the email-derived guess)
  //   else                 → tabs
  if (!user.name) {
    return <LoginScreen />;
  }
  if (!user.hasOnboarded) {
    return <ConfirmNameScreen />;
  }

  const handleSave = (data) => { addNote(data); };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        id="MainTabs"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: C.white,
            borderTopWidth: 0.5,
            borderTopColor: C.border,
            height: 78,
            paddingBottom: 14,
            paddingTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 16,
          },
          tabBarShowLabel: false, // our TabItem handles its own label
        }}
      >
        <Tab.Screen
          name="Library"
          component={LibraryStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="newspaper-outline" nameActive="newspaper" label="Library" active={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Add"
          component={DiscoverStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="search-outline" nameActive="search" label="Add" active={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="reader-outline" nameActive="reader" label="Notes" active={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="person-outline" nameActive="person" label="Profile" active={focused} />
            ),
          }}
        />
      </Tab.Navigator>

      <CaptureFAB onPress={() => setShowCapture(true)} />
      <ToastHost />

      <RichNoteEditor
        visible={showCapture}
        books={books}
        initialNote={null}
        defaultBook={currentBook}
        onSave={(data) => { handleSave(data); setShowCapture(false); }}
        onClose={() => setShowCapture(false)}
      />
    </View>
  );
}

// ── StreakTracker ──────────────────────────────────────────────────────
// Lives inside StoreProvider so it can call markDayActive from the store.
// Marks today as an active day on:
//   • hydration complete (every cold launch, once saved data has loaded)
//   • app foreground (AppState 'active') — catches day rollover while the
//     device was locked or the app was backgrounded
//   • scheduled tick at the next local midnight — catches the foregrounded
//     past-midnight case (long reading session, app left open)
//
// Gated on `hydrated` — running before hydration would race the loaded
// activeDays slice and clobber it with `[today]` only.
function StreakTracker() {
  const { markDayActive, hydrated } = useStore();
  useEffect(() => {
    if (!hydrated) return;
    markDayActive();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') markDayActive();
    });

    // Schedule a tick just after the next local midnight, then re-schedule
    // itself. setTimeout is fine here — the OS pauses timers in background,
    // but the AppState listener above catches resume.
    let timer;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const next = new Date(
        now.getFullYear(), now.getMonth(), now.getDate() + 1,
        0, 0, 5, // 5s past midnight so the new date key is unambiguous
      );
      timer = setTimeout(() => {
        markDayActive();
        scheduleNextMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleNextMidnight();

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [hydrated]);
  return null;
}

// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
  const { C } = useTheme();
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator size="small" color={C.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StreakTracker />
          <NavigationContainer>
            <Tabs />
          </NavigationContainer>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}