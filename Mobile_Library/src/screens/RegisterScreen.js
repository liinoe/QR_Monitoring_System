import React, { useState } from 'react';
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
import { colors } from '../theme/colors';
import StepIndicator from '../components/StepIndicator';
import DropdownField from '../components/DropdownField';
import { colleges, programs, yearLevels } from '../data/options';

const STEPS = ['Personal Info', 'Academic Info', 'Review & Submit'];

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState(0);
  
  // State updated to snake_case to match database columns
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    student_number: '',
    college: '',
    program: '',
    year_level: '', // Changed from yearLevel
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.full_name || !form.email || !form.student_number) {
        Alert.alert('Missing info', 'Please fill in all personal info fields.');
        return false;
      }
      // Fixed: Student number must be 9 digits as per research requirements
      if (form.student_number.length !== 9 || !/^\d{9}$/.test(form.student_number)) {
        Alert.alert('Invalid Student Number', 'Student number must be exactly 9 digits.');
        return false;
      }
    }
    if (step === 1) {
      if (!form.college || !form.program || !form.year_level) {
        Alert.alert('Missing info', 'Please complete all academic info fields.');
        return false;
      }
    }
    return true;
  };

  const handleRegister = async () => {
    try {
      // NOTE: Replace 192.168.1.38 with your current IPv4 from 'ipconfig'
      const response = await fetch('http://192.168.1.38:5000/api/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(form), 
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Registration submitted! Please wait for admin approval.', [
          {
            text: 'OK',
            onPress: () => {
              setForm({
                full_name: '',
                email: '',
                student_number: '',
                college: '',
                program: '',
                year_level: '',
              });
              setStep(0);
              navigation?.navigate?.('Home');
            },
          },
        ]);
      } else {
        Alert.alert('Registration Error', result.message || 'Submission failed');
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      Alert.alert('Connection Error', 'Check if server is running and on the same Wi-Fi.');
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleRegister();
  };

  const cancel = () => {
    if (step > 0) setStep(step - 1);
    else navigation?.navigate?.('Home');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Student Registration</Text>
        <Text style={styles.headerSub}>Create your library profile</Text>
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
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.indicatorCol}>
                <StepIndicator steps={STEPS} currentStep={step} />
              </View>

              <View style={styles.formCol}>
                {step === 0 && (
                  <>
                    <Text style={styles.stepHeading}>Personal Information</Text>
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
                      label="Student Number"
                      value={form.student_number}
                      onChangeText={(v) => update('student_number', v)}
                      placeholder="202300001"
                      keyboardType="numeric"
                      maxLength={9}
                    />
                  </>
                )}

                {step === 1 && (
                  <>
                    <Text style={styles.stepHeading}>Academic Information</Text>
                    <DropdownField
                      label="College"
                      value={form.college}
                      onChange={(v) => update('college', v)}
                      options={colleges}
                      placeholder="Select your college"
                    />
                    <DropdownField
                      label="Program"
                      value={form.program}
                      onChange={(v) => update('program', v)}
                      options={programs}
                      placeholder="Select your program"
                    />
                    <DropdownField
                      label="Year Level"
                      value={form.year_level} 
                      onChange={(v) => update('year_level', v)} 
                      options={yearLevels}
                      placeholder="Select year level"
                    />
                  </>
                )}

                {step === 2 && (
                  <>
                    <Text style={styles.stepHeading}>Review & Submit</Text>
                    <ReviewRow label="Full Name" value={form.full_name} />
                    <ReviewRow label="Email" value={form.email} />
                    <ReviewRow label="Student Number" value={form.student_number} />
                    <ReviewRow label="College" value={form.college} />
                    <ReviewRow label="Program" value={form.program} />
                    <ReviewRow label="Year Level" value={form.year_level} />
                  </>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={cancel}>
                <Text style={styles.cancelText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.continueBtn]} onPress={next}>
                <Text style={styles.continueText}>
                  {step === STEPS.length - 1 ? 'Submit' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Components and Styles remain the same as your current file
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

function ReviewRow({ label, value }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#BFD9C2', fontSize: 13, marginTop: 4 },
  scroll: { flex: 1, marginTop: -16 },
  scrollContent: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row' },
  indicatorCol: { width: 130, paddingRight: 8 },
  formCol: { flex: 1, paddingLeft: 8 },
  stepHeading: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  reviewRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.grayLight },
  reviewLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  reviewValue: { fontSize: 14, color: colors.textPrimary, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 12, justifyContent: 'flex-end' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minWidth: 110, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  cancelBtn: { backgroundColor: colors.grayLight },
  cancelText: { color: colors.textPrimary, fontWeight: '700' },
  continueBtn: { backgroundColor: colors.primary },
  continueText: { color: '#fff', fontWeight: '700' },
});