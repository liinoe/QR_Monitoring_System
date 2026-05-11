import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SplashScreen from './src/screens/SplashScreen';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // splash duration

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
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
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
            tabBarIcon: ({ focused, size }) => {
              const isHome = route.name === 'Home';
              const name = isHome ? 'home' : 'person-add';

              const tint = isHome
                ? (focused ? colors.primary : '#9AA0A6')
                : (focused ? colors.accent : '#9AA0A6');

              return <Ionicons name={name} size={size} color={tint} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Register" component={RegisterScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}