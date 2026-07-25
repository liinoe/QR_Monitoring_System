import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your school email');
      return;
    }

    try {
      setLoading(true);

      // Standardized connection endpoint matching the Register and Home setups
      const response = await fetch('http://192.168.1.54:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Login Failed', data.message);
        return;
      }

      await AsyncStorage.setItem('student', JSON.stringify(data.student));
      navigation.replace('HomeScreen');

    } catch (error) {
      console.error("Network Error:", error);
      Alert.alert('Connection Error', 'Ensure phone and laptop are on the same Wi-Fi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* PHOTO HEADER */}
        <View style={styles.hero}>
          <View style={styles.imagePlaceholder} />
          <View style={styles.heroOverlay} />
          <SafeAreaView edges={['top']} />
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <View style={styles.logoBadge}>
            <Ionicons name="library-outline" size={26} color={colors.primary} />
          </View>

          <Text style={styles.title}>eDiwa</Text>
          <Text style={styles.subtitle}>Library App</Text>

          {/* TAB SWITCHER */}
          <View style={styles.tabRow}>
            <View style={styles.tabItemActive}>
              <Text style={styles.tabTextActive}>Login</Text>
              <View style={styles.tabUnderline} />
            </View>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.tabText}>Signup</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 8 }} />

          <Text style={styles.fieldLabel}>E-mail Address</Text>
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            placeholder="name@cvsu.edu.ph"
            placeholderTextColor={colors.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />

          <View style={{ height: 28 }} />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const HERO_HEIGHT = 280;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  hero: { height: HERO_HEIGHT, backgroundColor: '#16382399' },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#16382399' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6, 31, 17, 0.5)' },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -36,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 40,
    alignItems: 'center',
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 20 },

  tabRow: { flexDirection: 'row', gap: 28, marginBottom: 28, width: '100%', justifyContent: 'center' },
  tabItem: { paddingBottom: 8 },
  tabItemActive: { alignItems: 'center', paddingBottom: 4 },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  tabUnderline: { width: 40, height: 2.5, backgroundColor: colors.primary, borderRadius: 2 },

  fieldLabel: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    width: '100%',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputFocused: { borderBottomColor: colors.primary },

  button: {
    width: '100%',
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
});