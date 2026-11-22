import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getResponsive } from '../theme/responsive';
import { BRAND, HEADER_RADIUS } from '../theme/brand';

// Shown when someone taps "Signup": are you a student or a faculty member?
// Each choice opens its own registration screen.
export default function RoleSelectScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);

  const roles = [
    {
      key: 'student',
      route: 'Register',
      icon: 'school-outline',
      title: 'Student',
      text: 'Enrolled at CvSU. You will need your student number and a photo or PDF of this semester\'s registration form.',
    },
    {
      key: 'faculty',
      route: 'RegisterFaculty',
      icon: 'briefcase-outline',
      title: 'Faculty',
      text: 'Teaching or working at CvSU. You will need your employee ID number and a photo or PDF of your employee ID.',
    },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSub}>Who are you registering as?</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: layout.horizontalPadding, paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {roles.map((role) => (
          <TouchableOpacity
            key={role.key}
            style={[styles.card, { width: layout.contentWidth }]}
            onPress={() => navigation.navigate(role.route)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Register as ${role.title}`}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={role.icon} size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{role.title}</Text>
              <Text style={styles.cardText}>{role.text}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink} hitSlop={8}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginTextBold}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: BRAND.deep, paddingHorizontal: 20, paddingBottom: 24,
    borderBottomLeftRadius: HEADER_RADIUS, borderBottomRightRadius: HEADER_RADIUS, overflow: 'hidden',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#BFD9C2', fontSize: 13, marginTop: 4 },
  content: { alignItems: 'center', paddingTop: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E4E7',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.mint,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 3 },
  loginLink: { marginTop: 10, padding: 8 },
  loginText: { fontSize: 16, color: colors.textSecondary },
  loginTextBold: { color: colors.primary, fontWeight: '700' },
});