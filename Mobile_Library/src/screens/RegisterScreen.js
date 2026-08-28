import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import StepIndicator from '../components/StepIndicator';
import DropdownField from '../components/DropdownField';
import { colleges, programsByCollege, yearLevels } from '../data/options';

const API_URL = 'http://192.168.1.55:5000';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    student_number: '',
    password: '',
    confirmPassword: '',
    college: '',
    program: '',
    year_level: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/settings/current-period`)
      .then((res) => res.json())
      .then((data) => setCurrentPeriod(data.current_period || ''))
      .catch(() => {}); 
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Changing college invalidates whatever program was previously selected,
  // since programs are scoped to a specific college.
  const updateCollege = (college) => {
    setForm((f) => ({ ...f, college, program: '' }));
  };

  const availablePrograms = form.college ? (programsByCollege[form.college] || []) : [];

  const validate = () => {
    if (!form.full_name || !form.email || !form.student_number) {
      Alert.alert('Missing info', 'Please fill in all personal info fields.');
      return false;
    }
    if (form.student_number.length !== 9 || !/^\d{9}$/.test(form.student_number)) {
      Alert.alert('Invalid Student Number', 'Student number must be exactly 9 digits.');
      return false;
    }
    if (!form.password || form.password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and confirm password do not match.');
      return false;
    }
    if (!form.college || !form.program || !form.year_level) {
      Alert.alert('Missing info', 'Please complete all academic info fields.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    try {
      // confirmPassword is only for client-side validation — strip it
      // before sending, since the backend has no use for it.
      const { confirmPassword, ...payload } = form;

      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Registration Submitted',
          'Please wait account verification.',
          [
            {
              text: 'OK',
              onPress: () => {
                setForm({
                  full_name: '',
                  email: '',
                  student_number: '',
                  password: '',
                  confirmPassword: '',
                  college: '',
                  program: '',
                  year_level: '',
                });
                navigation.replace('Login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Registration Error', result.message || 'Submission failed');
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      Alert.alert('Connection Error', 'Check if server is running and on the same Wi-Fi.');
    }
  };

  const handleConfirm = () => {
    if (!validate()) return;
    handleRegister();
  };

  const cancel = () => navigation?.navigate?.('Login');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Student Registration</Text>
        <Text style={styles.headerSub}>Fill in all required fields.</Text>
        {currentPeriod ? (
          <Text style={styles.headerPeriod}>Registering for: {currentPeriod}</Text>
        ) : null}
      </SafeAreaView>

      <View style={{ height: 20 }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1 — PERSONAL INFO */}
          <View style={styles.stepRow}>
            <StepIndicator number={1} active />
            <View style={styles.card}>
              <Text style={styles.stepHeading}>Personal Info</Text>
              <Field
                label="Full Name"
                value={form.full_name}
                onChangeText={(v) => update('full_name', v)}
                placeholder="Enter your full name"
              />
              <Field
                label="CvSU Email Address"
                value={form.email}
                onChangeText={(v) => update('email', v)}
                placeholder="name@cvsu.edu.ph"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Student Number (9)"
                value={form.student_number}
                onChangeText={(v) => update('student_number', v)}
                placeholder="202300001"
                keyboardType="numeric"
                maxLength={9}
              />

              <PasswordField
                label="Password"
                value={form.password}
                onChangeText={(v) => update('password', v)}
                placeholder="At least 8 characters"
                visible={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <PasswordField
                label="Confirm Password"
                value={form.confirmPassword}
                onChangeText={(v) => update('confirmPassword', v)}
                placeholder="Re-enter your password"
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </View>
          </View>

          {/* STEP 2 — ACADEMIC INFO */}
          <View style={styles.stepRow}>
            <StepIndicator number={2} />
            <View style={styles.card}>
              <Text style={styles.stepHeading}>Academic Info</Text>
              <DropdownField
                label="College"
                value={form.college}
                onChange={updateCollege}
                options={colleges}
                placeholder="Select your college"
              />
              <DropdownField
                label="Program"
                value={form.program}
                onChange={(v) => update('program', v)}
                options={availablePrograms}
                placeholder={form.college ? 'Select your program' : 'Select a college first'}
                disabled={!form.college}
              />
              <DropdownField
                label="Year Level"
                value={form.year_level}
                onChange={(v) => update('year_level', v)}
                options={yearLevels}
                placeholder="Select year level"
              />
            </View>
          </View>

          {/* STEP 3 — CONFIRM */}
          <View style={styles.stepRow}>
            <StepIndicator number={3} isLast />
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: 8 }}
          >
            <Text style={{ textAlign: 'center', color: colors.primary, fontWeight: '600', fontSize: 15 }}>
              Already have an account? Back to Login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, ...rest }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.gray}
        {...rest}
      />
    </View>
  );
}

function PasswordField({ label, visible, onToggle, ...rest }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordInputRow}>
        <TextInput
          style={styles.passwordInput}
          placeholderTextColor={colors.gray}
          secureTextEntry={!visible}
          autoCapitalize="none"
          {...rest}
        />
        <TouchableOpacity onPress={onToggle} hitSlop={10}>
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerWrap: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#BFD9C2', fontSize: 13, marginTop: 4 },
  headerPeriod: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 6 },
  scroll: { flex: 1, marginTop: -16 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  stepRow: { flexDirection: 'row', marginBottom: 4 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginLeft: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stepHeading: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },

  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 8,
  },

  confirmActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { backgroundColor: colors.primary },
  confirmText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: colors.grayLight },
  cancelText: { color: colors.textPrimary, fontWeight: '700' },
});