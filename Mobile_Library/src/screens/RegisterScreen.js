import React, { useState, useEffect, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { colleges, programsByCollege, yearLevels, sexOptions } from '../data/options';
import { API_URL } from '../config';
import { authHeaders } from '../utils/studentAuth';
import { getResponsive } from '../theme/responsive';
import { BRAND, HEADER_RADIUS } from '../theme/brand';
import { useAppDialog } from '../components/AppDialog';
import { getRejectionGuide } from '../utils/rejection';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';

// Maps what the student picks ("Male") to what the database stores ("male").
const sexLabelToValue = {
  'Male': 'male',
  'Female': 'female',
  'Prefer not to say': 'prefer_not_to_say',
};

// Only CvSU school emails are accepted, e.g. juan.delacruz@cvsu.edu.ph
const CVSU_EMAIL_REGEX = /^[^\s@]+@cvsu\.edu\.ph$/i;

// Veterinary Medicine is a 6-year program, so it gets a "6th Year" option.
const VETMED_COLLEGE = 'College of Veterinary Medicine and Biomedical Sciences';

// Returns the year levels allowed for the chosen college.
function yearLevelsFor(college) {
  return college === VETMED_COLLEGE ? [...yearLevels, '6th Year'] : yearLevels;
}

// Checks the email as the student types and returns the message to show under the field.
function getEmailFeedback(email) {
  const value = email.trim();
  if (!value) return { state: 'hint', text: 'Use your CvSU email (name@cvsu.edu.ph)' };
  if (/\s/.test(value)) return { state: 'error', text: 'Email cannot contain spaces' };
  if (!value.includes('@')) return { state: 'error', text: 'Missing "@" — it should end with @cvsu.edu.ph' };
  if (!CVSU_EMAIL_REGEX.test(value)) return { state: 'error', text: 'Must be a CvSU email ending in @cvsu.edu.ph' };
  return { state: 'ok', text: 'Valid CvSU email' };
}

// Password rules. Each has a label (shown to the student) and a test.
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter (a–z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number (0–9)', test: (pw) => /\d/.test(pw) },
];

// True only if the password passes every rule above.
export function isStrongPassword(pw) {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}

// Names: letters only (including ñ and accented letters), plus spaces, hyphens,
// apostrophes and periods — e.g. "Dela Cruz", "O'Neil", "Ma. Clara". No numbers or symbols.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;
const NAME_RULE_MESSAGE = 'Letters only. Spaces, hyphens (-), apostrophes (\') and periods (.) are allowed.';
// True if the name is empty (checked separately) or follows the rule above.
const isValidName = (value) => !value.trim() || NAME_REGEX.test(value.trim());

// Cleans what the student types in the phone box and keeps only the 10
// digits after +63 (accepts "09...", "63..." or "9...").
function normalizePhoneDigits(value) {
  const digits = value.replace(/\D/g, '');
  const localDigits = digits.startsWith('09')
    ? digits.slice(1)
    : digits.startsWith('63')
      ? digits.slice(2)
      : digits;
  return localDigits.slice(0, 10);
}

// Shows the saved "+639123456789" as "912 345 6789" in the input box.
function formatPhoneDigits(phoneNumber) {
  const digits = phoneNumber.replace(/^\+63/, '').slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
    .filter(Boolean)
    .join(' ');
}

// Live "is this already used?" check. Give it a server URL (or null to stay quiet).
// Waits 0.5s after the student stops typing, then asks the server.
// Returns { state, message, reason } where state is
// 'idle' | 'checking' | 'available' | 'taken' | 'unknown'.
function useAvailabilityCheck(url) {
  const [check, setCheck] = useState({ state: 'idle', message: '', reason: null });

  useEffect(() => {
    if (!url) {
      setCheck({ state: 'idle', message: '', reason: null });
      return;
    }
    setCheck({ state: 'checking', message: 'Checking…', reason: null });
    let cancelled = false; // ignore old answers if the student keeps typing
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok && res.status !== 400) throw new Error();
        setCheck({ state: data.available ? 'available' : 'taken', message: data.message, reason: data.reason || null });
      } catch {
        // Server unreachable: don't block the student; the server re-checks on submit.
        if (!cancelled) setCheck({ state: 'unknown', message: "Couldn't check right now — we'll verify when you submit.", reason: null });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url]);

  return check;
}

