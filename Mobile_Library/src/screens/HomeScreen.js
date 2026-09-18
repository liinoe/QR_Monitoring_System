import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import QRModal from '../components/QRModal';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';

const CHART_MAX_BAR_HEIGHT = 80;

const formatHoursLabel = (hrs) => {
  if (!hrs || hrs <= 0) return '';
  if (hrs < 1) return `${Math.round(hrs * 60)}min`;
  return `${hrs}hr`;
};

const formatStayRange = (hrs) => {
  if (!hrs || hrs <= 0) return '--';
  const lower = Math.floor(hrs);
  return `${lower} - ${lower + 1} Hrs`;
};

// "Kyla P." style greeting name — first name plus the surname's initial.
// Prefers the structured first_name/surname fields (reliable), and only
// falls back to splitting full_name for older records that predate those
// columns — same fallback pattern used elsewhere for legacy student rows.
const getDisplayName = (student) => {
  if (!student) return 'Student';

  if (student.first_name && student.surname) {
    return `${student.first_name} ${student.surname.charAt(0).toUpperCase()}.`;
  }

  const full = (student.full_name || '').trim();
  if (!full) return 'Student';
  const parts = full.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [now, setNow] = useState(new Date());
  const [qrOpen, setQrOpen] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const abortControllerRef = React.useRef(null);

  const formatDateTime = (d) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const datePart = d.toLocaleDateString('en-US', options);
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} • ${timePart}`;
  };

  const getGreeting = (d) => {
    const hour = d.getHours();
    if (hour < 12) return 'Good Morning!';
    if (hour < 18) return 'Good Afternoon!';
    return 'Good Evening!';
  };

  const fetchProfileData = async (isInitial = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const storedStudent = await AsyncStorage.getItem('student');
      if (!storedStudent) return;
      const student = JSON.parse(storedStudent);

      const response = await fetch(
        `${API_URL}/api/student/profile/${student.student_number}`,
        { signal: controller.signal }
      );

      if (response.status === 404) {
        setStudentData(null);
      } else {
        const data = await response.json();
        setStudentData(data);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching data:', error);
    } finally {
      if (isInitial) setFetched(true);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const storedStudent = await AsyncStorage.getItem('student');
      if (!storedStudent) return;
      const student = JSON.parse(storedStudent);

      const response = await fetch(
        `${API_URL}/api/student/analytics/${student.student_number}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchCurrentPeriod = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings/current-period`);
      if (response.ok) {
        const data = await response.json();
        setCurrentPeriod(data.current_period);
      }
    } catch (error) {
      console.error('Error fetching current period:', error);
    }
  };

  useEffect(() => {
    fetchProfileData(true);
    fetchAnalytics();
    fetchCurrentPeriod();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    const refreshInterval = setInterval(() => {
      fetchProfileData(false);
      fetchAnalytics();
      fetchCurrentPeriod();
    }, 10000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const isApproved = studentData?.status === 'approved';
  const isRejected = studentData?.status === 'rejected';
  const isDeactivated = studentData?.status === 'deactivated';

  // A student is due for RENEWAL if their last registration was for a
  // different (past) period than the one currently active. Only applies
  // to 'pending' status — rejected/deactivated have their own distinct
  // states below, not a renewal prompt.
  const needsRenewal = !!(
    studentData &&
    studentData.status === 'pending' &&
    currentPeriod &&
    studentData.registered_period &&
    studentData.registered_period !== currentPeriod
  );

  const isPending = studentData && studentData.status === 'pending' && !needsRenewal;
  const isNotRegistered = fetched && !studentData;

  const maxChartHours = analytics
    ? Math.max(1, ...analytics.weekly_activity.map((w) => w.hours))
    : 1;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={[styles.headerInner, { paddingHorizontal: layout.horizontalPadding }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting(now)}</Text>
            <Text style={styles.name}>{getDisplayName(studentData)}</Text>
            <Text style={styles.dateText}>{formatDateTime(now)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 20 }} />

        {/* NOT REGISTERED */}
        {isNotRegistered && (
          <View style={[styles.registerCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.registerIconWrap}>
              <Ionicons name="person-add-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.registerTitle}>No Library Account Found</Text>
            <Text style={styles.registerSub}>
              Register your student profile to access the library and get your QR pass.
            </Text>
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.88}
            >
              <Text style={styles.registerBtnText}>Register Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* NEEDS RENEWAL */}
        {needsRenewal && (
          <View style={[styles.statusCard, styles.lockedCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.statusRow}>
              <View style={styles.lockIconWrap}>
                <Ionicons name="refresh-outline" size={24} color="#946800" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictedTitle}>Renewal Required</Text>
                <Text style={styles.pendingSubText}>
                  Your registration is for a past semester. Renew for {currentPeriod} to regain library access.
                </Text>
                <TouchableOpacity
                  style={styles.renewBtn}
                  onPress={() => navigation.navigate('Register', { mode: 'renewal' })}
                  activeOpacity={0.88}
                >
                  <Text style={styles.renewBtnText}>Renew Registration</Text>
                  <Ionicons name="arrow-forward" size={15} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* PENDING APPROVAL */}
        {isPending && (
          <View style={[styles.statusCard, styles.lockedCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.statusRow}>
              <View style={styles.lockIconWrap}>
                <Ionicons name="time-outline" size={24} color="#946800" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictedTitle}>Access Restricted</Text>
                <Text style={styles.pendingSubText}>Your registration is pending admin approval.</Text>
                <View style={styles.pendingBadge}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.pendingBadgeText}>Pending Review</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* REJECTED — shows the admin's reason, and a self-service path to
            resubmit, since rejection just means "not this attempt", not
            "never allowed" (that's what Deactivate is for). */}
        {isRejected && (
          <View style={[styles.statusCard, styles.rejectedCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.statusRow}>
              <View style={styles.rejectedIconWrap}>
                <Ionicons name="close-circle-outline" size={24} color="#B3261E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectedTitle}>Registration Rejected</Text>
                <Text style={styles.rejectedSubText}>
                  {studentData?.status_reason || 'Your registration was not approved.'}
                </Text>
                <TouchableOpacity
                  style={styles.resubmitBtn}
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.resubmitBtnText}>Register Again</Text>
                  <Ionicons name="arrow-forward" size={15} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* DEACTIVATED — admin-only recovery path (Reactivate), so the next
            step here is "contact the library", not a self-service button. */}
        {isDeactivated && (
          <View style={[styles.statusCard, styles.rejectedCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.statusRow}>
              <View style={styles.rejectedIconWrap}>
                <Ionicons name="ban-outline" size={24} color="#B3261E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectedTitle}>Account Deactivated</Text>
                <Text style={styles.rejectedSubText}>
                  {studentData?.status_reason || 'Your account access has been deactivated.'}
                </Text>
                <View style={styles.contactBadge}>
                  <Ionicons name="information-circle-outline" size={13} color="#7F1D1D" />
                  <Text style={styles.contactBadgeText}>Please visit the library front desk to resolve this</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* APPROVED — DASHBOARD ANALYTICS + QR */}
        {isApproved && (
          <>
            <View style={[styles.kpiRow, { width: layout.contentWidth }]}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Real-Time Headcount</Text>
                <Text style={styles.kpiValue}>{analytics ? analytics.current_occupancy : '--'}</Text>
                <Text style={styles.kpiSub}>currently inside the library</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Visits</Text>
                <Text style={styles.kpiValue}>{analytics ? analytics.total_visits : '--'}</Text>
                <Text style={styles.kpiSub}>all-time</Text>
              </View>
            </View>

            <View style={{ height: 14 }} />

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setQrOpen(true)}
              style={[styles.qrCard, { padding: layout.cardPadding, width: layout.contentWidth }]}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.qrTitle}>Present at entrance to log entry!</Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusPillDot} />
                  <Text style={styles.statusText}>Approved</Text>
                </View>
                <View style={styles.enlargeContainer}>
                  <Ionicons name="expand-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.enlargeText}>Tap to enlarge</Text>
                </View>
              </View>
              <View style={styles.qrPreview}>
                <QRCode
                  value={studentData?.qr_code || 'NA'}
                  size={Math.min(80, layout.contentWidth * 0.19)}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>

            <View style={{ height: 14 }} />

            <View style={[styles.chartCard, { width: layout.contentWidth, padding: layout.cardPadding }]}>
              <Text style={styles.chartTitle}>Library Activity</Text>

              {analytics ? (
                <View style={styles.chartRow}>
                  {analytics.weekly_activity.map((item) => {
                    const barHeight = item.hours > 0
                      ? Math.max(6, (item.hours / maxChartHours) * CHART_MAX_BAR_HEIGHT)
                      : 4;
                    return (
                      <View key={item.day} style={styles.chartBarWrap}>
                        <Text style={styles.chartValueLabel}>{formatHoursLabel(item.hours)}</Text>
                        <View
                          style={[
                            styles.chartBar,
                            { height: barHeight, backgroundColor: item.hours > 0 ? colors.primary : '#E5E7E5' },
                          ]}
                        />
                        <Text style={styles.chartDayLabel}>{item.day}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.chartLoadingText}>Loading activity...</Text>
              )}

              <View style={styles.footerDividerLine} />

              <View style={styles.footerStatsRow}>
                <View style={styles.footerStatItem}>
                  <View style={styles.footerStatIconWrap}>
                    <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.footerStatLabel}>Frequent Visit</Text>
                    <Text style={styles.footerStatValue}>{analytics ? analytics.frequent_day : '--'}</Text>
                  </View>
                </View>
                <View style={styles.footerVerticalDivider} />
                <View style={styles.footerStatItem}>
                  <View style={styles.footerStatIconWrap}>
                    <Ionicons name="time-outline" size={15} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.footerStatLabel}>Avg. Stay Duration</Text>
                    <Text style={styles.footerStatValue}>
                      {analytics ? formatStayRange(analytics.avg_stay_hours) : '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {isApproved && (
        <QRModal visible={qrOpen} onClose={() => setQrOpen(false)} value={studentData?.qr_code} />
      )}
    </View>
  );
}

// Centralized palette so the whole screen shares one consistent, elegant
// green identity instead of scattered hex literals per style.
const colors = {
  primary: '#1B5E20',
  primaryMuted: '#E8F1E9',
  textPrimary: '#1C1C1C',
  textSecondary: '#8A8F8B',
  background: '#F7F8F7',
  cardBorder: '#EFF1EF',
};

const CARD_SHADOW = {
  elevation: 2,
  shadowColor: '#0B1F12',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  headerWrap: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 24,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center' },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '500' },
  name: { color: '#fff', fontSize: 23, fontWeight: '700', marginTop: 3 },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 5 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: { flexGrow: 1, paddingBottom: 30 },

  registerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  registerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  registerTitle: { fontSize: 16.5, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  registerSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },

  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    ...CARD_SHADOW,
  },
  qrTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryMuted,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 9,
  },
  statusPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 6 },
  statusText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  enlargeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  enlargeText: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '500' },
  qrPreview: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  statusCard: { borderRadius: 20, borderWidth: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start' },

  lockedCard: { backgroundColor: '#FFFBEF', borderColor: '#F5E7BC' },
  lockIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBF1CE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  restrictedTitle: { color: '#946800', fontSize: 16.5, fontWeight: '700' },
  pendingSubText: { fontSize: 13, color: '#A87F1E', marginTop: 4, lineHeight: 19 },
  pendingBadge: {
    backgroundColor: '#F5E7BC',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#C99A1E', marginRight: 6 },
  pendingBadgeText: { color: '#946800', fontWeight: '700', fontSize: 12.5 },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A9720B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 13,
    alignSelf: 'flex-start',
  },
  renewBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },

  rejectedCard: { backgroundColor: '#FDF3F2', borderColor: '#F5CFC9' },
  rejectedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBDFDB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rejectedTitle: { color: '#B3261E', fontSize: 16.5, fontWeight: '700' },
  rejectedSubText: { fontSize: 13, color: '#8A362F', marginTop: 4, lineHeight: 19 },
  resubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B3261E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 13,
    alignSelf: 'flex-start',
  },
  resubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  contactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBDFDB',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
    maxWidth: '100%',
  },
  contactBadgeText: { color: '#8A362F', fontWeight: '600', fontSize: 11.5, flexShrink: 1 },

  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 18, ...CARD_SHADOW },
  kpiLabel: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '600' },
  kpiValue: { fontSize: 26, color: colors.primary, fontWeight: '800', marginTop: 6 },
  kpiSub: { fontSize: 10, color: '#B0B4B1', marginTop: 4 },

  chartCard: { backgroundColor: '#fff', borderRadius: 20, ...CARD_SHADOW },
  chartTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  chartLoadingText: { fontSize: 12, color: '#B0B4B1', textAlign: 'center', paddingVertical: 30 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: CHART_MAX_BAR_HEIGHT + 40 },
  chartBarWrap: { alignItems: 'center', flex: 1 },
  chartValueLabel: { fontSize: 9, color: colors.textSecondary, marginBottom: 4 },
  chartBar: { width: 9, borderRadius: 5 },
  chartDayLabel: { fontSize: 10.5, color: colors.textSecondary, marginTop: 8, fontWeight: '600' },

  footerDividerLine: { height: 1, backgroundColor: colors.cardBorder, marginTop: 18, marginBottom: 14 },
  footerStatsRow: { flexDirection: 'row', alignItems: 'center' },
  footerStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  footerStatIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerStatLabel: { fontSize: 10.5, color: colors.textSecondary },
  footerStatValue: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  footerVerticalDivider: { width: 1, height: 30, backgroundColor: colors.cardBorder, marginHorizontal: 12 },
});