import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { API_URL } from '../config';
import { authHeaders } from '../utils/studentAuth';
import { getResponsive } from '../theme/responsive';
import { BRAND, HEADER_RADIUS } from '../theme/brand';
import { QLessTile, ScanFrame } from '../components/QLessLogo';
import BottomNav from '../components/BottomNav';
import { useAppDialog } from '../components/AppDialog';
import appConfig from '../../app.json';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';

// Library details shown in the Support section.
// Hours follow the library's own schedule (not Google's "Always open" listing).
const LIBRARY_INFO = {
  name: 'Ladislao N. Diwa Memorial Library',
  school: 'Cavite State University',
  hours: '7:00 AM – 6:00 PM · cut-off 5:30 PM',
  address: 'Don Severino de las Alas Campus, Bancod, Indang, Cavite 4122',
  email: 'cvsulibrary@cvsu.edu.ph',
  facebookName: 'Cavite State University - Main Campus Library',
  // No direct page link yet, so this opens a Facebook search for the page name.
  facebookUrl: 'https://www.facebook.com/cvsulibrary/' + encodeURIComponent('Cavite State University - Main Campus Library'),
  youtube: 'https://www.youtube.com/@cvsulibrary',
  website: 'https://library.cvsu.edu.ph/landing/',
};
// Official brand colors for the social media icons (so they're easy to recognize).
const SOCIAL_COLORS = {
  facebook: '#1877F2',
  youtube: '#FF0000',
};

// Read straight from app.json, so the version shown always matches the installed build.
const APP_VERSION = appConfig.expo.version;

// Returns the status pill (label, icon, colors) for the student.
// Same status wording as the Home screen cards.
const getStatusInfo = (student, currentPeriod) => {
  if (!student) return null;
  const s = student.status;
  if (s === 'approved') return { label: 'Approved', icon: 'checkmark-circle', color: '#1B5E20', bg: '#E8F1E9' };
  if (s === 'rejected') return { label: 'Rejected', icon: 'close-circle', color: '#B3261E', bg: '#FBDFDB' };
  if (s === 'deactivated') return { label: 'Deactivated', icon: 'ban', color: '#B3261E', bg: '#FBDFDB' };
  if (s === 'expired') return { label: 'Semester ended', icon: 'calendar', color: '#946800', bg: '#FBF1CE' };
  if (s === 'pending' && currentPeriod && student.registered_period && student.registered_period !== currentPeriod) {
    return { label: 'Renewal needed', icon: 'refresh-circle', color: '#946800', bg: '#FBF1CE' };
  }
  return { label: 'Pending approval', icon: 'time', color: '#946800', bg: '#FBF1CE' };
};