export default function RegisterScreen({ navigation, route }) {
  // Height of the phone's bottom navigation bar, so nothing hides behind it.
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  // Renewal mode comes from the Home screen's "Renew Registration" button.
  const isRenewal = route?.params?.mode === 'renewal';
  // Resubmit mode comes from the Home screen's "Register Again" button (rejected accounts).
  const isResubmit = route?.params?.mode === 'resubmit';
  // Privacy Notice: has the student ticked "I agree", and is the notice pop-up open?
  // (Renewal doesn't ask again — no new personal details are collected.)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

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
  const [renewalStudent, setRenewalStudent] = useState(null); // shown in the renewal banner only
  const [rejectionReason, setRejectionReason] = useState(''); // shown at the top in resubmit mode
  const [loadingProfile, setLoadingProfile] = useState(isResubmit);
  // Email verification (new registrations only): after "Submit", the review pop-up
  // switches to a code screen. The registration is sent only with the right code.
  const [otpStep, setOtpStep] = useState(false);      // true = showing the code screen
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);      // sending a code or submitting
  const [resendIn, setResendIn] = useState(0);        // seconds until "Resend code" works
  // Styled pop-up used instead of the phone's plain alert (see components/AppDialog.js).
  const { dialog, showDialog } = useAppDialog();

  // Counts the "Resend code" timer down by 1 every second.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Used by "Edit Number" to scroll back up to the Student Number field.
  const scrollRef = useRef(null);
  const studentNumberRef = useRef(null);
  const academicRowY = useRef(0);   // where the Academic Info card starts in the scroll area
  const studentFieldY = useRef(0);  // where the Student Number field sits inside that card
  const phoneRef = useRef(null);
  const personalRowY = useRef(0);   // where the Personal Info card starts
  const phoneFieldY = useRef(0);    // where the Phone field sits inside that card
  const emailRef = useRef(null);
  const accountRowY = useRef(0);    // where the Account card starts
  const emailFieldY = useRef(0);    // where the Email field sits inside that card

  // Scrolls up to a field (card position + field position), then puts the cursor in it.
  const focusField = (cardY, fieldY, inputRef) => {
    const y = cardY.current + fieldY.current - 16;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    setTimeout(() => inputRef.current?.focus(), 350); // after the scroll finishes
  };

  // "Edit Number": jump back to the Student Number field.
  const focusStudentNumber = () => focusField(academicRowY, studentFieldY, studentNumberRef);
  // "Edit Email": jump back to the CvSU Email field.
  const focusEmail = () => focusField(accountRowY, emailFieldY, emailRef);
  // "Edit Phone": jump back to the Phone Number field.
  const focusPhone = () => focusField(personalRowY, phoneFieldY, phoneRef);


  // Loads the active semester so the header can say what they're registering for.
  useEffect(() => {
    fetch(`${API_URL}/api/settings/current-period`)
      .then((res) => res.json())
      .then((data) => setCurrentPeriod(data.current_period || ''))
      .catch(() => {});
  }, []);

  // RENEWAL: loads the saved student so we know whose account to renew.
  // Personal info and account fields aren't shown in this mode.
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

  // RESUBMIT: fills the whole form with the student's saved details (from the
  // server), so they only fix what was wrong. Also loads the rejection reason.
  useEffect(() => {
    if (!isResubmit) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('student');
        if (!stored) return;
        const { student_number } = JSON.parse(stored);
        const res = await fetch(`${API_URL}/api/student/profile/${student_number}`, { headers: await authHeaders() });
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
          student_number: p.student_number || student_number,
          college: p.college || '',
          program: p.program || '',
          year_level: p.year_level || '',
        }));
        setRejectionReason(p.status_reason || '');
      } catch {
        showDialog({ tone: 'error', title: "Couldn't Load Your Details", message: 'Check your connection and try again.' });
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [isResubmit]);

  // Live check: is this student number already registered? (runs once all 9 digits are typed)
  const numberCheck = useAvailabilityCheck(
    !isRenewal && !isResubmit && form.student_number.length === 9
      ? `${API_URL}/api/register/check-student-number/${form.student_number}`
      : null
  );

  // Live check: is this CvSU email already registered? (runs once the format is correct)
  const emailCheck = useAvailabilityCheck(
    !isRenewal && CVSU_EMAIL_REGEX.test(form.email.trim())
      ? `${API_URL}/api/register/check-email/${encodeURIComponent(form.email.trim().toLowerCase())}?student_number=${form.student_number}`
      : null
  );

  // Live check: is this phone number already used by another account? (runs once complete)
  // The student number is sent too, so a student re-registering after a rejection
  // isn't blocked by their own old record.
  const phoneCheck = useAvailabilityCheck(
    !isRenewal && /^\+639\d{9}$/.test(form.phone_number)
      ? `${API_URL}/api/register/check-phone/${encodeURIComponent(form.phone_number)}?student_number=${form.student_number}`
      : null
  );

  // Updates one field in the form.
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Changing college clears the program (programs depend on the college) and
  // clears "6th Year" if the new college doesn't have it.
  const updateCollege = (college) => {
    setForm((f) => ({
      ...f,
      college,
      program: '',
      year_level: yearLevelsFor(college).includes(f.year_level) ? f.year_level : '',
    }));
  };

  const availablePrograms = form.college ? (programsByCollege[form.college] || []) : [];
  const availableYearLevels = yearLevelsFor(form.college);
  const emailFeedback = getEmailFeedback(form.email);

  // Checks every field for a new registration. Shows an alert for the first
  // problem found and returns false; returns true if everything is valid.
  const validatePersonalAndAcademic = () => {
    // Step 1: Personal info
    if (!form.surname.trim() || !form.first_name.trim()) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please enter your surname and first name.' });
      return false;
    }
    if (![form.surname, form.first_name, form.middle_name].every(isValidName)) {
      showDialog({ tone: 'error', title: 'Invalid Name', message: `Please check your name. ${NAME_RULE_MESSAGE}` });
      return false;
    }
    if (!/^\+639\d{9}$/.test(form.phone_number)) {
      showDialog({ tone: 'error', title: 'Invalid Phone Number', message: 'Please enter all 10 digits after +63.' });
      return false;
    }
    if (phoneCheck.state === 'taken') {
      showDialog({
        tone: 'warning',
        title: 'Phone Number In Use',
        message: phoneCheck.message,
        buttons: [{ text: 'Edit Phone', style: 'primary', onPress: focusPhone }],
      });
      return false;
    }
    if (!form.address) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please enter your address.' });
      return false;
    }
    if (!form.sexLabel) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please select your sex.' });
      return false;
    }
    // Step 2: Academic info
    if (!/^\d{9}$/.test(form.student_number)) {
      showDialog({ tone: 'error', title: 'Invalid Student Number', message: 'Student number must be exactly 9 digits.' });
      return false;
    }
    if (numberCheck.state === 'taken') {
      if (numberCheck.reason === 'registered') {
        // They probably already have an account — offer Login, but let them fix a typo instead.
        showDialog({
          tone: 'warning',
          title: 'Already Registered',
          message: 'This student number already has an account. Log in instead?',
          buttons: [
            { text: 'Edit Number', style: 'secondary', onPress: focusStudentNumber },
            { text: 'Go to Login', style: 'primary', onPress: () => navigation.replace('Login') },
          ],
        });
      } else {
        showDialog({ tone: 'error', title: 'Student Number Unavailable', message: numberCheck.message });
      }
      return false;
    }
    if (!form.college || !form.program || !form.year_level) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please complete all academic info fields.' });
      return false;
    }
    // Step 3: Account
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
                { text: 'Go to Login', style: 'primary', onPress: () => navigation.replace('Login') },
              ],
            }
          : { tone: 'error', title: 'Email Unavailable', message: emailCheck.message, buttons: [{ text: 'Edit Email', style: 'primary', onPress: focusEmail }] }
      );
      return false;
    }
    // Resubmit: they're already logged in, so no password is needed here.
    if (isResubmit) return true;
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

  // Renewal only needs the academic fields.
  const validateRenewalOnly = () => {
    if (!form.college || !form.program || !form.year_level) {
      showDialog({ tone: 'warning', title: 'Missing info', message: 'Please complete all academic info fields.' });
      return false;
    }
    return true;
  };

  // "Continue" button: validates, then opens the review pop-up (not submitted yet).
  const handleReview = () => {
    const valid = isRenewal ? validateRenewalOnly() : validatePersonalAndAcademic();
    if (!valid) return;
    if (!isRenewal && !agreedToPrivacy) {
      showDialog({ tone: 'error', title: 'Privacy Notice', message: 'Please read and agree to the Privacy Notice and Terms of Use first.' });
      return;
    }
    setConfirmModalVisible(true);
  };

  const phoneNumberIsValid = /^\+639\d{9}$/.test(form.phone_number);

  // Clears the whole form after a successful registration.
  const resetForm = () => {
    setAgreedToPrivacy(false);
    setForm({
      surname: '', first_name: '', middle_name: '',
      email: '', phone_number: '', address: '', sexLabel: '',
      student_number: '', password: '', confirmPassword: '',
      college: '', program: '', year_level: '',
    });
  };

  // Closes the review pop-up first, then shows the message. (On iPhone, two
  // full-screen pop-ups can't open at the same moment.)
  const showAfterReview = (options) => {
    closeReview();
    setTimeout(() => showDialog(options), 400);
  };

  // Closes the review pop-up and clears the code screen.
  const closeReview = () => {
    setConfirmModalVisible(false);
    setOtpStep(false);
    setOtpCode('');
    setOtpError('');
  };

  // Asks the server to email a 6-digit code, then shows the code screen.
  const requestOtp = async () => {
    setOtpBusy(true);
    setOtpError('');
    try {
      const response = await fetch(`${API_URL}/api/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), student_number: form.student_number }),
      });
      const result = await response.json();
      if (response.ok) {
        setOtpStep(true);
        setOtpCode('');
        setResendIn(result.retry_after_seconds || 60);
      } else if (response.status === 429) {
        // A code was sent less than a minute ago — it still works, so just show the code screen.
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

  // Sends a NEW registration to the server, then goes back to Login.
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
        student_number: form.student_number,
        password: form.password,
        college: form.college,
        program: form.program,
        year_level: form.year_level,
        otp: otpCode,
        privacy_consent: agreedToPrivacy, // the server saves when they agreed
      };

      setOtpBusy(true);
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setOtpBusy(false);

      // Wrong / expired code: stay on the code screen and show why.
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
          buttons: [{ text: 'Go to Login', style: 'primary', onPress: () => { resetForm(); navigation.replace('Login'); } }],
        });
      } else if (response.status === 400 && /already exists/i.test(result.message || '')) {
        // Server says the account exists (e.g. the live check couldn't run): offer Login.
        showAfterReview({
          tone: 'warning',
          title: 'Already Registered',
          message: result.message,
          buttons: [
            { text: 'Edit Number', style: 'secondary', onPress: focusStudentNumber },
            { text: 'Go to Login', style: 'primary', onPress: () => navigation.replace('Login') },
          ],
        });
      } else {
        showAfterReview({ tone: 'error', title: 'Registration Error', message: result.message || 'Submission failed' });
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setOtpBusy(false);
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Check if server is running and on the same Wi-Fi.' });
    }
  };

  // Sends a RENEWAL (academic info only) to the server, then goes back to Home
  // (the student stays logged in and sees their new "pending" status).
  const submitRenewal = async () => {
    try {
      const payload = {
        student_number: form.student_number,
        college: form.college,
        program: form.program,
        year_level: form.year_level,
      };

      // Sent with the student's login pass, so only they can renew their own account.
      const response = await fetch(`${API_URL}/api/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      setConfirmModalVisible(false);

      if (response.ok) {
        showAfterReview({
          tone: 'success',
          title: 'Renewal Submitted',
          message: result.message || 'Please wait for admin approval.',
          buttons: [{ text: 'Back to Home', style: 'primary', onPress: () => navigation.navigate('HomeScreen') }],
        });
      } else {
        showAfterReview({ tone: 'error', title: 'Renewal Error', message: result.message || 'Submission failed' });
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setConfirmModalVisible(false);
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Check if server is running and on the same Wi-Fi.' });
    }
  };

  // Sends the corrected form for a REJECTED registration (PUT = replace it),
  // sent with the student's login pass, then goes back to Home (still logged in).
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
        program: form.program,
        year_level: form.year_level,
      };
      // The login pass saved at login proves to the server it's really this student.
      const token = await AsyncStorage.getItem('student_token');
      const response = await fetch(`${API_URL}/api/registration/${form.student_number}`, {
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
        showAfterReview({
          tone: 'success',
          title: 'Registration Resubmitted',
          message: result.message || 'Please wait for admin approval.',
          buttons: [{ text: 'Back to Home', style: 'primary', onPress: () => navigation.navigate('HomeScreen') }],
        });
      } else if (response.status === 401 || response.status === 403) {
        // No/expired login pass (e.g. logged in before this update): log in once more.
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
      console.error("Fetch Error:", error);
      showAfterReview({ tone: 'error', title: 'Connection Error', message: 'Check if server is running and on the same Wi-Fi.' });
    }
  };

  // "Submit" in the review pop-up: sends a renewal, a resubmission, or a new registration.
  const handleFinalSubmit = () => {
    if (isRenewal) submitRenewal();
    else if (isResubmit) submitResubmit();
    else requestOtp(); // new registration: verify the email first, then submitRegistration()
  };

  // "Cancel" button: renewal / resubmit go back to Home (still logged in);
  // a new registration goes back to the Login screen.
  const cancel = () => {
    if ((isRenewal || isResubmit) && navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('Login');
  };

  // Step numbers: new registration = Personal 1, Academic 2, Account 3, Review 4.
  // Renewal = Academic 1, Review 2.
  const academicStep = isRenewal ? 1 : 2;
  const reviewStep = isRenewal ? 2 : 4;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <Text style={styles.headerTitle}>
          {isRenewal ? 'Renew Registration' : isResubmit ? 'Resubmit Registration' : 'Student Registration'}
        </Text>
        <Text style={styles.headerSub}>
          {isRenewal
            ? 'Confirm your academic info for this semester.'
            : isResubmit
              ? 'Your details are filled in. Fix what was wrong, then submit again.'
              : 'Fill in all required fields.'}
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
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: layout.horizontalPadding, alignItems: 'center', paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* RENEWAL: shows whose account is being renewed */}
          {isRenewal && renewalStudent && (
            <View style={[styles.renewalBanner, { width: layout.contentWidth }]}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.renewalBannerText}>
                Renewing for {renewalStudent.full_name} ({renewalStudent.student_number})
              </Text>
            </View>
          )}

          {/* RESUBMIT: why the admin rejected it (saved when they rejected) */}
          {isResubmit && (
            <View style={[styles.rejectBanner, { width: layout.contentWidth }]}>
              <Ionicons name="alert-circle" size={20} color="#B3261E" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectBannerTitle}>Why your registration was rejected</Text>
                <Text style={styles.rejectBannerText}>
                  {loadingProfile ? 'Loading…' : getRejectionGuide(rejectionReason, currentPeriod).message}
                </Text>
                {!loadingProfile && getRejectionGuide(rejectionReason, currentPeriod).noEditsNeeded && (
                  <Text style={styles.rejectBannerHint}>Just review your details below and tap Continue.</Text>
                )}
              </View>
            </View>
          )}

          {/* STEP 1 — PERSONAL INFO (new registration only) */}
          {!isRenewal && (
            <View
              style={[styles.stepRow, { width: layout.contentWidth }]}
              onLayout={(e) => { personalRowY.current = e.nativeEvent.layout.y; }}
            >
              <StepIndicator number={1} active />
              <View style={styles.card}>
                <Text style={styles.stepHeading}>Personal Info</Text>

                {/* Name fields turn red with a hint if they contain numbers or symbols */}
                <Field
                  label="Surname"
                  value={form.surname}
                  onChangeText={(v) => update('surname', v)}
                  placeholder="Dela Cruz"
                  invalid={!isValidName(form.surname)}
                  style={!isValidName(form.surname) && { marginBottom: 4 }}
                />
                {!isValidName(form.surname) && <Text style={styles.nameHint}>{NAME_RULE_MESSAGE}</Text>}
                <Field
                  label="First Name"
                  value={form.first_name}
                  onChangeText={(v) => update('first_name', v)}
                  placeholder="Juan"
                  invalid={!isValidName(form.first_name)}
                  style={!isValidName(form.first_name) && { marginBottom: 4 }}
                />
                {!isValidName(form.first_name) && <Text style={styles.nameHint}>{NAME_RULE_MESSAGE}</Text>}
                <Field
                  label="Middle Name (optional)"
                  value={form.middle_name}
                  onChangeText={(v) => update('middle_name', v)}
                  placeholder="Santos"
                  invalid={!isValidName(form.middle_name)}
                  style={!isValidName(form.middle_name) && { marginBottom: 4 }}
                />
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
              </View>
            </View>
          )}

          {/* STEP 2 — ACADEMIC INFO (the only step in renewal mode) */}
          <View
            style={[styles.stepRow, { width: layout.contentWidth }]}
            onLayout={(e) => { academicRowY.current = e.nativeEvent.layout.y; }}
          >
            <StepIndicator number={academicStep} active={isRenewal} />
            <View style={styles.card}>
              <Text style={styles.stepHeading}>Academic Info</Text>
              {/* Student number can't change on renewal (it's shown in the banner above). */}
              {!isRenewal && (
                <View onLayout={(e) => { studentFieldY.current = e.nativeEvent.layout.y; }}>
                <Field
                  ref={studentNumberRef}
                  selectTextOnFocus
                  editable={!isResubmit}
                  label={isResubmit ? 'Student Number (can’t be changed)' : 'Student Number (9 digits)'}
                  value={form.student_number}
                  onChangeText={(v) => update('student_number', v.replace(/\D/g, ''))}
                  placeholder="202300001"
                  keyboardType="numeric"
                  maxLength={9}
                  invalid={numberCheck.state === 'taken'}
                  style={numberCheck.state !== 'idle' ? { marginBottom: 6 } : undefined}
                />
                <LiveCheck check={numberCheck} />
                </View>
              )}
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
                options={availableYearLevels}
                placeholder="Select year level"
              />
            </View>
          </View>

          {/* STEP 3 — ACCOUNT (new registration only): what they log in with */}
          {!isRenewal && (
            <View
              style={[styles.stepRow, { width: layout.contentWidth }]}
              onLayout={(e) => { accountRowY.current = e.nativeEvent.layout.y; }}
            >
              <StepIndicator number={3} />
              <View style={styles.card}>
                <Text style={styles.stepHeading}>Account</Text>

                <View onLayout={(e) => { emailFieldY.current = e.nativeEvent.layout.y; }}>
                  <Field
                    ref={emailRef}
                    label="CvSU Email Address"
                    value={form.email}
                    onChangeText={(v) => update('email', v)}
                    placeholder="name@cvsu.edu.ph"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={emailFeedback.state === 'error' || emailCheck.state === 'taken'}
                    style={{ marginBottom: 6 }}
                  />
                  {/* Wrong format → format tip. Correct format → is it already registered? */}
                  {emailFeedback.state === 'ok'
                    ? <LiveCheck check={emailCheck} />
                    : <EmailCheck feedback={emailFeedback} />}
                </View>

                {isResubmit ? (
                  // Resubmit: they're already logged in; their password stays the same.
                  <Text style={styles.fieldHint}>Your password stays the same.</Text>
                ) : (
                  <>
                    <PasswordField
                      label="Password"
                      value={form.password}
                      onChangeText={(v) => update('password', v)}
                      placeholder="8+ characters, A–Z, a–z, 0–9"
                      visible={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />
                    {/* Checklist appears once they start typing; each rule turns green when met */}
                    {form.password.length > 0 && <PasswordRulesCheck password={form.password} />}
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
                  </>
                )}
              </View>
            </View>
          )}

          {/* LAST STEP — REVIEW */}
          <View style={[styles.stepRow, { width: layout.contentWidth }]}>
            <StepIndicator number={reviewStep} isLast />
            <View style={{ flex: 1 }}>
            {/* Privacy Notice checkbox (new registration / resubmit only).
                Tapping the box ticks it; tapping the green words opens the notice. */}
            {!isRenewal && (
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
                  <Text style={styles.consentLink} onPress={() => setPrivacyOpen(true)}>
                    Privacy Notice and Terms of Use
                  </Text>
                  <Text>.</Text>
                </Text>
              </View>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.btn, styles.confirmBtn, !isRenewal && (!phoneNumberIsValid || !agreedToPrivacy) && styles.disabledBtn]}
                onPress={handleReview}
                disabled={!isRenewal && (!phoneNumberIsValid || !agreedToPrivacy)}
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

      {/* Privacy Notice and Terms of Use pop-up */}
      <PrivacyNoticeModal visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      {/* REVIEW POP-UP — last check before actually submitting */}
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
          /* EMAIL CODE SCREEN — the registration is sent only with the right code */
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
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
            {resendIn > 0 ? (
              // First minute: emails usually arrive within a few seconds to a minute.
              <Text style={styles.modalNote}>The code may take up to a minute to arrive. It expires in 10 minutes.</Text>
            ) : (
              // After 60 seconds (same time "Resend code" unlocks): probably in Spam, or the
              // email was mistyped — the app can't tell if an email doesn't exist, so we ask them to check.
              <View style={styles.otpHelpBox}>
                <Text style={styles.otpHelpText}>
                  <Text style={{ fontWeight: '700' }}>Didn't get the code?</Text> Check your Spam or Promotions folder,
                  or make sure your CvSU email is spelled correctly.
                </Text>
                <TouchableOpacity
                  onPress={() => { closeReview(); setTimeout(focusEmail, 400); }}
                  style={styles.otpEditEmail}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                  <Text style={styles.otpLink}>Edit email</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          ) : (
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {isRenewal ? 'Confirm Renewal' : isResubmit ? 'Confirm Resubmission' : 'Confirm Your Info'}
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {!isRenewal && (
                <>
                  <SummaryRow label="Name" value={`${form.first_name} ${form.middle_name ? form.middle_name + ' ' : ''}${form.surname}`.trim()} />
                  <SummaryRow label="Phone Number" value={form.phone_number} />
                  <SummaryRow label="Address" value={form.address} />
                  <SummaryRow label="Sex" value={form.sexLabel} />
                  <SummaryRow label="Student Number" value={form.student_number} />
                </>
              )}
              <SummaryRow label="College" value={form.college} />
              <SummaryRow label="Program" value={form.program} />
              <SummaryRow label="Year Level" value={form.year_level} />
              {!isRenewal && <SummaryRow label="CvSU Email" value={form.email.trim().toLowerCase()} />}
              {isRenewal && currentPeriod && <SummaryRow label="Semester" value={currentPeriod} />}
            </ScrollView>

            <Text style={styles.modalNote}>
              {isRenewal
                ? "Your name, email, and password are unchanged — only your academic info above will be updated."
                : "Please double-check your info before submitting."}
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
            {!isRenewal && !isResubmit && (
              <Text style={styles.modalNote}>After you tap Submit, we'll email a code to your CvSU email to verify it.</Text>
            )}
          </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Styled pop-up (errors, warnings, success) — drawn on top of everything */}
      {dialog}
    </View>
  );
}

