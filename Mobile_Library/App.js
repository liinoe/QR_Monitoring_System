import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import SplashScreen from './src/screens/SplashScreen';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// BOTTOM TAB NAVIGATION
function MainTabs() {

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({

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

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },

        tabBarIcon: ({ focused, size }) => {

          const tint = focused
            ? colors.primary
            : '#9AA0A6';

          return (
            <Ionicons
              name="home"
              size={size}
              color={tint}
            />
          );
        },

      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />

    </Tab.Navigator>
  );
}


// =========================
// APP
// =========================
export default function App() {

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);

  }, []);


  // =========================
  // SPLASH SCREEN
  // =========================
  if (isLoading) {
    return <SplashScreen />;
  }


  return (
    <SafeAreaProvider>

      <NavigationContainer>

        <StatusBar style="light" />

        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >

          {/* LOGIN */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          {/* REGISTER */}
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
          />

          {/* HOME AFTER LOGIN */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
          />

        </Stack.Navigator>

      </NavigationContainer>

    </SafeAreaProvider>
  );
}
