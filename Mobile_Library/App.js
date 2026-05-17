import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreenComponent from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// BOTTOM TAB NAVIGATION
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 0,
          elevation: 10,
          backgroundColor: '#fff',
          marginBottom: 35,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreenComponent}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="home" size={24} color={focused ? colors.primary : '#9AA0A6'} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// SIMPLE FLAT STACK NAVIGATOR
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          {/* Auth Screens */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          
          {/* Main Dashboard - Named HomeScreen to satisfy the payload call */}
          <Stack.Screen name="HomeScreen" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}