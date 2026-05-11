import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
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
import { ReviewScreen }        from './src/screens/ReviewScreen';
import { DiscoverScreen }      from './src/screens/DiscoverScreen';
import { RichNoteEditor }      from './src/components/RichNoteEditor';
import { C } from './src/theme';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function LibraryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibraryHome"   component={HomeScreen} />
      <Stack.Screen name="BookDetail"    component={BookDetailScreen} />
      <Stack.Screen name="FinishedBooks" component={FinishedBooksScreen} />
      <Stack.Screen name="Profile"       component={ReviewScreen} />
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

// ── Tab item — icon + label, sage pill behind both when active ────────
function TabItem({ name, nameActive, label, active }) {
  const iconName  = active ? nameActive : name;
  const iconColor = active ? C.ink : C.inkMuted;

  return (
    <View style={[ti.item, active && ti.itemActive]}>
      <Ionicons name={iconName} size={20} color={iconColor} />
      <Text style={[ti.label, active && ti.labelActive]}>{label}</Text>
    </View>
  );
}

const ti = StyleSheet.create({
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
    fontSize: 10,
    color: C.inkMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: C.ink,
    fontWeight: '600',
  },
});

// ── Floating "+" FAB ──────────────────────────────────────────────────
function CaptureFAB({ onPress }) {
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

const fab = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 20,
    bottom: 96, // sits above the tab bar
    width: 56, height: 56,
    borderRadius: 14, // rounded-square per Figma
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
});

// ── Tab navigator ──────────────────────────────────────────────────────
function Tabs() {
  const { books, addNote } = useStore();
  const [showCapture, setShowCapture] = useState(false);

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
          name="Discover"
          component={DiscoverStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabItem name="search-outline" nameActive="search" label="Explore" active={focused} />
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
          component={ReviewScreen}
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
        onSave={(data) => { handleSave(data); setShowCapture(false); }}
        onClose={() => setShowCapture(false)}
      />
    </View>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
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
      <StoreProvider>
        <NavigationContainer>
          <Tabs />
        </NavigationContainer>
      </StoreProvider>
    </GestureHandlerRootView>
  );
}