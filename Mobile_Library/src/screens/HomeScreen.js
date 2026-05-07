import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { BarChart } from 'react-native-chart-kit';
import { colors } from '../theme/colors';
import QRModal from '../components/QRModal';

const screenWidth = Dimensions.get('window').width;

function formatDateTime(d) {
  const date = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',

  });
  return `${date} • ${time}`;
}

function getGreeting(d) {
  const hour = d.getHours();
  if (hour < 12) {
    return 'Good Morning!';
  }
  if (hour < 18) {
    return 'Good Afternoon!';
  }
  if (hour >= 18) {
    return 'Good Evening!';
  }
}

export default function HomeScreen() {
  const [now, setNow] = useState(new Date());
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [{ data: [3, 6, 4, 5, 7, 2] }],
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting(now)}</Text>
            <Text style={styles.name}>James Angelo L.</Text>
            <Text style={styles.dateText}>{formatDateTime(now)}</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
        </View>
      </SafeAreaView>
      
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      ><View style={{ height: 40 }} />
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { marginRight: 8 }]}>
            <Text style={styles.statLabel}>Live Occupancy</Text>
            <Text style={styles.statNumber}>1,732</Text>
            <Text style={styles.statSub}>currently inside the library</Text>
          </View>
          <View style={[styles.statCard, { marginLeft: 8 }]}>
            <Text style={styles.statLabel}>Total Visits</Text>
            <Text style={styles.statNumber}>23</Text>
            <Text style={styles.statSub}>this month</Text>
          </View>
        </View>

        {/* QR */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setQrOpen(true)}
          style={styles.qrCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.qrTitle}>Present at entrance to log entry!</Text>
            <Text style={styles.qrSub}>Tap to enlarge your QR code</Text>
            <View style={styles.tapHint}>
              <Ionicons name="expand" size={14} color={colors.primary} />
              <Text style={styles.tapHintText}>Tap to expand</Text>
            </View>
          </View>
          <View style={styles.qrPreview}>
            <QRCode value="CVSU-LIB-SOPHIA-A" size={84} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Chart */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Library Activity</Text>
          <Text style={styles.sectionSub}>Hours spent per day this week</Text>
          <BarChart
            data={chartData}
            width={screenWidth - 64}
            height={200}
            yAxisSuffix="h"
            fromZero
            withInnerLines={false}
            showBarTops={false}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(27, 94, 32, ${opacity})`,
              labelColor: () => colors.textSecondary,
              barPercentage: 0.6,
              propsForBackgroundLines: { stroke: '#EEF1EF' },
            }}
            style={{ marginLeft: -16, marginTop: 8 }}
          />
        </View>

        {/* Visit info */}
        <View style={styles.statsRow}>
          <View style={[styles.infoCard, { marginRight: 8 }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <Text style={styles.infoLabel}>Frequent Visit Day</Text>
            <Text style={styles.infoValue}>Tuesday</Text>
          </View>
          <View style={[styles.infoCard, { marginLeft: 8 }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="time" size={18} color={colors.primary} />
            </View>
            <Text style={styles.infoLabel}>Avg Stay Duration</Text>
            <Text style={styles.infoValue}>2 - 3 Hrs</Text>
          </View>
        </View>

        <View style={{ height: 2 }} />
      </ScrollView>

      <QRModal visible={qrOpen} onClose={() => setQrOpen(false)} value="CVSU-LIB-SOPHIA-A" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 24,
    zIndex: 2,
    elevation: 3,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  greeting: { color: '#D8EAD9', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  dateText: { color: '#BFD9C2', fontSize: 12, marginTop: 6 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1, marginTop: -28, backgroundColor: 'transparent' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  statNumber: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  statSub: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },

  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  qrTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  qrSub: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  tapHint: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  tapHintText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  qrPreview: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  infoCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F1E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  infoValue: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 4,
  },
});
