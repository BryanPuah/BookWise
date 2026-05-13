import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
    <View style={[ti.item, active && ti.itemActive]}>
      <Ionicons name={iconName} size={20} color={iconColor} />
      <Text style={[ti.label, active && ti.labelActive]}>{label}</Text>
    </View>
  );
}

// ── Floating "+" FAB ──────────────────────────────────────────────────
function CaptureFAB({ onPress }) {
  const { C, themeVersion } = useTheme();
  const fab = useMemo(() => StyleSheet.create({
    btn: {
      position: 'absolute',
      right: 20,
      bottom: 96, // sits above the tab bar
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
  }), [themeVersion]);

  return (
    <TouchableOpacity
      style={fab.btn}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={28} color={C.white} />
    </TouchableOpacity>
  );
}

// ── Tab navigator ──────────────────────────────────────────────────────
function Tabs() {
  const { books, addNote, user, currentBook } = useStore();
  const { C } = useTheme();
  const [showCapture, setShowCapture] = useState(false);

  // Auth gate — if there's no user identity yet (fresh install or after
  // logout), show the LoginScreen instead of the main app.
  if (!user.name) {
    return <LoginScreen />;
  }

  const handleSave = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId:    data.bookId,
      bookTitle: data.bookTitle,
      title:     data.title || '',
      blocks:    data.blocks || [],
      types:     data.types || [data.type || 'insight'],
      type:      data.type,
      text:      data.text,
      thinking:  data.thinking || '',
      page:      data.page || '',
      chapter:   data.chapter || '',
      isQuote:   data.type === 'quote',
      starred:   false,
      date:      new Date().toISOString().slice(0, 10),
    });
  };

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
// Marks today as an active day on every app launch — this drives the
// "🔥 streak" counter shown on the home screen.
//
// NOTE: until persistent storage is wired up, activeDays resets each
// reload. The streak you see in development reflects the demo seed in
// store.js plus today.
function StreakTracker() {
  const { markDayActive } = useStore();
  useEffect(() => {
    markDayActive();
  }, []); // run once on mount
  return null;
}

// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
  const { C } = useTheme();
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  });

  // Apply DMSerifDisplay as the default font for every <Text> and <TextInput>
  // in the app. Components that set their own fontFamily still win.
  //
  // TO REVERT: delete this useEffect block. The font fallback will return to
  // the system default (San Francisco on iOS, Roboto on Android).
  useEffect(() => {
    if (!fontsLoaded) return;
    const familyStyle = { fontFamily: 'DMSerifDisplay_400Regular' };
    // Text.defaultProps may be undefined on first mount; initialise then merge
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [familyStyle, Text.defaultProps.style];
    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [familyStyle, TextInput.defaultProps.style];
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator size="small" color={C.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <StreakTracker />
        <NavigationContainer>
          <Tabs />
        </NavigationContainer>
      </StoreProvider>
    </GestureHandlerRootView>
  );
}