import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import QRModal from '../components/QRModal';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';
import { BRAND, HEADER_RADIUS } from '../theme/brand';
import { QLessMark, ScanFrame, BrandPattern } from '../components/QLessLogo';
import { getRejectionGuide } from '../utils/rejection';
import { authHeaders, clearSavedLogin } from '../utils/studentAuth';
import { useAppDialog } from '../components/AppDialog';
import VisitRow from '../components/VisitRow';

// "What does this mean?" text for each card, shown when the (i) icon is tapped.
// Explains where each number comes from, in plain words.
const CARD_INFO = {
  headcount: {
    title: 'Real-Time Headcount',
    message:
      'How many people are inside the library right now: students and guests who have ' +
      'scanned in but not yet scanned out. It refreshes every few seconds.',
  },
  totalVisits: {
    title: 'Total Visits',
    message:
      'How many times YOU entered the library this semester. Every scan-in at the ' +
      'entrance counts as one visit.',
  },
  peakHours: {
    title: 'Peak Hours',
    message:
      'Each bar is the number of people (students and guests) who scanned in during that ' +
      'hour, added up over this semester so far.\n\n' +
      'Gold bars = the busiest 2-hour period. "Right now" compares how many are inside now ' +
      "with the library's usual busiest time.\n\n" +
      'Use it to find a quieter time to visit.',
  },
  activity: {
    title: 'Your Library Activity',
    message:
      'Your own visits this semester. Each bar is how long you usually stay on that day ' +
      'of the week (your average hours).\n\n' +
      'Frequent Visit = the day you visit most often. Avg. Stay Duration = your usual stay.\n\n' +
      "Visits closed by the system's automatic logout are not counted in the hours, since " +
      'your real exit time is unknown.',
  },
};

// Small (i) button placed beside a card title; opens that card's explanation.
function InfoButton({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} accessibilityLabel="What does this mean?">
      <Ionicons name="information-circle-outline" size={17} color="#9AA19C" />
    </TouchableOpacity>
  );
}

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

// ---- Peak hours helpers ----
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
const hourRange = (h, span = 1) => {
  const fmt = (x) => `${((x + 11) % 12) + 1} ${x < 12 ? 'AM' : 'PM'}`;
  return `${fmt(h)}–${fmt(h + span)}`;
};

// The smallest crowd that can count as "Busy". Without this, a new system (or a
// quiet semester) with a tiny usual peak would call 2 people "Busy".
// Change it to fit the library (about how many people make it feel full).
const MIN_BUSY_BASELINE = 30;

// How busy it is right now, compared with this library's usual peak
// (or the minimum baseline above, whichever is bigger).
const getCrowdLevel = (current, peakAvg) => {
  if (current == null) return null;
  const baseline = Math.max(peakAvg || 0, MIN_BUSY_BASELINE);
  const ratio = current / baseline;
  if (ratio < 0.4) return { label: 'Not busy', color: '#1B5E20', bg: '#E8F1E9' };
  if (ratio < 0.8) return { label: 'Moderate', color: '#946800', bg: '#FBF1CE' };
  return { label: 'Busy', color: '#B3261E', bg: '#FBDFDB' };
};

const PEAK_BAR_MAX = 70;

