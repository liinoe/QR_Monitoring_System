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

export default function HomeScreen({ navigation }) {
  const [now, setNow] = useState(new Date());
  const [qrOpen, setQrOpen] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [fetched, setFetched] = useState(false); 
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

      // FIX: Standardized IP endpoints across initialization threads
      const response = await fetch(
        `http://192.168.1.13:5000/api/student/profile/${student.student_number}`,
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
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    
    // Checks backend approval status updates every 10 seconds automatically
    const refreshInterval = setInterval(() => fetchProfileData(false), 10000);

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

        {/* APPROVED — DYNAMIC QR IS SHOWN HERE */}
        {isApproved && (
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

  // Lhanz's Restricted Pending Stylesheet Override
  lockedCard: { backgroundColor: '#FFFDF0', borderColor: '#FCEFBC', borderWidth: 1 },
  restrictedContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  lockIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF9C4', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  restrictedTitle: { color: '#7F6000', fontSize: 18, fontWeight: 'bold' },
  pendingSubText: { fontSize: 14, color: '#B8860B', marginTop: 4, lineHeight: 20 },
  pendingBadge: { backgroundColor: '#FCEFBC', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, marginTop: 12 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4A017', marginRight: 6 },
  pendingBadgeText: { color: '#7F6000', fontWeight: '700', fontSize: 13 },
});