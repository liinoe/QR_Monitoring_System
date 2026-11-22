import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import StepIndicator from '../components/StepIndicator';
import DropdownField from '../components/DropdownField';
import { colleges, sexOptions } from '../data/options';
import { API_URL } from '../config';
import { authHeaders } from '../utils/studentAuth';
import { getResponsive } from '../theme/responsive';
import { useAppDialog } from '../components/AppDialog';
import { getRejectionGuide } from '../utils/rejection';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';
import CorUploadField from '../components/CorUploadField';
// The fields, live checks and styles are shared with the student RegisterScreen,
// so both screens look and behave the same.
import {
  styles,
  sexLabelToValue,
  CVSU_EMAIL_REGEX,
  NAME_RULE_MESSAGE,
  isValidName,
  getEmailFeedback,
  normalizePhoneDigits,
  useAvailabilityCheck,
  isStrongPassword,
  Field,
  PhoneNumberField,
  LiveCheck,
  EmailCheck,
  PasswordField,
  PasswordRulesCheck,
  PasswordMatchCheck,
  SummaryRow,
} from './RegisterScreen';

// Employee ID: numbers only, 1 to 9 digits, no leading zero.
// Keep the same as EMPLOYEE_ID_REGEX in the backend (index.js).
const EMPLOYEE_ID_REGEX = /^[1-9]\d{0,8}$/;
const EMPLOYEE_ID_RULE = 'Employee ID must be numbers only (up to 9 digits, no leading zero).';
const PROOF_HINT =
  'A clear photo or PDF (2 MB max) of your CvSU employee ID, showing your name and ID number. ' +
  'Library staff use it to verify you, and it is deleted after review.';

