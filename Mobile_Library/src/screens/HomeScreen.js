import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import QRModal from '../components/QRModal';

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

export default function HomeScreen({ navigation }) {
  const [now, setNow] = useState(new Date());
  const [qrOpen, setQrOpen] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false);
  const [analytics, setAnalytics] = useState(null);
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

      // Standardized IP endpoints, change depends on your IPv4
      const response = await fetch(
        `http://192.168.1.54:5000/api/student/profile/${student.student_number}`,
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

  // Live personal + library-wide analytics for the dashboard cards/chart.
  const fetchAnalytics = async () => {
    try {
      const storedStudent = await AsyncStorage.getItem('student');
      if (!storedStudent) return;
      const student = JSON.parse(storedStudent);

      const response = await fetch(
        `http://192.168.1.54:5000/api/student/analytics/${student.student_number}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await AsyncStorage.removeItem('student');
          navigation.replace('Login');
        },
      },
    ]);
  };

  useEffect(() => {
    fetchProfileData(true);
    fetchAnalytics();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    // Checks backend approval status + analytics updates every 10 seconds automatically
    const refreshInterval = setInterval(() => {
      fetchProfileData(false);
      fetchAnalytics();
    }, 10000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const isApproved = studentData?.status === 'approved';
  // Display the restriction view if the status is explicitly 'pending' OR if data exists but isn't approved yet
  const isPending = studentData && !isApproved;
  const isNotRegistered = fetched && !studentData;

  const maxChartHours = analytics
    ? Math.max(1, ...analytics.weekly_activity.map((w) => w.hours))
    : 1;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting(now)}</Text>
            <Text style={styles.name}>{studentData?.full_name || 'Student'}</Text>
            <Text style={styles.dateText}>{formatDateTime(now)}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={26} color="#1B5E20" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ height: 24 }} />

        {/* NOT REGISTERED */}
        {isNotRegistered && (
          <View style={styles.registerCard}>
            <View style={styles.registerIconWrap}>
              <Ionicons name="person-add-outline" size={36} color="#1B5E20" />
            </View>
            <Text style={styles.registerTitle}>No Library Account Found</Text>
            <Text style={styles.registerSub}>
              Register your student profile to access the library and get your QR pass.
            </Text>
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerBtnText}>Register Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* PENDING APPROVAL - MATCHING IMAGE DESIGN EXACTLY */}
        {isPending && (
          <View style={[styles.qrCard, styles.lockedCard]}>
            <View style={styles.restrictedContainer}>
              <View style={styles.lockIconWrap}>
                <Ionicons name="time-outline" size={28} color="#7F6000" />
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

        {/* APPROVED — DASHBOARD ANALYTICS + QR (QR UNTOUCHED) */}
        {isApproved && (
          <>
            {/* LIVE OCCUPANCY + TOTAL VISITS */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Live Occupancy</Text>
                <Text style={styles.kpiValue}>{analytics ? analytics.current_occupancy : '--'}</Text>
                <Text style={styles.kpiSub}>currently inside the library</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Visits</Text>
                <Text style={styles.kpiValue}>{analytics ? analytics.total_visits : '--'}</Text>
                <Text style={styles.kpiSub}>all-time</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />

            {/* QR CARD — unchanged */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setQrOpen(true)}
              style={styles.qrCard}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.qrTitle}>Present at entrance to log entry!</Text>
                <Text style={styles.statusText}>Status: Approved</Text>
                <View style={styles.enlargeContainer}>
                  <Ionicons name="expand-outline" size={14} color="#666" />
                  <Text style={styles.enlargeText}>Tap to enlarge</Text>
                </View>
              </View>
              <View style={styles.qrPreview}>
                <QRCode value={studentData?.qr_code || 'NA'} size={85} color="#1B5E20" />
              </View>
            </TouchableOpacity>

            <View style={{ height: 16 }} />

            {/* LIBRARY ACTIVITY CHART + FOOTER STATS */}
            <View style={styles.chartCard}>
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
                            { height: barHeight, backgroundColor: item.hours > 0 ? '#1B5E20' : '#E0E0E0' },
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
                  <Ionicons name="calendar-outline" size={16} color="#1B5E20" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.footerStatLabel}>Frequent Visit</Text>
                    <Text style={styles.footerStatValue}>{analytics ? analytics.frequent_day : '--'}</Text>
                  </View>
                </View>
                <View style={styles.footerVerticalDivider} />
                <View style={styles.footerStatItem}>
                  <Ionicons name="time-outline" size={16} color="#1B5E20" />
                  <View style={{ marginLeft: 8 }}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9F8' },
  headerWrap: { backgroundColor: '#1B5E20', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 25 },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  greeting: { color: '#E8F5E9', fontSize: 13 },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  dateText: { color: '#A5D6A7', fontSize: 12, marginTop: 4 },
  logoutBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },

  // Register Card
  registerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  registerIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  registerTitle: { fontSize: 17, fontWeight: '700', color: '#1B1B1B', textAlign: 'center', marginBottom: 8 },
  registerSub: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1B5E20', paddingVertical: 13, paddingHorizontal: 28, borderRadius: 14 },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Approved QR Layout Styles
  qrCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 22, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  qrTitle: { color: '#333', fontSize: 16, fontWeight: '700' },
  statusText: { color: '#888', fontSize: 13, marginTop: 4 },
  enlargeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  enlargeText: { color: '#666', fontSize: 12, fontWeight: '500' },
  qrPreview: { padding: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F0F0F0' },

  // Restricted Pending Stylesheet Override
  lockedCard: { backgroundColor: '#FFFDF0', borderColor: '#FCEFBC', borderWidth: 1 },
  restrictedContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  lockIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF9C4', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  restrictedTitle: { color: '#7F6000', fontSize: 18, fontWeight: 'bold' },
  pendingSubText: { fontSize: 14, color: '#B8860B', marginTop: 4, lineHeight: 20 },
  pendingBadge: { backgroundColor: '#FCEFBC', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, marginTop: 12 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4A017', marginRight: 6 },
  pendingBadgeText: { color: '#7F6000', fontWeight: '700', fontSize: 13 },

  // KPI cards (Live Occupancy / Total Visits)
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  kpiLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  kpiValue: { fontSize: 28, color: '#1B5E20', fontWeight: '800', marginTop: 6 },
  kpiSub: { fontSize: 10, color: '#aaa', marginTop: 4 },

  // Library Activity chart card
  chartCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#1B1B1B', marginBottom: 16 },
  chartLoadingText: { fontSize: 12, color: '#aaa', textAlign: 'center', paddingVertical: 30 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: CHART_MAX_BAR_HEIGHT + 40 },
  chartBarWrap: { alignItems: 'center', flex: 1 },
  chartValueLabel: { fontSize: 9, color: '#666', marginBottom: 4 },
  chartBar: { width: 10, borderRadius: 5 },
  chartDayLabel: { fontSize: 11, color: '#888', marginTop: 8, fontWeight: '600' },

  footerDividerLine: { height: 1, backgroundColor: '#EEE', marginTop: 20, marginBottom: 14 },
  footerStatsRow: { flexDirection: 'row', alignItems: 'center' },
  footerStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  footerStatLabel: { fontSize: 11, color: '#888' },
  footerStatValue: { fontSize: 14, fontWeight: '700', color: '#1B1B1B', marginTop: 2 },
  footerVerticalDivider: { width: 1, height: 32, backgroundColor: '#EEE', marginHorizontal: 12 },
});