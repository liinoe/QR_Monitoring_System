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
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import StepIndicator from '../components/StepIndicator';
import DropdownField from '../components/DropdownField';
import { colleges, programsByCollege, yearLevels, sexOptions } from '../data/options';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';

const sexLabelToValue = {
  'Male': 'male',
  'Female': 'female',
  'Prefer not to say': 'prefer_not_to_say',
};

export default function RegisterScreen({ navigation, route }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  // Renewal mode is passed explicitly via navigation params (from HomeScreen's
  // "Renew Registration" button) — NOT inferred from whatever happens to be
  // in AsyncStorage, since that could be stale in edge cases (e.g. a
  // student's record got deleted after they last logged in).
  const isRenewal = route?.params?.mode === 'renewal';

  const [form, setForm] = useState({
    surname: '',
    first_name: '',
    middle_name: '',
    email: '',
    phone_number: '',
    address: '',
    sexLabel: '',
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
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [renewalStudent, setRenewalStudent] = useState(null); // display-only, for the renewal confirmation modal

  useEffect(() => {
    fetch(`${API_URL}/api/settings/current-period`)
      .then((res) => res.json())
      .then((data) => setCurrentPeriod(data.current_period || ''))
      .catch(() => {});
  }, []);

  // RENEWAL: load just enough stored info to identify the account and show
  // it for confirmation — never into the (hidden, non-existent-in-this-mode)
  // personal info fields, since those aren't rendered at all in renewal mode.
  useEffect(() => {
    if (!isRenewal) return;
    AsyncStorage.getItem('student')
      .then((stored) => {
        if (!stored) return;
        const student = JSON.parse(stored);
        setRenewalStudent(student);
        setForm((f) => ({
          ...f,
          student_number: student.student_number || '',
          college: student.college || '',
          program: student.program || '',
          year_level: student.year_level || '',
        }));
      })
      .catch(() => {});
  }, [isRenewal]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const updateCollege = (college) => {
    setForm((f) => ({ ...f, college, program: '' }));
  };

  const availablePrograms = form.college ? (programsByCollege[form.college] || []) : [];

  const validatePersonalAndAcademic = () => {
    if (!form.surname || !form.first_name || !form.email || !form.student_number) {
      Alert.alert('Missing info', 'Please fill in all required personal info fields.');
      return false;
    }
    if (form.student_number.length !== 9 || !/^\d{9}$/.test(form.student_number)) {
      Alert.alert('Invalid Student Number', 'Student number must be exactly 9 digits.');
      return false;
    }
    if (!form.phone_number || form.phone_number.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
      return false;
    }
    if (!form.address) {
      Alert.alert('Missing info', 'Please enter your address.');
      return false;
    }
    if (!form.sexLabel) {
      Alert.alert('Missing info', 'Please select your sex.');
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

  const validateRenewalOnly = () => {
    if (!form.college || !form.program || !form.year_level) {
      Alert.alert('Missing info', 'Please complete all academic info fields.');
      return false;
    }
    return true;
  };

  // "Confirm" now opens the review modal instead of submitting directly —
  // actual submission happens from inside the modal.
  const handleReview = () => {
    const valid = isRenewal ? validateRenewalOnly() : validatePersonalAndAcademic();
    if (!valid) return;
    setConfirmModalVisible(true);
  };

  const resetForm = () => {
    setForm({
      surname: '', first_name: '', middle_name: '',
      email: '', phone_number: '', address: '', sexLabel: '',
      student_number: '', password: '', confirmPassword: '',
      college: '', program: '', year_level: '',
    });
  };

  const submitRegistration = async () => {
    try {
      const payload = {
        surname: form.surname,
        first_name: form.first_name,
        middle_name: form.middle_name,
        email: form.email,
        phone_number: form.phone_number,
        address: form.address,
        sex: sexLabelToValue[form.sexLabel],
        student_number: form.student_number,
        password: form.password,
        college: form.college,
        program: form.program,
        year_level: form.year_level,
      };

      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      setConfirmModalVisible(false);

      if (response.ok) {
        Alert.alert('Registration Submitted', result.message || 'Please wait for admin approval.', [
          { text: 'OK', onPress: () => { resetForm(); navigation.replace('Login'); } },
        ]);
      } else {
        Alert.alert('Registration Error', result.message || 'Submission failed');
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setConfirmModalVisible(false);
      Alert.alert('Connection Error', 'Check if server is running and on the same Wi-Fi.');
    }
  };

  const submitRenewal = async () => {
    try {
      const payload = {
        student_number: form.student_number,
        college: form.college,
        program: form.program,
        year_level: form.year_level,
      };

      const response = await fetch(`${API_URL}/api/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      setConfirmModalVisible(false);

      if (response.ok) {
        Alert.alert('Renewal Submitted', result.message || 'Please wait for admin approval.', [
          { text: 'OK', onPress: () => navigation.replace('Login') },
        ]);
      } else {
        Alert.alert('Renewal Error', result.message || 'Submission failed');
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setConfirmModalVisible(false);
      Alert.alert('Connection Error', 'Check if server is running and on the same Wi-Fi.');
    }
  };

  const handleFinalSubmit = () => {
    if (isRenewal) submitRenewal();
    else submitRegistration();
  };

  const cancel = () => navigation?.navigate?.('Login');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>{isRenewal ? 'Renew Registration' : 'Student Registration'}</Text>
        <Text style={styles.headerSub}>
          {isRenewal ? 'Confirm your academic info for this semester.' : 'Fill in all required fields.'}
        </Text>
        {currentPeriod ? (
          <Text style={styles.headerPeriod}>{isRenewal ? 'Renewing for' : 'Registering for'}: {currentPeriod}</Text>
        ) : null}
      </SafeAreaView>

      <View style={{ height: 20 }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* RENEWAL: personal info is completely hidden — credentials
              stay exactly as they are, only academic info is shown. */}
          {isRenewal && renewalStudent && (
            <View style={[styles.renewalBanner, { width: layout.contentWidth }]}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.renewalBannerText}>
                Renewing for {renewalStudent.full_name} ({renewalStudent.student_number})
              </Text>
            </View>
          )}

          {!isRenewal && (
            <View style={[styles.stepRow, { width: layout.contentWidth }]}>
              <StepIndicator number={1} active />
              <View style={styles.card}>
                <Text style={styles.stepHeading}>Personal Info</Text>

                <Field
                  label="Surname"
                  value={form.surname}
                  onChangeText={(v) => update('surname', v)}
                  placeholder="Dela Cruz"
                />
                <Field
                  label="First Name"
                  value={form.first_name}
                  onChangeText={(v) => update('first_name', v)}
                  placeholder="Juan"
                />
                <Field
                  label="Middle Name (optional)"
                  value={form.middle_name}
                  onChangeText={(v) => update('middle_name', v)}
                  placeholder="Santos"
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
                  label="Phone Number"
                  value={form.phone_number}
                  onChangeText={(v) => update('phone_number', v)}
                  placeholder="09XXXXXXXXX"
                  keyboardType="phone-pad"
                />
                <Field
                  label="Address"
                  value={form.address}
                  onChangeText={(v) => update('address', v)}
                  placeholder="Street, Barangay, City/Municipality"
                />
                <DropdownField
                  label="Sex"
                  value={form.sexLabel}
                  onChange={(v) => update('sexLabel', v)}
                  options={sexOptions}
                  placeholder="Select"
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
                {form.password.length > 0 && (
                  <PasswordLengthCheck met={form.password.length >= 8} />
                )}
                <PasswordField
                  label="Confirm Password"
                  value={form.confirmPassword}
                  onChangeText={(v) => update('confirmPassword', v)}
                  placeholder="Re-enter your password"
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                {form.confirmPassword.length > 0 && (
                  <PasswordMatchCheck matches={form.confirmPassword === form.password} />
                )}
              </View>
            </View>
          )}

          {/* ACADEMIC INFO — always shown, the only step in renewal mode */}
          <View style={[styles.stepRow, { width: layout.contentWidth }]}>
            <StepIndicator number={isRenewal ? 1 : 2} active={isRenewal} />
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

          {/* REVIEW */}
          <View style={[styles.stepRow, { width: layout.contentWidth }]}>
            <StepIndicator number={isRenewal ? 2 : 3} isLast />
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={handleReview}>
                <Text style={styles.confirmText}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 8, width: layout.contentWidth }}>
            <Text style={{ textAlign: 'center', color: colors.primary, fontWeight: '600', fontSize: 15 }}>
              Already have an account? Back to Login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CONFIRMATION MODAL — last review before actually submitting */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{isRenewal ? 'Confirm Renewal' : 'Confirm Your Info'}</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {!isRenewal && (
                <>
                  <SummaryRow label="Name" value={`${form.first_name} ${form.middle_name ? form.middle_name + ' ' : ''}${form.surname}`.trim()} />
                  <SummaryRow label="Email" value={form.email} />
                  <SummaryRow label="Phone Number" value={form.phone_number} />
                  <SummaryRow label="Address" value={form.address} />
                  <SummaryRow label="Sex" value={form.sexLabel} />
                  <SummaryRow label="Student Number" value={form.student_number} />
                </>
              )}
              <SummaryRow label="College" value={form.college} />
              <SummaryRow label="Program" value={form.program} />
              <SummaryRow label="Year Level" value={form.year_level} />
              {isRenewal && currentPeriod && <SummaryRow label="Semester" value={currentPeriod} />}
            </ScrollView>

            <Text style={styles.modalNote}>
              {isRenewal
                ? "Your name, email, and password are unchanged — only your academic info above will be updated."
                : "Please double-check your info before submitting."}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, styles.confirmBtn, { flex: 1 }]} onPress={handleFinalSubmit}>
                <Text style={styles.confirmText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn, { flex: 1 }]} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, ...rest }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.gray} {...rest} />
    </View>
  );
}

function PasswordField({ label, visible, onToggle, ...rest }) {
  return (
    <View style={{ marginBottom: 8 }}>
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
          <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Live feedback as the password is typed — checks just the one rule that's
// actually enforced (8+ characters), no extra requirements.
// Exported so ChangePasswordModal.js can reuse the same UI.
export function PasswordLengthCheck({ met }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: 16, marginLeft: 2 }}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={met ? colors.primary : colors.gray}
      />
      <Text style={{ fontSize: 12, color: met ? colors.primary : colors.textSecondary, marginLeft: 6 }}>
        At least 8 characters
      </Text>
    </View>
  );
}

// Live feedback while typing Confirm Password — shows a match/no-match
// indicator instead of only finding out on submit.
// Exported so ChangePasswordModal.js can reuse it too.
export function PasswordMatchCheck({ matches }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: 16, marginLeft: 2 }}>
      <Ionicons
        name={matches ? 'checkmark-circle' : 'close-circle'}
        size={14}
        color={matches ? colors.primary : '#DC2626'}
      />
      <Text style={{ fontSize: 12, color: matches ? colors.primary : '#DC2626', marginLeft: 6 }}>
        {matches ? 'Passwords match' : 'Passwords do not match'}
      </Text>
    </View>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || '—'}</Text>
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

  renewalBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9',
    borderRadius: 14, padding: 14, marginBottom: 16, gap: 8,
  },
  renewalBannerText: { fontSize: 13, color: colors.primaryDark || colors.primary, fontWeight: '600', flex: 1 },

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
  passwordInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 8 },

  confirmActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { backgroundColor: colors.primary },
  confirmText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: colors.grayLight },
  cancelText: { color: colors.textPrimary, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  modalNote: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 17 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.grayLight },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  summaryValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flex: 1.4, textAlign: 'right' },
});