// Phone input with a fixed "+63" in front. Turns red while it's incomplete
// or when the number is already used by another account.
const PhoneNumberField = forwardRef(function PhoneNumberField({ value, onChange, taken, hasMessage }, ref) {
  const phoneDigits = value.replace(/^\+63/, '');
  const isComplete = /^9\d{9}$/.test(phoneDigits);
  const hasInput = phoneDigits.length > 0;

  return (
    <View style={[styles.phoneFieldWrap, hasMessage && { marginBottom: 6 }]}>
      <Text style={styles.fieldLabel}>Phone Number</Text>
      <View style={[styles.phoneInput, ((hasInput && !isComplete) || taken) && styles.phoneInputInvalid]}>
        <Text style={styles.countryCode}>+63</Text>
        <TextInput
          ref={ref}
          style={styles.phoneNumberInput}
          value={formatPhoneDigits(value)}
          onChangeText={(input) => onChange(`+63${normalizePhoneDigits(input)}`)}
          placeholder="912 345 6789"
          placeholderTextColor={colors.gray}
          keyboardType="number-pad"
          maxLength={12}
        />
      </View>
    </View>
  );
});

// A labeled text input. Pass invalid={true} to show a red border.
// forwardRef lets a screen grab the input (e.g. to focus it from code).
// editable={false} shows it grayed out (locked).
const Field = forwardRef(function Field({ label, invalid, style, ...rest }, ref) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, invalid && styles.inputInvalid, rest.editable === false && styles.inputLocked]}
        placeholderTextColor={colors.gray}
        {...rest}
      />
    </View>
  );
});

