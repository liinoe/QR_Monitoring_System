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
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';
import { BRAND, HEADER_RADIUS } from '../theme/brand';
import { QLessTile, ScanFrame } from '../components/QLessLogo';
import { useAppDialog } from '../components/AppDialog';

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
const APP_VERSION = '1.0.0'; // keep in sync with app.json "version"

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
export default function SettingsScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [studentData, setStudentData] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // Styled pop-up (see components/AppDialog.js).
  const { dialog, showDialog } = useAppDialog();

  // Loads the profile and current semester when the page opens.
  useEffect(() => {
    // Gets the student's profile (cached first, then from the server).
    const load = async () => {
      try {
        // Show the last-known profile instantly (the Home screen caches it),
        // then refresh from the server.
        const cached = await AsyncStorage.getItem('cached_profile');
        if (cached) setStudentData(JSON.parse(cached));

        const stored = await AsyncStorage.getItem('student');
        if (!stored) return;
        const student = JSON.parse(stored);
        const res = await fetch(`${API_URL}/api/student/profile/${student.student_number}`);
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
    loadPeriod();
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
            navigation.replace('Login');
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
  const details = [
    { icon: 'school-outline', label: 'College', value: studentData?.college },
    { icon: 'book-outline', label: 'Program', value: studentData?.program },
    { icon: 'layers-outline', label: 'Year level', value: studentData?.year_level },
    { icon: 'calendar-outline', label: 'Registered for', value: studentData?.registered_period },
    { icon: 'mail-outline', label: 'Email', value: studentData?.email },
    { icon: 'call-outline', label: 'Phone', value: formatPhone(studentData?.phone_number) },
  ];

  return (
    <View style={styles.root}>
      {/* HEADER + PROFILE */}
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={[styles.headerInner, { paddingHorizontal: layout.horizontalPadding }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            {/* Log Out sits at the top right, across from the title */}
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7} hitSlop={6}>
              <Ionicons name="log-out-outline" size={16} color="#fff" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
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
              <Text style={styles.profileName} numberOfLines={2}>{studentData?.full_name || 'Student'}</Text>
              <Text style={styles.profileSub}>{studentData?.student_number || '—'}</Text>
              {status && (
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Ionicons name={status.icon} size={13} color={status.color} />
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
          { paddingHorizontal: layout.horizontalPadding, width: '100%', alignSelf: 'center', maxWidth: layout.contentWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT DETAILS */}
        <Text style={styles.sectionLabel}>Account details</Text>
        <View style={styles.card}>
          {details.map((d, i) => (
            <View key={d.label} style={[styles.detailRow, i < details.length - 1 && styles.rowDivider]}>
              <View style={styles.rowIconWrap}>
                <Ionicons name={d.icon} size={16} color={BRAND.green} />
              </View>
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
          <SettingsRow icon="time-outline" label="Library Hours" value={LIBRARY_INFO.hours} divider />
          <SettingsRow icon="location-outline" label="Address" value={LIBRARY_INFO.address} />
        </View>

        {/* CONTACT THE LIBRARY — each row opens the app/site */}
        <Text style={styles.sectionLabel}>Contact the library</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="mail-outline"
            label="Email"
            value={LIBRARY_INFO.email}
            onPress={() => openLink(`mailto:${LIBRARY_INFO.email}`)}
            divider
          />
          <SettingsRow
            icon="logo-facebook"
            label="Facebook / Messenger"
            value={LIBRARY_INFO.facebookName}
            onPress={() => openLink(LIBRARY_INFO.facebookUrl)}
            divider
          />
          <SettingsRow
            icon="logo-youtube"
            label="YouTube"
            value="@cvsulibrary"
            onPress={() => openLink(LIBRARY_INFO.youtube)}
            divider
          />
          <SettingsRow
            icon="globe-outline"
            label="Website"
            value="library.cvsu.edu.ph"
            onPress={() => openLink(LIBRARY_INFO.website)}
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
      </ScrollView>

      <ChangePasswordModal
        visible={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        studentNumber={studentData?.student_number}
      />

      {/* Log out confirmation / link errors */}
      {dialog}
    </View>
  );
}

// One tappable or informational row: icon · label (+ value underneath) · chevron.
function SettingsRow({ icon, label, value, onPress, divider }) {
  const content = (
    <>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={16} color={BRAND.green} />
      </View>
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
const CARD_SHADOW = {
  elevation: 2,
  shadowColor: '#0B1F12',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
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
  topBar: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
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

  card: { backgroundColor: '#fff', borderRadius: 18, ...CARD_SHADOW },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  detailLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F3F1' },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: BRAND.mint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 14.5, color: colors.textPrimary, fontWeight: '500' },
  rowValue: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },

  aboutCard: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  aboutName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  aboutVersion: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  aboutSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Small see-through pill at the top right of the green header.
  logoutBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});