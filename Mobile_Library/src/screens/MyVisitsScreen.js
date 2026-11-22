import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { BRAND, HEADER_RADIUS } from '../theme/brand';
import { getResponsive } from '../theme/responsive';
import { API_URL } from '../config';
import { authHeaders } from '../utils/studentAuth';
import VisitRow from '../components/VisitRow';
import BottomNav from '../components/BottomNav';

// "My Visits": every library entry/exit of this student or faculty member for the current
// semester, newest first. A new semester starts a fresh list (older visits stay saved).
export default function MyVisitsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);

  const [visits, setVisits] = useState([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Gets this student's (or faculty member's) visits from the server.
  const loadVisits = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('student');
      if (!stored) return;
      const account = JSON.parse(stored);
      // Faculty are saved with user_type: 'faculty' and an employee_id, and have their own route.
      const url = account.user_type === 'faculty'
        ? `${API_URL}/api/faculty/visits/${account.employee_id}`
        : `${API_URL}/api/student/visits/${account.student_number}`;
      const res = await fetch(url, { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Could not load your visits.');
        return;
      }
      setVisits(Array.isArray(data.visits) ? data.visits : []);
      setPeriodLabel(data.period_label || '');
      setError('');
    } catch {
      setError('Needs internet connection. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Pull down to refresh.
  const onRefresh = () => { setRefreshing(true); loadVisits(); };

  // Short summary above the list.
  const summary = visits.length === 1 ? '1 visit' : `${visits.length} visits`;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={[styles.headerInner, { paddingHorizontal: layout.horizontalPadding }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Visits</Text>
          </View>
          <Text style={styles.headerSub}>
            {periodLabel ? `${periodLabel}  ·  ` : ''}your entry and exit records
          </Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1 }}>
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.log_id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={{
            paddingHorizontal: layout.horizontalPadding,
            paddingTop: 16,
            paddingBottom: 24,
            width: '100%',
            maxWidth: layout.contentWidth + layout.horizontalPadding * 2,
            alignSelf: 'center',
          }}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : visits.length > 0 ? (
              <Text style={styles.summary}>{summary} this semester</Text>
            ) : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No visits yet this semester.</Text>
                <Text style={styles.emptyHint}>Scan your QR pass at the library entrance to log a visit.</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <View style={[
              styles.cardSlice,
              index === 0 && styles.cardTop,
              index === visits.length - 1 && styles.cardBottom,
            ]}>
              <VisitRow visit={item} divider={index < visits.length - 1} />
            </View>
          )}
        />
      )}

      {/* Footer: My Visits belongs to Home, so Home stays highlighted. Tapping Home goes back to it. */}
      <BottomNav active="HomeScreen" current="MyVisits" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header — same deep green / rounded bottom as Settings.
  headerWrap: {
    backgroundColor: BRAND.deep,
    borderBottomLeftRadius: HEADER_RADIUS,
    borderBottomRightRadius: HEADER_RADIUS,
    overflow: 'hidden',
  },
  headerInner: { paddingBottom: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 12 },

  summary: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, marginLeft: 4 },

  // The list looks like one white card: each row is a slice of it.
  cardSlice: { backgroundColor: '#fff', paddingHorizontal: 16, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E4E4E7' },
  cardTop: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1 },
  cardBottom: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderBottomWidth: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FBDFDB', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12.5, color: '#B3261E' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  emptyHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 30 },
});