function PeakHoursCard({ data, currentOccupancy, isOffline, now, width, padding, onInfo }) {
  const currentHour = now.getHours();

  let body;
  if (isOffline) {
    body = (
      <View style={styles.chartOfflineWrap}>
        <Ionicons name="cloud-offline-outline" size={22} color="#B0B4B1" />
        <Text style={styles.chartOfflineText}>Cannot be viewed — needs internet connection</Text>
      </View>
    );
  } else if (!data) {
    body = <Text style={styles.chartLoadingText}>Loading peak hours...</Text>;
  } else if (data.peak_start == null) {
    body = <Text style={styles.chartLoadingText}>Not enough visit data yet — check back after a few library days.</Text>;
  } else {
    // Same numbers as the web Analytics page: check-ins this month,
    // peak = the 2-hour window with the most check-ins.
    const maxCheckins = Math.max(1, ...data.hours.map((x) => x.checkins));
    // Open from 7:00 AM until the 5:30 PM cut-off (times come from the server).
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMin = data.open_minutes ?? data.open_hour * 60;
    const cutoffMin = data.cutoff_minutes ?? data.close_hour * 60;
    const isOpenNow = nowMinutes >= openMin && nowMinutes < cutoffMin;
    const crowd = isOpenNow ? getCrowdLevel(currentOccupancy, data.peak_avg_inside) : null;
    // "Peak" label goes on the busiest bar inside the busiest window (not on an empty one).
    const peakBarHour = data.hours
      .filter((x) => x.hour >= data.peak_start && x.hour < data.peak_end)
      .reduce((a, b) => (b.checkins > a.checkins ? b : a), { hour: data.peak_start, checkins: -1 }).hour;

    body = (
      <>
        <View style={styles.peakNowRow}>
          <Text style={styles.peakNowLabel}>Right now</Text>
          {isOpenNow ? (
            crowd && (
              <View style={[styles.crowdPill, { backgroundColor: crowd.bg }]}>
                <View style={[styles.crowdDot, { backgroundColor: crowd.color }]} />
                <Text style={[styles.crowdText, { color: crowd.color }]}>
                  {crowd.label} · {currentOccupancy} inside
                </Text>
              </View>
            )
          ) : (
            <View style={[styles.crowdPill, { backgroundColor: '#EFF1EF' }]}>
              <Text style={[styles.crowdText, { color: '#8A8F8B' }]}>
                {nowMinutes < openMin ? 'Opens at 7:00 AM' : 'Closed · past 5:30 PM cut-off'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.peakChartRow}>
          {data.hours.map((item) => {
            const isPeak = item.hour >= data.peak_start && item.hour < data.peak_end && item.checkins > 0;
            const isPeakLabel = item.hour === peakBarHour;
            const isNow = isOpenNow && item.hour === currentHour;
            const barHeight = item.checkins > 0 ? Math.max(6, (item.checkins / maxCheckins) * PEAK_BAR_MAX) : 4;
            const barColor = isPeak ? BRAND.gold : isNow ? BRAND.deep : '#B9D3BC';
            return (
              <View key={item.hour} style={styles.peakBarWrap}>
                <Text style={[styles.peakTopLabel, isNow && { color: BRAND.deep }, isPeak && !isNow && { color: '#A9720B' }]}>
                  {isNow ? 'Now' : isPeakLabel ? 'Peak' : ''}
                </Text>
                <View style={[styles.peakBar, { height: barHeight, backgroundColor: barColor }]} />
                <Text style={[styles.peakHourLabel, (isNow || isPeak) && styles.peakHourLabelActive]}>
                  {hourLabel(item.hour)}
                </Text>
              </View>
            );
          })}
        </View>

        {data.total_checkins < 10 && (
          <Text style={styles.peakLowData}>
            Based on only {data.total_checkins} check-in{data.total_checkins === 1 ? '' : 's'} this semester — this gets more accurate as more students visit.
          </Text>
        )}

        <View style={styles.footerDividerLine} />

        <View style={styles.footerStatsRow}>
          <View style={styles.footerStatItem}>
            <View style={[styles.footerStatIconWrap, { backgroundColor: BRAND.goldSoft }]}>
              <Ionicons name="people-outline" size={15} color="#A9720B" />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.footerStatLabel}>Busiest</Text>
              <Text style={styles.footerStatValue}>{hourRange(data.peak_start, 2)}</Text>
            </View>
          </View>
          <View style={styles.footerVerticalDivider} />
          <View style={styles.footerStatItem}>
            <View style={styles.footerStatIconWrap}>
              <Ionicons name="leaf-outline" size={15} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.footerStatLabel}>Quietest</Text>
              <Text style={styles.footerStatValue}>{data.quiet_start != null ? hourRange(data.quiet_start, data.quiet_end - data.quiet_start) : '—'}</Text>
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <View style={[styles.chartCard, { width, padding }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.chartTitle, { marginBottom: 0 }]}>Peak Hours</Text>
        <InfoButton onPress={onInfo} />
      </View>
      <Text style={styles.peakSub}>Library-wide check-ins per hour · this semester</Text>
      {body}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  // Height of the phone's bottom navigation bar, so nothing hides behind it.
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [now, setNow] = useState(new Date());
  // Pop-up used by the (i) buttons on the cards.
  const { dialog, showDialog } = useAppDialog();
  const showInfo = (key) => showDialog({ tone: 'info', ...CARD_INFO[key], buttons: [{ text: 'Got it', style: 'primary' }] });
  const [qrOpen, setQrOpen] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
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
        { signal: controller.signal, headers: await authHeaders() }
      );

      if (response.status === 401 || response.status === 403) {
        // Login pass missing or expired: log in again.
        await clearSavedLogin();
        navigation.replace('Login');
        return;
      }

      if (response.status === 404) {
        // The saved account no longer exists on the server (e.g. it was deleted,
        // or the app now points to a different database): forget the saved
        // login and send the student to Login instead of showing an empty Home.
        await clearSavedLogin();
        navigation.replace('Login');
        return;
      } else if (response.ok) {
        const data = await response.json();
        setStudentData(data);
        // Cached so the QR pass — which is static and doesn't need a live
        // connection to be scanned — still displays if the app is opened
        // with no internet.
        AsyncStorage.setItem('cached_profile', JSON.stringify(data)).catch(() => {});
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
        `${API_URL}/api/student/analytics/${student.student_number}`,
        { headers: await authHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchPeakHours = async () => {
    try {
      const response = await fetch(`${API_URL}/api/library/peak-hours`);
      if (response.ok) setPeakHours(await response.json());
    } catch (error) {
      console.error('Error fetching peak hours:', error);
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
    // Show the last-known QR/profile immediately (before the network call
    // resolves, or even if it never does because we're offline right now).
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('cached_profile');
        if (cached) setStudentData(JSON.parse(cached));
      } catch (e) {
        // ignore — falls through to the normal fetch below
      }
    })();

    fetchProfileData(true);
    fetchAnalytics();
    fetchCurrentPeriod();
    fetchPeakHours();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    const refreshInterval = setInterval(() => {
      fetchProfileData(false);
      fetchAnalytics();
      fetchCurrentPeriod();
    }, 10000);

    // Peak hours are based on weeks of history, so they barely change —
    // refreshing every 5 minutes is plenty.
    const peakInterval = setInterval(fetchPeakHours, 5 * 60 * 1000);

    // isInternetReachable can briefly be `null` while the OS is still
    // checking — only treat an explicit false (from either field) as
    // offline, so we don't flash the banner on every check.
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
      clearInterval(peakInterval);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      unsubscribeNetInfo();
    };
  }, []);

  // Coming back to Home (e.g. after Renew or Register Again): refresh right away
  // so the new "pending" status shows without waiting for the 10-second refresh.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfileData(false);
      fetchCurrentPeriod();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const isApproved = studentData?.status === 'approved';
  const isRejected = studentData?.status === 'rejected';
  const isDeactivated = studentData?.status === 'deactivated';
  // The semester ended: the QR pass expired; renewal opens when the next semester starts.
  const isExpired = studentData?.status === 'expired';
  // What to tell a rejected student, based on the admin's reason.
  const rejectionGuide = getRejectionGuide(studentData?.status_reason, currentPeriod);

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
        <BrandPattern size={200} opacity={0.07} style={{ top: -30, right: -60 }} />
        <View style={[styles.brandRow, { paddingHorizontal: layout.horizontalPadding }]}>
          <QLessMark size={22} tone="dark" />
          <Text style={styles.brandText}>
            Q<Text style={{ color: BRAND.goldLight }}>Less</Text>
          </Text>
        </View>
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

      {isOffline && (
        <View style={[styles.offlineBanner, { paddingHorizontal: layout.horizontalPadding }]}>
          <Ionicons name="cloud-offline-outline" size={15} color="#946800" />
          <Text style={styles.offlineBannerText}>
            You're offline — your QR pass still works, but live library data can't be updated.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: layout.horizontalPadding, alignItems: 'center', paddingBottom: 30 + insets.bottom },
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

        {/* SEMESTER ENDED — pass expired; nothing to do until the next semester starts */}
        {isExpired && (
          <View style={[styles.statusCard, styles.lockedCard, { padding: layout.cardPadding, width: layout.contentWidth }]}>
            <View style={styles.statusRow}>
              <View style={styles.lockIconWrap}>
                <Ionicons name="calendar-outline" size={24} color="#946800" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictedTitle}>Semester Ended</Text>
                <Text style={styles.pendingSubText}>
                  Your QR pass{studentData?.registered_period ? ` for ${studentData.registered_period}` : ''} expired when the semester ended. You can renew here once the next semester starts.
                </Text>
                <View style={styles.pendingBadge}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.pendingBadgeText}>Renewal opens next semester</Text>
                </View>
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
                {/* Guidance depends on the reason (see utils/rejection.js) */}
                <Text style={styles.rejectedSubText}>{rejectionGuide.message}</Text>
                {!!studentData?.status_reason && rejectionGuide.kind !== 'other' && (
                  <Text style={styles.rejectedReason}>Reason: {studentData.status_reason}</Text>
                )}
                {/* Opens the Register form already filled with their details */}
                <TouchableOpacity
                  style={styles.resubmitBtn}
                  onPress={() => navigation.navigate('Register', { mode: 'resubmit' })}
                  activeOpacity={0.88}
                >
                  <Text style={styles.resubmitBtnText}>{rejectionGuide.buttonLabel}</Text>
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
            {/* One label for the whole dashboard: every card below covers this
                semester, except the headcount, which is marked "Live". */}
            {!!(analytics?.period_label || peakHours?.period_label) && (
              <View style={[styles.periodBanner, { width: layout.contentWidth }]}>
                <Ionicons name="calendar-outline" size={14} color={BRAND.green} />
                <Text style={styles.periodBannerText}>
                  <Text style={styles.periodBannerStrong}>{analytics?.period_label || peakHours?.period_label}</Text>
                  {'  ·  '}stats for this semester
                </Text>
              </View>
            )}

            <View style={[styles.kpiRow, { width: layout.contentWidth }]}>
              <View style={styles.kpiCard}>
                <View style={styles.titleRow}>
                  <Text style={styles.kpiLabel}>Real-Time Headcount</Text>
                  <InfoButton onPress={() => showInfo('headcount')} />
                </View>
                {isOffline ? (
                  <>
                    <Ionicons name="cloud-offline-outline" size={20} color="#B0B4B1" style={{ marginTop: 8 }} />
                    <Text style={styles.kpiOfflineText}>Needs internet connection</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.kpiValue}>{analytics ? analytics.current_occupancy : '--'}</Text>
                    <View style={styles.livePill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.livePillText}>Live · inside right now</Text>
                    </View>
                  </>
                )}
              </View>
              <View style={styles.kpiCard}>
                <View style={styles.titleRow}>
                  <Text style={styles.kpiLabel}>Total Visits</Text>
                  <InfoButton onPress={() => showInfo('totalVisits')} />
                </View>
                {isOffline ? (
                  <>
                    <Ionicons name="cloud-offline-outline" size={20} color="#B0B4B1" style={{ marginTop: 8 }} />
                    <Text style={styles.kpiOfflineText}>Needs internet connection</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.kpiValue}>{analytics ? analytics.total_visits : '--'}</Text>
                    <Text style={styles.kpiSub}>your visits this semester</Text>
                  </>
                )}
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
              {/* QR sits inside the same scan brackets as the logo */}
              <ScanFrame
                size={Math.min(80, layout.contentWidth * 0.19) + 28}
                arm={18}
                thickness={3}
                radius={8}
                color={BRAND.gold}
              >
                <QRCode
                  value={studentData?.qr_code || 'NA'}
                  size={Math.min(80, layout.contentWidth * 0.19)}
                  color={BRAND.deep}
                />
              </ScanFrame>
            </TouchableOpacity>

            <View style={{ height: 14 }} />

            {/* PEAK HOURS — library-wide, promised on the Welcome slides */}
            <PeakHoursCard
              data={peakHours}
              currentOccupancy={analytics ? analytics.current_occupancy : null}
              isOffline={isOffline}
              now={now}
              width={layout.contentWidth}
              padding={layout.cardPadding}
              onInfo={() => showInfo('peakHours')}
            />

            <View style={{ height: 14 }} />

            <View style={[styles.chartCard, { width: layout.contentWidth, padding: layout.cardPadding }]}>
              <View style={styles.titleRow}>
                <Text style={[styles.chartTitle, { marginBottom: 0 }]}>Your Library Activity</Text>
                <InfoButton onPress={() => showInfo('activity')} />
              </View>
              <Text style={styles.peakSub}>Your average stay per day of the week · this semester</Text>

              {isOffline ? (
                <View style={styles.chartOfflineWrap}>
                  <Ionicons name="cloud-offline-outline" size={22} color="#B0B4B1" />
                  <Text style={styles.chartOfflineText}>Cannot be viewed — needs internet connection</Text>
                </View>
              ) : analytics ? (
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
                    <Text style={styles.footerStatValue}>{isOffline ? 'N/A' : (analytics ? analytics.frequent_day : '--')}</Text>
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
                      {isOffline ? 'N/A' : (analytics ? formatStayRange(analytics.avg_stay_hours) : '--')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ height: 14 }} />

            {/* RECENT VISITS — the student's own last 3 entries/exits; "View all" opens My Visits */}
            <View style={[styles.chartCard, { width: layout.contentWidth, padding: layout.cardPadding }]}>
              <View style={styles.titleRow}>
                <Text style={[styles.chartTitle, { marginBottom: 0 }]}>Recent Visits</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MyVisits')} hitSlop={10} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>View all</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.peakSub}>Your latest entries and exits · this semester</Text>

              {isOffline ? (
                <View style={styles.chartOfflineWrap}>
                  <Ionicons name="cloud-offline-outline" size={22} color="#B0B4B1" />
                  <Text style={styles.chartOfflineText}>Cannot be viewed — needs internet connection</Text>
                </View>
              ) : !analytics ? (
                <Text style={styles.chartLoadingText}>Loading visits...</Text>
              ) : (analytics.recent_visits || []).length === 0 ? (
                <Text style={styles.chartLoadingText}>No visits yet this semester.</Text>
              ) : (
                analytics.recent_visits.map((v, i) => (
                  <VisitRow key={v.log_id} visit={v} divider={i < analytics.recent_visits.length - 1} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {isApproved && (
        <QRModal visible={qrOpen} onClose={() => setQrOpen(false)} value={studentData?.qr_code} />
      )}

      {/* (i) explanation pop-ups */}
      {dialog}
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
    backgroundColor: BRAND.deep,
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, marginBottom: 14 },
  brandText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
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

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5E7BC',
    paddingVertical: 9,
    gap: 8,
  },
  offlineBannerText: { flex: 1, color: '#946800', fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
  kpiOfflineText: { fontSize: 11, color: '#B0B4B1', fontWeight: '600', marginTop: 6 },
  chartOfflineWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26, gap: 8 },
  chartOfflineText: { fontSize: 12, color: '#B0B4B1', textAlign: 'center' },

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
  rejectedReason: { fontSize: 11.5, color: '#A8554E', marginTop: 6, fontStyle: 'italic' },
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
  livePill: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E9E44', marginRight: 5 },
  livePillText: { fontSize: 10, color: '#8A8F8B', fontWeight: '600' },

  chartCard: { backgroundColor: '#fff', borderRadius: 20, ...CARD_SHADOW },

  peakHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  peakBasis: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  peakSub: { fontSize: 11.5, color: '#B0B4B1', marginTop: 3, marginBottom: 14 },
  peakNowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  peakNowLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  crowdPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  crowdDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  crowdText: { fontSize: 12, fontWeight: '700' },
  peakChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: PEAK_BAR_MAX + 40 },
  peakBarWrap: { alignItems: 'center', flex: 1 },
  peakTopLabel: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, marginBottom: 4, height: 12 },
  peakBar: { width: 12, borderRadius: 5 },
  peakHourLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 8 },
  peakHourLabelActive: { color: colors.textPrimary, fontWeight: '700' },
  periodBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 4 },
  periodBannerText: { fontSize: 12, color: colors.textSecondary },
  periodBannerStrong: { color: colors.textPrimary, fontWeight: '700' },
  peakLowData: { fontSize: 11, color: '#A3A8A4', lineHeight: 15, marginTop: 10 },
  // "View all ›" link on the Recent Visits card
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  // Card title with the (i) button on the right
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
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