// Faculty registration. Same flow as students (personal info, account, email code),
// but the "Academic Info" step is replaced by "Employment Info":
// Employee ID, college and a photo/PDF of the employee ID.
// Faculty never renew (an admin deactivates accounts), so this screen only does a new
// registration and resubmitting a rejected one (mode: 'resubmit').
export default function RegisterFacultyScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const isResubmit = route?.params?.mode === 'resubmit';

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [idProof, setIdProof] = useState(null); // { uri, base64 } of the employee ID. Required.
  // RESUBMIT: the Employee ID the account has now, and whether it may be corrected (server decides).
  const [originalEmployeeId, setOriginalEmployeeId] = useState('');
  const [canChangeId, setCanChangeId] = useState(false);

  const [form, setForm] = useState({
    surname: '', first_name: '', middle_name: '',
    email: '', phone_number: '', address: '', sexLabel: '',
    employee_id: '', password: '', confirmPassword: '',
    college: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(isResubmit);
  // Email verification (new registrations only), same as the student screen.
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const submittingRef = useRef(false);
  const { dialog, showDialog } = useAppDialog();

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Scrolling back up to a field (for the "Edit ..." buttons in pop-ups).
  const scrollRef = useRef(null);
  const idRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const personalRowY = useRef(0);
  const phoneFieldY = useRef(0);
  const employmentRowY = useRef(0);
  const idFieldY = useRef(0);
  const accountRowY = useRef(0);
  const emailFieldY = useRef(0);
  const focusField = (cardY, fieldY, inputRef) => {
    const y = cardY.current + fieldY.current - 16;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    setTimeout(() => inputRef.current?.focus(), 350);
  };
  const focusEmployeeId = () => focusField(employmentRowY, idFieldY, idRef);
  const focusEmail = () => focusField(accountRowY, emailFieldY, emailRef);
  const focusPhone = () => focusField(personalRowY, phoneFieldY, phoneRef);

  // RESUBMIT: fills the form with the saved details so they only fix what was wrong.
  useEffect(() => {
    if (!isResubmit) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('student');
        if (!stored) return;
        const { employee_id } = JSON.parse(stored);
        const res = await fetch(`${API_URL}/api/faculty/profile/${employee_id}`, { headers: await authHeaders() });
        if (!res.ok) throw new Error();
        const p = await res.json();
        const sexLabel = Object.keys(sexLabelToValue).find((label) => sexLabelToValue[label] === p.sex) || '';
        setForm((f) => ({
          ...f,
          surname: p.surname || '',
          first_name: p.first_name || '',
          middle_name: p.middle_name || '',
          email: p.email || '',
          phone_number: /^\+639\d{9}$/.test(p.phone_number || '')
            ? p.phone_number
            : p.phone_number ? `+63${normalizePhoneDigits(p.phone_number)}` : '',
          address: p.address || '',
          sexLabel,
          employee_id: p.employee_id || employee_id,
          college: p.college || '',
        }));
        setRejectionReason(p.status_reason || '');
        setOriginalEmployeeId(p.employee_id || employee_id);
        setCanChangeId(!!p.can_change_employee_id);
      } catch {
        showDialog({ tone: 'error', title: "Couldn't Load Your Details", message: 'Check your connection and try again.' });
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [isResubmit]);

  // Live checks (same server routes as students; user_type=faculty makes the ID check use the Employee ID rule).
  const idChanged = isResubmit && canChangeId && form.employee_id !== originalEmployeeId;
  const idCheck = useAvailabilityCheck(
    EMPLOYEE_ID_REGEX.test(form.employee_id) && (!isResubmit || idChanged)
      ? `${API_URL}/api/faculty/register/check-employee-id/${form.employee_id}${idChanged ? '?for_change=1' : ''}`
      : null
  );
  const ownId = isResubmit ? (originalEmployeeId || form.employee_id) : form.employee_id;
  const emailCheck = useAvailabilityCheck(
    CVSU_EMAIL_REGEX.test(form.email.trim())
      ? `${API_URL}/api/faculty/register/check-email/${encodeURIComponent(form.email.trim().toLowerCase())}?employee_id=${ownId}`
      : null
  );
  const phoneCheck = useAvailabilityCheck(
    /^\+639\d{9}$/.test(form.phone_number)
      ? `${API_URL}/api/faculty/register/check-phone/${encodeURIComponent(form.phone_number)}?employee_id=${ownId}`
      : null
  );

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const emailFeedback = getEmailFeedback(form.email);
  const phoneNumberIsValid = /^\+639\d{9}$/.test(form.phone_number);

  const goLogin = () => navigation.replace('Login');

  // Checks every field for a new registration / resubmission. Shows a pop-up for the first problem.
  const validateAll = () => {
    if (!form.surname.trim() || !form.first_name.trim()) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please enter your surname and first name.' });
      return false;
    }
    if (![form.surname, form.first_name, form.middle_name].every(isValidName)) {
      showDialog({ tone: 'error', title: 'Invalid Name', message: `Please check your name. ${NAME_RULE_MESSAGE}` });
      return false;
    }
    if (!phoneNumberIsValid) {
      showDialog({ tone: 'error', title: 'Invalid Phone Number', message: 'Please enter all 10 digits after +63.' });
      return false;
    }
    if (phoneCheck.state === 'taken') {
      showDialog({ tone: 'warning', title: 'Phone Number In Use', message: phoneCheck.message, buttons: [{ text: 'Edit Phone', style: 'primary', onPress: focusPhone }] });
      return false;
    }
    if (!form.address.trim()) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please enter your address.' });
      return false;
    }
    if (!form.sexLabel) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please select your sex.' });
      return false;
    }
    if (!EMPLOYEE_ID_REGEX.test(form.employee_id)) {
      showDialog({ tone: 'error', title: 'Invalid Employee ID', message: EMPLOYEE_ID_RULE });
      return false;
    }
    if (idCheck.state === 'taken') {
      if (idCheck.reason === 'registered') {
        showDialog({
          tone: 'warning',
          title: 'Already Registered',
          message: 'This employee ID already has an account. Log in instead?',
          buttons: [
            { text: 'Edit ID', style: 'secondary', onPress: focusEmployeeId },
            { text: 'Go to Login', style: 'primary', onPress: goLogin },
          ],
        });
      } else {
        showDialog({ tone: 'error', title: 'Employee ID Unavailable', message: idCheck.message });
      }
      return false;
    }
    if (!form.college) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please select your college.' });
      return false;
    }
    if (!idProof) {
      showDialog({ tone: 'warning', title: 'Proof of Employee ID Required', message: 'Please upload a photo or PDF of your employee ID.' });
      return false;
    }
    if (!CVSU_EMAIL_REGEX.test(form.email.trim())) {
      showDialog({ tone: 'error', title: 'Invalid Email', message: 'Please use your CvSU email ending in @cvsu.edu.ph.' });
      return false;
    }
    if (emailCheck.state === 'taken') {
      showDialog(
        emailCheck.reason === 'registered'
          ? {
              tone: 'warning',
              title: 'Email Already Registered',
              message: 'This CvSU email already has an account. Log in instead?',
              buttons: [
                { text: 'Edit Email', style: 'secondary', onPress: focusEmail },
                { text: 'Go to Login', style: 'primary', onPress: goLogin },
              ],
            }
          : { tone: 'error', title: 'Email Unavailable', message: emailCheck.message, buttons: [{ text: 'Edit Email', style: 'primary', onPress: focusEmail }] }
      );
      return false;
    }
    if (isResubmit) return true; // already logged in: no password step
    if (!isStrongPassword(form.password)) {
      showDialog({ tone: 'error', title: 'Weak Password', message: 'Password needs at least 8 characters, an uppercase letter, a lowercase letter, and a number.' });
      return false;
    }
    if (form.password !== form.confirmPassword) {
      showDialog({ tone: 'error', title: 'Password Mismatch', message: 'Password and confirm password do not match.' });
      return false;
    }
    return true;
  };

  const handleReview = () => {
    if (!validateAll()) return;
    if (!isResubmit && !agreedToPrivacy) {
      showDialog({ tone: 'error', title: 'Privacy Notice', message: 'Please read and agree to the Privacy Notice and Terms of Use first.' });
      return;
    }
    setConfirmModalVisible(true);
  };

  const resetForm = () => {
    setAgreedToPrivacy(false);
    setIdProof(null);
    setForm({
      surname: '', first_name: '', middle_name: '',
      email: '', phone_number: '', address: '', sexLabel: '',
      employee_id: '', password: '', confirmPassword: '', college: '',
    });
  };

  const closeReview = () => {
    setConfirmModalVisible(false);
    setOtpStep(false);
    setOtpCode('');
    setOtpError('');
  };

  // Closes the review pop-up first, then shows the message (iPhone can't open two pop-ups at once).
  const showAfterReview = (options) => {
    closeReview();
    setTimeout(() => showDialog(options), 400);
  };

  // Emails a 6-digit code, then shows the code screen.
  const requestOtp = async () => {
    setOtpBusy(true);
    setOtpError('');
    try {
      const response = await fetch(`${API_URL}/api/faculty/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), employee_id: form.employee_id }),
      });
      const result = await response.json();
      if (response.ok) {
        setOtpStep(true);
        setOtpCode('');
        setResendIn(result.retry_after_seconds || 60);
      } else if (response.status === 429 && result.rate_limited) {
        if (otpStep) setOtpError(result.message);
        else showAfterReview({ tone: 'error', title: 'Too Many Requests', message: result.message });
      } else if (response.status === 429) {
        setOtpStep(true);
        setResendIn(result.retry_after_seconds || 60);
        if (otpStep) setOtpError(result.message);
      } else if (otpStep) {
        setOtpError(result.message || 'Could not send the code.');
      } else {
        showAfterReview({ tone: 'error', title: 'Verification Error', message: result.message || 'Could not send the code.' });
      }
    } catch (error) {
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Could not reach the server. Please try again.' });
    }
    setOtpBusy(false);
  };

  // Sends a NEW faculty registration (with the email code), then goes to Login.
  const submitRegistration = async () => {
    try {
      const payload = {
        surname: form.surname.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number,
        address: form.address.trim(),
        sex: sexLabelToValue[form.sexLabel],
        employee_id: form.employee_id,
        password: form.password,
        college: form.college,
        otp: otpCode,
        privacy_consent: agreedToPrivacy,
        proof_image: idProof?.base64, // proof of employee ID (deleted after staff review)
      };
      setOtpBusy(true);
      const response = await fetch(`${API_URL}/api/faculty/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setOtpBusy(false);

      if (!response.ok && result.otp_error) {
        setOtpError(result.message);
        return;
      }
      setConfirmModalVisible(false);

      if (response.ok) {
        showAfterReview({
          tone: 'success',
          title: 'Registration Submitted',
          message: result.message || 'Please wait for admin approval.',
          buttons: [{ text: 'Go to Login', style: 'primary', onPress: () => { resetForm(); goLogin(); } }],
        });
      } else if (response.status === 400 && /already exists/i.test(result.message || '')) {
        showAfterReview({
          tone: 'warning',
          title: 'Already Registered',
          message: result.message,
          buttons: [
            { text: 'Edit ID', style: 'secondary', onPress: focusEmployeeId },
            { text: 'Go to Login', style: 'primary', onPress: goLogin },
          ],
        });
      } else {
        showAfterReview({ tone: 'error', title: 'Registration Error', message: result.message || 'Submission failed' });
      }
    } catch (error) {
      console.error('Fetch Error:', error);
      setOtpBusy(false);
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Check if server is running and on the same Wi-Fi.' });
    }
  };

  // Resubmits a REJECTED faculty registration (PUT) with the login pass.
  const submitResubmit = async () => {
    try {
      const payload = {
        surname: form.surname.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number,
        address: form.address.trim(),
        sex: sexLabelToValue[form.sexLabel],
        college: form.college,
        proof_image: idProof?.base64,
        ...(idChanged ? { new_employee_id: form.employee_id } : {}),
      };
      const token = await AsyncStorage.getItem('student_token');
      const response = await fetch(`${API_URL}/api/faculty/registration/${originalEmployeeId || form.employee_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (response.ok) {
        if (result.token && result.employee_id) {
          const stored = JSON.parse((await AsyncStorage.getItem('student')) || '{}');
          await AsyncStorage.setItem('student_token', result.token);
          await AsyncStorage.setItem('student', JSON.stringify({ ...stored, employee_id: result.employee_id }));
          await AsyncStorage.removeItem('cached_profile');
          setOriginalEmployeeId(result.employee_id);
        }
        showAfterReview({
          tone: 'success',
          title: 'Registration Resubmitted',
          message: result.message || 'Please wait for admin approval.',
          buttons: [{ text: 'Back to Home', style: 'primary', onPress: () => navigation.navigate('HomeScreen') }],
        });
      } else if (response.status === 401 || response.status === 403) {
        showAfterReview({
          tone: 'warning',
          title: 'Please Log In Again',
          message: 'For your security, please log in again, then resubmit. Your details will be filled in for you.',
          buttons: [{
            text: 'Go to Login',
            style: 'primary',
            onPress: async () => {
              await AsyncStorage.multiRemove(['student', 'student_token']);
              navigation.replace('Login');
            },
          }],
        });
      } else {
        showAfterReview({ tone: 'error', title: 'Resubmission Failed', message: result.message || 'Please try again.' });
      }
    } catch (error) {
      console.error('Fetch Error:', error);
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Check if server is running and on the same Wi-Fi.' });
    }
  };

  // "Submit" in the review pop-up.
  const handleFinalSubmit = async () => {
    if (!isResubmit) {
      requestOtp();
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setOtpBusy(true);
    try {
      await submitResubmit();
    } finally {
      submittingRef.current = false;
      setOtpBusy(false);
    }
  };

  const cancel = () => {
    if (isResubmit && navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Login');
  };

  const guide = getRejectionGuide(rejectionReason, null, 'faculty');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>
          {isResubmit ? 'Resubmit Registration' : 'Faculty Registration'}
        </Text>
        <Text style={styles.headerSub}>
          {isResubmit
            ? 'Your details are filled in. Fix what was wrong, then submit again.'
            : 'Fields marked with * are required.'}
        </Text>
      </SafeAreaView>

      <View style={{ height: 20 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: layout.horizontalPadding, alignItems: 'center', paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {isResubmit && (
            <View style={[styles.rejectBanner, { width: layout.contentWidth }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectBannerTitle}>Why your registration was rejected</Text>
                <Text style={styles.rejectBannerText}>{loadingProfile ? 'Loading…' : guide.message}</Text>
                {!loadingProfile && !!rejectionReason && guide.kind !== 'other' && (
                  <Text style={styles.rejectBannerReason}>Reason: {rejectionReason}</Text>
                )}
                {!loadingProfile && guide.noEditsNeeded && (
                  <Text style={styles.rejectBannerHint}>Just review your details below and tap Continue.</Text>
                )}
              </View>
            </View>
          )}

          {/* STEP 1 — PERSONAL INFO (new registration / resubmit) */}
                      <View style={[styles.stepRow, { width: layout.contentWidth }]} onLayout={(e) => { personalRowY.current = e.nativeEvent.layout.y; }}>
              <StepIndicator number={1} active />
              <View style={styles.card}>
                <Text style={styles.stepHeading}>Personal Info</Text>
                <Field label="Surname" required value={form.surname} onChangeText={(v) => update('surname', v)} placeholder="Dela Cruz"
                  invalid={!isValidName(form.surname)} style={!isValidName(form.surname) && { marginBottom: 4 }} />
                {!isValidName(form.surname) && <Text style={styles.nameHint}>{NAME_RULE_MESSAGE}</Text>}
                <Field label="First Name" required value={form.first_name} onChangeText={(v) => update('first_name', v)} placeholder="Juan"
                  invalid={!isValidName(form.first_name)} style={!isValidName(form.first_name) && { marginBottom: 4 }} />
                {!isValidName(form.first_name) && <Text style={styles.nameHint}>{NAME_RULE_MESSAGE}</Text>}
                <Field label="Middle Name (optional)" value={form.middle_name} onChangeText={(v) => update('middle_name', v)} placeholder="Santos"
                  invalid={!isValidName(form.middle_name)} style={!isValidName(form.middle_name) && { marginBottom: 4 }} />
                {!isValidName(form.middle_name) && <Text style={styles.nameHint}>{NAME_RULE_MESSAGE}</Text>}
                <View onLayout={(e) => { phoneFieldY.current = e.nativeEvent.layout.y; }}>
                  <PhoneNumberField
                    ref={phoneRef}
                    value={form.phone_number}
                    onChange={(v) => update('phone_number', v)}
                    taken={phoneCheck.state === 'taken'}
                    hasMessage={phoneCheck.state !== 'idle'}
                  />
                  <LiveCheck check={phoneCheck} />
                </View>
                <Field label="Address" required value={form.address} onChangeText={(v) => update('address', v)} placeholder="Street, Barangay, City/Municipality" />
                <DropdownField label="Sex" required value={form.sexLabel} onChange={(v) => update('sexLabel', v)} options={sexOptions} placeholder="Select" />
              </View>
            </View>
          

          {/* STEP 2 — EMPLOYMENT INFO */}
          <View style={[styles.stepRow, { width: layout.contentWidth }]} onLayout={(e) => { employmentRowY.current = e.nativeEvent.layout.y; }}>
            <StepIndicator number={2} />
            <View style={styles.card}>
              <Text style={styles.stepHeading}>Employment Info</Text>
                                            <View onLayout={(e) => { idFieldY.current = e.nativeEvent.layout.y; }}>
                  <Field
                    ref={idRef}
                    selectTextOnFocus
                    editable={!isResubmit || canChangeId}
                    label={isResubmit && !canChangeId ? 'Employee ID (can’t be changed)' : 'Employee ID'}
                    required
                    value={form.employee_id}
                    onChangeText={(v) => update('employee_id', v.replace(/\D/g, ''))}
                    placeholder="12345"
                    keyboardType="numeric"
                    maxLength={9}
                    invalid={idCheck.state === 'taken' || (form.employee_id.length > 0 && !EMPLOYEE_ID_REGEX.test(form.employee_id))}
                    style={idCheck.state !== 'idle' || form.employee_id.length > 0 ? { marginBottom: 6 } : undefined}
                  />
                  {form.employee_id.length > 0 && !EMPLOYEE_ID_REGEX.test(form.employee_id)
                    ? <Text style={[styles.nameHint, { marginBottom: 16 }]}>{EMPLOYEE_ID_RULE}</Text>
                    : <LiveCheck check={idCheck} />}
                  {isResubmit && canChangeId && (
                    <Text style={styles.fieldHint}>
                      Typed the wrong number before? You can correct it here. It must match your employee ID.
                    </Text>
                  )}
                </View>
              
              <DropdownField
                label="College"
                required
                value={form.college}
                onChange={(v) => update('college', v)}
                options={colleges}
                placeholder="Select your college"
              />
              <CorUploadField
                value={idProof}
                onChange={setIdProof}
                onError={(message) => showDialog({ tone: 'error', title: 'Proof of Employee ID', message })}
                label="Proof of Employee ID"
                noun="employee ID"
                hint={PROOF_HINT}
              />
            </View>
          </View>

          {/* STEP 3 — ACCOUNT (the password part is skipped when resubmitting) */}
                      <View style={[styles.stepRow, { width: layout.contentWidth }]} onLayout={(e) => { accountRowY.current = e.nativeEvent.layout.y; }}>
              <StepIndicator number={3} />
              <View style={styles.card}>
                <Text style={styles.stepHeading}>Account</Text>
                <View onLayout={(e) => { emailFieldY.current = e.nativeEvent.layout.y; }}>
                  <Field
                    ref={emailRef}
                    label="CvSU Email Address"
                    required
                    value={form.email}
                    onChangeText={(v) => update('email', v)}
                    placeholder="name@cvsu.edu.ph"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={emailFeedback.state === 'error' || emailCheck.state === 'taken'}
                    style={{ marginBottom: 6 }}
                  />
                  {emailFeedback.state === 'ok' ? <LiveCheck check={emailCheck} /> : <EmailCheck feedback={emailFeedback} />}
                </View>
                {isResubmit ? (
                  <Text style={styles.fieldHint}>Your password stays the same.</Text>
                ) : (
                  <>
                    <PasswordField
                      label="Password"
                      required
                      value={form.password}
                      onChangeText={(v) => update('password', v)}
                      placeholder="8+ characters, A–Z, a–z, 0–9"
                      visible={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                    {form.password.length > 0 && <PasswordRulesCheck password={form.password} />}
                    <PasswordField
                      label="Confirm Password"
                      required
                      value={form.confirmPassword}
                      onChangeText={(v) => update('confirmPassword', v)}
                      placeholder="Re-enter your password"
                      visible={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                    {form.confirmPassword.length > 0 && <PasswordMatchCheck matches={form.confirmPassword === form.password} />}
                  </>
                )}
              </View>
            </View>
          

          {/* LAST STEP — REVIEW */}
          <View style={[styles.stepRow, { width: layout.contentWidth }]}>
            <StepIndicator number={4} isLast />
            <View style={{ flex: 1 }}>
              {!isResubmit && (
                <View style={styles.consentRow}>
                  <TouchableOpacity
                    onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
                    style={[styles.checkbox, agreedToPrivacy && styles.checkboxOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agreedToPrivacy }}
                    hitSlop={8}
                  >
                    {agreedToPrivacy && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <Text style={styles.consentText}>
                    <Text onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}>I have read and agree to the </Text>
                    <Text style={styles.consentLink} onPress={() => setPrivacyOpen(true)}>Privacy Notice and Terms of Use</Text>
                    <Text>.</Text>
                  </Text>
                </View>
              )}
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn, (!phoneNumberIsValid || (!isResubmit && !agreedToPrivacy)) && styles.disabledBtn]}
                  onPress={handleReview}
                  disabled={!phoneNumberIsValid || (!isResubmit && !agreedToPrivacy)}
                >
                  <Text style={styles.confirmText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={cancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PrivacyNoticeModal visible={privacyOpen} onClose={() => setPrivacyOpen(false)} userType="faculty" />

      {/* REVIEW POP-UP — last check before submitting */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => (otpStep ? setOtpStep(false) : closeReview())}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalBackdrop, { paddingBottom: 20 + insets.bottom }]}>
          {otpStep ? (
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.otpText}>
                Enter the 6-digit code we sent to{'\n'}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{form.email.trim().toLowerCase()}</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.otpInput, otpError ? styles.inputInvalid : null]}
                value={otpCode}
                onChangeText={(t) => { setOtpCode(t.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor="#B8C2BA"
                autoFocus
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
              />
              {!!otpError && <Text style={styles.otpError}>{otpError}</Text>}

              <TouchableOpacity
                style={[styles.btn, otpCode.length === 6 && !otpBusy ? styles.confirmBtn : styles.disabledBtn, { marginTop: 16 }]}
                disabled={otpCode.length !== 6 || otpBusy}
                onPress={submitRegistration}
              >
                {otpBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Verify & Submit</Text>}
              </TouchableOpacity>

              <View style={styles.otpLinks}>
                <TouchableOpacity onPress={() => { setOtpStep(false); setOtpError(''); }}>
                  <Text style={styles.otpLink}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={resendIn > 0 || otpBusy} onPress={requestOtp}>
                  <Text style={[styles.otpLink, (resendIn > 0 || otpBusy) && { color: colors.textSecondary }]}>
                    {resendIn > 0 ? `New code available in ${resendIn}s` : 'Send a new code'}
                  </Text>
                </TouchableOpacity>
              </View>
              {resendIn > 0 ? (
                <Text style={styles.modalNote}>The code may take up to a minute to arrive. It expires in 10 minutes.</Text>
              ) : (
                <View style={styles.otpHelpBox}>
                  <Text style={styles.otpHelpText}>
                    <Text style={{ fontWeight: '700' }}>Didn't get the code?</Text> Check your Spam or Promotions folder,
                    or make sure your CvSU email is spelled correctly.
                  </Text>
                  <TouchableOpacity onPress={() => { closeReview(); setTimeout(focusEmail, 400); }} style={styles.otpEditEmail} hitSlop={8}>
                    <Text style={styles.otpLink}>Edit email</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>
                {isResubmit ? 'Confirm Resubmission' : 'Confirm Your Info'}
              </Text>
              <ScrollView style={{ maxHeight: 340 }}>
                                  <>
                    <SummaryRow label="Name" value={`${form.first_name} ${form.middle_name ? form.middle_name + ' ' : ''}${form.surname}`.trim()} />
                    <SummaryRow label="Phone Number" value={form.phone_number} />
                    <SummaryRow label="Address" value={form.address} />
                    <SummaryRow label="Sex" value={form.sexLabel} />
                    <SummaryRow label="Employee ID" value={form.employee_id} />
                  </>
                
                <SummaryRow label="College" value={form.college} />
                <SummaryRow label="Proof of Employee ID" value={idProof ? 'Attached' : 'Missing'} />
                <SummaryRow label="CvSU Email" value={form.email.trim().toLowerCase()} />
              </ScrollView>

              <Text style={styles.modalNote}>
                Please double-check your info before submitting.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.btn, otpBusy ? styles.disabledBtn : styles.confirmBtn, { flex: 1 }]}
                  disabled={otpBusy}
                  onPress={handleFinalSubmit}
                >
                  {otpBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Submit</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn, { flex: 1 }]} onPress={closeReview}>
                  <Text style={styles.cancelText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {!isResubmit && (
                <Text style={styles.modalNote}>After you tap Submit, we'll email a code to your CvSU email to verify it.</Text>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {dialog}
    </View>
  );
}