// Gets the student's initials for the avatar, e.g. "Juan Dela Cruz" → "JC".
const getInitials = (student) => {
  if (!student) return '';
  if (student.first_name && student.surname) {
    return `${student.first_name.charAt(0)}${student.surname.charAt(0)}`.toUpperCase();
  }
  const parts = (student.full_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return `${parts[0].charAt(0)}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''}`.toUpperCase();
};

// Formats a phone number for display: "+639123456789" → "+63 912 345 6789"
const formatPhone = (phone) => {
  const m = /^\+63(\d{3})(\d{3})(\d{4})$/.exec(phone || '');
  return m ? `+63 ${m[1]} ${m[2]} ${m[3]}` : phone || '';
};

// Settings page: profile header (with Log Out), account details,
// password change, library contacts and app info.
// Works for students and faculty. A faculty account is saved on the phone with an
// employee_id (no student_number), and has no semester, program or year level.
export default function SettingsScreen({ navigation }) {
  // Height of the phone's bottom navigation bar, so nothing hides behind it.
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [studentData, setStudentData] = useState(null);
  // Privacy Notice pop-up (same one shown during registration)
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [isFaculty, setIsFaculty] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // Styled pop-up (see components/AppDialog.js).
  const { dialog, showDialog } = useAppDialog();

  // Loads the profile (and, for students, the current semester) when the page opens.
  useEffect(() => {
    // Gets the profile (cached first, then from the server).
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('student');
        if (!stored) return;
        const account = JSON.parse(stored);
        // The login saves user_type: 'faculty' for faculty (they also have an employee_id
        // instead of a student_number).
        const faculty = account.user_type === 'faculty' || (!!account.employee_id && !account.student_number);
        setIsFaculty(faculty);

        // Show the last-known profile instantly (the Home screen caches it),
        // then refresh from the server. A faculty member only sees a cached profile
        // that is really theirs (the cache can hold someone else's after a log out).
        const cached = await AsyncStorage.getItem('cached_profile');
        if (cached) {
          const profile = JSON.parse(cached);
          if (!faculty || String(profile.employee_id) === String(account.employee_id)) setStudentData(profile);
        }

        // Semesters only matter for students (faculty never renew).
        if (!faculty) loadPeriod();

        const url = faculty
          ? `${API_URL}/api/faculty/profile/${account.employee_id}`
          : `${API_URL}/api/student/profile/${account.student_number}`;
        const res = await fetch(url, { headers: await authHeaders() });
        if (res.ok) setStudentData(await res.json());
      } catch (err) {
        console.error('Error loading profile for settings:', err);
      }
    };
    // Gets the current semester so the pill can show "Renewal needed".
    const loadPeriod = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/current-period`);
        if (res.ok) setCurrentPeriod((await res.json()).current_period);
      } catch {
        // offline — status pill just won't show "Renewal needed"
      }
    };
    load();
  }, []);

  // Log Out button: asks first, then clears the saved login and goes to Login.
  const handleLogout = () => {
    showDialog({
      tone: 'warning',
      title: 'Log Out?',
      message: 'You will need to log in again to use your QR pass on this phone.',
      buttons: [
        { text: 'Cancel', style: 'secondary' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // Forget the student and their login pass on this phone.
            await AsyncStorage.multiRemove(['student', 'student_token']);
            // Clear the whole stack (Home is underneath Settings), so the back
            // swipe / back button can't return to Home after logging out.
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ],
    });
  };

  // Opens a link (email, Facebook, YouTube, website). Shows a pop-up if it can't.
  const openLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {
      showDialog({ tone: 'error', title: "Can't Open Link", message: 'Please try again, or visit the library front desk.' });
    }
  };

  const status = getStatusInfo(studentData, currentPeriod);
  // Faculty submitted a college, email and phone (no program, year level or semester).
  const details = isFaculty
    ? [
        { icon: 'school-outline', label: 'College', value: studentData?.college },
        { icon: 'mail-outline', label: 'Email', value: studentData?.email },
        { icon: 'call-outline', label: 'Phone', value: formatPhone(studentData?.phone_number) },
      ]
    : [
        { icon: 'school-outline', label: 'College', value: studentData?.college },
        { icon: 'book-outline', label: 'Program', value: studentData?.program },
        { icon: 'layers-outline', label: 'Year level', value: studentData?.year_level },
        { icon: 'calendar-outline', label: 'Registered for', value: studentData?.registered_period },
        { icon: 'mail-outline', label: 'Email', value: studentData?.email },
        { icon: 'call-outline', label: 'Phone', value: formatPhone(studentData?.phone_number) },
      ];
  const displayName =
    studentData?.full_name ||
    [studentData?.first_name, studentData?.surname].filter(Boolean).join(' ') ||
    (isFaculty ? 'Faculty' : 'Student');
  const idLine = isFaculty
    ? `Faculty · ${studentData?.employee_id || '—'}`
    : `Student · ${studentData?.student_number || '—'}`;

  return (
    <View style={styles.root}>
      {/* HEADER + PROFILE */}
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={[styles.headerInner, { paddingHorizontal: layout.horizontalPadding }]}>
          {/* Title only: Home and Settings are in the footer, Log Out is at the bottom of the page */}
          <View style={styles.topBar}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>

          <View style={styles.profileRow}>
            <ScanFrame size={68} arm={16} thickness={3} radius={8} color={BRAND.gold}>
              <View style={styles.avatar}>
                {getInitials(studentData) ? (
                  <Text style={styles.avatarText}>{getInitials(studentData)}</Text>
                ) : (
                  <Ionicons name="person" size={24} color="#fff" />
                )}
              </View>
            </ScanFrame>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={2}>{displayName}</Text>
              <Text style={styles.profileSub}>{idLine}</Text>
              {status && (
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: layout.horizontalPadding, width: '100%', alignSelf: 'center', maxWidth: layout.contentWidth, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT DETAILS */}
        <Text style={styles.sectionLabel}>Account details</Text>
        <View style={styles.card}>
          {details.map((d, i) => (
            <View key={d.label} style={[styles.detailRow, i < details.length - 1 && styles.rowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue}>{d.value || '—'}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.sectionHint}>
          Need to correct something? Visit the library front desk — details can only be edited by library staff.
        </Text>

        {/* SECURITY */}
        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.card}>
          <SettingsRow icon="key-outline" label="Change Password" onPress={() => setChangePasswordOpen(true)} />
        </View>

        {/* SUPPORT */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <SettingsRow icon="time-outline" showIcon label="Library Hours" value={LIBRARY_INFO.hours} divider />
          <SettingsRow icon="location-outline" showIcon label="Address" value={LIBRARY_INFO.address} />
        </View>

        {/* CONTACT THE LIBRARY — each row opens the app/site */}
        <Text style={styles.sectionLabel}>Contact the library</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="mail-outline"
            showIcon
            label="Email"
            value={LIBRARY_INFO.email}
            onPress={() => openLink(`mailto:${LIBRARY_INFO.email}`)}
            divider
          />
          <SettingsRow
            icon="logo-facebook"
            showIcon
            iconColor={SOCIAL_COLORS.facebook}
            label="Facebook / Messenger"
            value={LIBRARY_INFO.facebookName}
            onPress={() => openLink(LIBRARY_INFO.facebookUrl)}
            divider
          />
          <SettingsRow
            icon="logo-youtube"
            showIcon
            iconColor={SOCIAL_COLORS.youtube}
            label="YouTube"
            value="@cvsulibrary"
            onPress={() => openLink(LIBRARY_INFO.youtube)}
            divider
          />
          <SettingsRow
            icon="globe-outline"
            showIcon
            label="Website"
            value="library.cvsu.edu.ph"
            onPress={() => openLink(LIBRARY_INFO.website)}
          />
        </View>

        {/* PRIVACY */}
        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Notice and Terms of Use"
            onPress={() => setPrivacyOpen(true)}
          />
        </View>

        {/* ABOUT */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={[styles.card, styles.aboutCard]}>
          <QLessTile size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aboutName}>
              <Text style={{ color: BRAND.gold }}>Q</Text>
              <Text style={{ color: BRAND.green }}>Less</Text>
              <Text style={styles.aboutVersion}>  v{APP_VERSION}</Text>
            </Text>
            <Text style={styles.aboutSub}>{LIBRARY_INFO.name}</Text>
            <Text style={styles.aboutSub}>{LIBRARY_INFO.school}</Text>
          </View>
        </View>

        {/* LOG OUT: last thing on the page, after the version */}
        <TouchableOpacity
          style={styles.logoutRow}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={19} color="#B3261E" />
          <Text style={styles.logoutRowText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <PrivacyNoticeModal visible={privacyOpen} onClose={() => setPrivacyOpen(false)} userType={isFaculty ? 'faculty' : 'student'} />

      <ChangePasswordModal
        visible={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        studentNumber={studentData?.student_number}
        employeeId={studentData?.employee_id}
        isFaculty={isFaculty}
      />

      {/* Log out confirmation / link errors */}
      {dialog}

      {/* Footer navigation: Home | Settings */}
      <BottomNav active="Settings" navigation={navigation} />
    </View>
  );
}

// One tappable or informational row: icon · label (+ value underneath) · chevron.
// showIcon: draws the icon on the left (used for the library's info and social links).
// iconColor: icon color (brand color for Facebook / YouTube; green by default).
function SettingsRow({ icon, showIcon, iconColor, label, value, onPress, divider }) {
  const content = (
    <>
      {showIcon && !!icon && (
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={18} color={iconColor || BRAND.green} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color="#C4C8C5" />}
    </>
  );
  const style = [styles.row, divider && styles.rowDivider];
  return onPress ? (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.6}>{content}</TouchableOpacity>
  ) : (
    <View style={style}>{content}</View>
  );
}

// Soft shadow used by the white cards.
// Cards use a thin border instead of a drop shadow (cleaner, flatter look).
const CARD_SHADOW = {
  borderWidth: 1,
  borderColor: '#E4E4E7',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header — same deep green / rounded bottom as Home.
  headerWrap: {
    backgroundColor: BRAND.deep,
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
    overflow: 'hidden',
  },
  headerInner: { paddingBottom: 24 },
  // Seal + title on the left, the round Log Out button on the right.
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 38, marginTop: 6 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  profileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.5 },
  profileText: { flex: 1 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 3, letterSpacing: 0.3 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 9, borderRadius: 10, marginTop: 8, gap: 5,
  },
  statusText: { fontSize: 11.5, fontWeight: '700' },

  scrollContent: { paddingTop: 6, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 22, marginLeft: 4,
  },
  sectionHint: { fontSize: 11.5, color: '#A3A8A4', lineHeight: 16, marginTop: 8, marginHorizontal: 4 },

  card: { backgroundColor: '#fff', borderRadius: 12, ...CARD_SHADOW },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  detailLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F3F1' },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F4F4F5', // light gray square behind each icon
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 14.5, color: colors.textPrimary, fontWeight: '500' },
  rowValue: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },

  aboutCard: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  aboutName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  aboutVersion: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  aboutSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Full-width Log Out button at the bottom of the page.
  logoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, marginTop: 24,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E4E7',
  },
  logoutRowText: { color: '#B3261E', fontSize: 14.5, fontWeight: '700' },
  // (old header button styles, no longer used)
  logoutBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});