// Live message under a field (student number, phone): nothing while typing,
// then "Checking…", then available (green) / already used (red).
function LiveCheck({ check }) {
  if (check.state === 'idle') return null; // nothing to show until all 9 digits are typed
  if (check.state === 'checking') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 2 }}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}>Checking…</Text>
      </View>
    );
  }
  const look = {
    available: { icon: 'checkmark-circle', color: colors.primary, text: check.message },
    taken: { icon: 'close-circle', color: '#DC2626', text: check.message },
    unknown: { icon: 'alert-circle-outline', color: '#946800', text: check.message },
  }[check.state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 2 }}>
      <Ionicons name={look.icon} size={14} color={look.color} />
      <Text style={{ fontSize: 12, color: look.color, marginLeft: 6, flexShrink: 1 }}>{look.text}</Text>
    </View>
  );
}

// Live message under the email field: gray hint, red error, or green "valid".
function EmailCheck({ feedback }) {
  const look = {
    hint: { icon: 'information-circle-outline', color: colors.textSecondary },
    error: { icon: 'close-circle', color: '#DC2626' },
    ok: { icon: 'checkmark-circle', color: colors.primary },
  }[feedback.state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 2 }}>
      <Ionicons name={look.icon} size={14} color={look.color} />
      <Text style={{ fontSize: 12, color: look.color, marginLeft: 6, flexShrink: 1 }}>{feedback.text}</Text>
    </View>
  );
}

