import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';
import QRModal from '../components/QRModal';

export default function HomeScreen() {
  const [now, setNow] = useState(new Date()); 
  const [qrOpen, setQrOpen] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const fetchProfileData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch('http://192.168.18.10:5000/api/student/profile/202304639');
      const data = await response.json();
      setStudentData(data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // LOGOUT 
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out of LibraPass?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: () => console.log("User logged out") },
    ]);
  };

  useEffect(() => {
    fetchProfileData(true);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const refreshInterval = setInterval(() => fetchProfileData(false), 240000); 

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
    };
  }, []);

  if (loading) return <ActivityIndicator size="large" style={{flex:1}} color="#1B5E20" />;

  const isApproved = studentData?.status === 'approved';

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
        <View style={{ height: 40 }} />
        
        <TouchableOpacity
          activeOpacity={isApproved ? 0.85 : 1}
          onPress={() => isApproved && setQrOpen(true)}
          style={[styles.qrCard, !isApproved && styles.lockedCard]}
        >
          {isApproved ? (
            <>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.qrTitle}>Present at entrance to log entry!</Text>
                <Text style={styles.statusText}>Status: {studentData?.status}</Text>
                <View style={styles.enlargeContainer}>
                  <Ionicons name="expand-outline" size={14} color="#666" />
                  <Text style={styles.enlargeText}>Tap to enlarge</Text>
                </View>
              </View>
              <View style={styles.qrPreview}>
                <QRCode value={studentData?.qr_code || "NA"} size={85} color="#1B5E20" />
              </View>
            </>
          ) : (
            <View style={styles.restrictedContainer}>
              <Ionicons name="lock-closed" size={32} color="#D48806" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.qrTitle, { color: '#856404' }]}>Access Restricted</Text>
                <Text style={{ fontSize: 12, color: '#856404' }}>Pending admin approval.</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {isApproved && (
        <QRModal visible={qrOpen} onClose={() => setQrOpen(false)} value={studentData?.qr_code} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9F8' },
  headerWrap: { 
    backgroundColor: '#1B5E20', 
    borderBottomLeftRadius: 28, 
    borderBottomRightRadius: 28, 
    paddingBottom: 25 
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  greeting: { color: '#E8F5E9', fontSize: 13 },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 2 },
  dateText: { color: '#A5D6A7', fontSize: 12, marginTop: 4 },
  logoutBtn: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  qrCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 22, 
    elevation: 3 
  },
  lockedCard: { backgroundColor: '#FFF9E6', borderColor: '#FFE58F', borderWidth: 1 },
  qrTitle: { color: '#333', fontSize: 16, fontWeight: '700' },
  statusText: { color: '#888', fontSize: 13, marginTop: 4 },
  enlargeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  enlargeText: { color: '#666', fontSize: 12, fontWeight: '500' },
  qrPreview: { 
    padding: 8, 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#F0F0F0' 
  },
  restrictedContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 15 },
});