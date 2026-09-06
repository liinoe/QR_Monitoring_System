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
  ScrollView,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const API_URL = 'http://192.168.1.53:5000';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your school email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json(); 
      console.log('LOGIN RESPONSE:', response.status, data);

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        {/* PHOTO HEADER */}
        <View style={styles.hero}>
          <View style={styles.imagePlaceholder} />
          <View style={styles.heroOverlay} />
          <SafeAreaView edges={['top']} />
        </View>

        {/* CARD */}
        <ScrollView 
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="name@cvsu.edu.ph"
            placeholderTextColor={colors.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />

          <View style={{ height: 20 }} />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.passwordRow, passwordFocused && styles.inputFocused]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.gray}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Logo badge */}
      <View pointerEvents="none" style={styles.logoBadgeWrapper}>
        <View style={styles.logoBadge}>
          <Ionicons name="library-outline" size={26} color={colors.primary} />
        </View>
      </View>
    </View>
  );
}

const HERO_HEIGHT = 280;
const CARD_OVERLAP = 36; 
const BADGE_SIZE = 60;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  hero: { height: HERO_HEIGHT, backgroundColor: '#16382399' },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#16382399' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6, 31, 17, 0.5)' },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: -CARD_OVERLAP,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  cardContent:{
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    flexGrow: 1,
  },

  logoBadgeWrapper: {
    position: 'absolute',
    top: HERO_HEIGHT - CARD_OVERLAP - BADGE_SIZE / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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

  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

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