// Password input with a show/hide eye button.
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

// Live checklist under the password: each rule turns green once it's met.
// Exported so ChangePasswordModal.js can reuse it.
export function PasswordRulesCheck({ password }) {
  return (
    <View style={{ marginTop: -2, marginBottom: 14, marginLeft: 2 }}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={met ? colors.primary : colors.gray}
            />
            <Text style={{ fontSize: 12, color: met ? colors.primary : colors.textSecondary, marginLeft: 6 }}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Older single-rule check (8+ characters). Kept because ChangePasswordModal.js
// may still import it; new screens should use PasswordRulesCheck instead.
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

// Live check while typing Confirm Password: does it match?
// Exported so ChangePasswordModal.js can reuse it.
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

// One "Label ........ Value" line in the review pop-up.
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
  headerWrap: { backgroundColor: BRAND.deep, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: HEADER_RADIUS, borderBottomRightRadius: HEADER_RADIUS, overflow: 'hidden' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#BFD9C2', fontSize: 13, marginTop: 4 },
  headerPeriod: { color: BRAND.goldLight, fontSize: 12, fontWeight: '700', marginTop: 6 },
  scroll: { flex: 1, marginTop: -16 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  renewalBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.mint,
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
  inputInvalid: { borderColor: '#DC2626' },
  nameHint: { fontSize: 12, color: '#DC2626', marginBottom: 14, marginLeft: 2 },
  inputLocked: { backgroundColor: '#F1F3F1', color: colors.textSecondary },
  fieldHint: { fontSize: 12, color: colors.textSecondary, marginTop: -2, marginBottom: 16, marginLeft: 2 },
  rejectBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FDF3F2', borderWidth: 1, borderColor: '#F5CFC9',
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  rejectBannerTitle: { fontSize: 13, fontWeight: '700', color: '#B3261E' },
  rejectBannerText: { fontSize: 13, color: '#8A362F', marginTop: 3, lineHeight: 18 },
  rejectBannerHint: { fontSize: 12, color: '#8A362F', marginTop: 6, fontWeight: '600' },
  phoneFieldWrap: { marginBottom: 16 },
  phoneInput: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#fff', borderRadius: 14, paddingLeft: 14, paddingRight: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04,
    shadowRadius: 5, elevation: 1,
  },
  phoneInputInvalid: { borderColor: '#DC2626' },
  countryCode: { color: colors.primary, fontSize: 14, fontWeight: '600', paddingRight: 12, borderRightWidth: 1, borderRightColor: colors.border },
  phoneNumberInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },

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
  // Privacy Notice checkbox row above Continue / Cancel
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginLeft: 12, marginBottom: 14 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, marginTop: 1,
    borderWidth: 1.5, borderColor: colors.gray, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  consentLink: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { backgroundColor: colors.primary },
  disabledBtn: { backgroundColor: '#AAB8AC' },
  confirmText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: colors.grayLight },
  cancelText: { color: colors.textPrimary, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  modalNote: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 17 },
  otpText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  otpInput: { fontSize: 26, fontWeight: '700', letterSpacing: 10, textAlign: 'center', paddingVertical: 14 },
  otpError: { fontSize: 12, color: '#DC2626', marginTop: 8, marginLeft: 2 },
  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  otpLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  // "Didn't get the code?" box shown after 60 seconds on the code screen
  otpHelpBox: { marginTop: 14, backgroundColor: BRAND.goldSoft, borderRadius: 12, padding: 12 },
  otpHelpText: { fontSize: 12.5, lineHeight: 18, color: '#7A5A08' },
  otpEditEmail: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.grayLight },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  summaryValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flex: 1.4, textAlign: 'right' },
});