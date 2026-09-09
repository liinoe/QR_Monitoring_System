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
import { colors } from '../theme/colors';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { API_URL } from '../config';

export default function SettingsScreen({ navigation }) {
     const [studentData, setStudentData] = useState(null);
     const [changePasswordOpen, setChangePasswordOpen] = useState(false);

     useEffect(() => {
     const fetchProfile = async () => {
          try {
          const stored = await AsyncStorage.getItem('student');
          if (!stored) return;
          const student = JSON.parse(stored);
          const res = await fetch(`${API_URL}/api/student/profile/${student.student_number}`);
          if (res.ok) {
               const data = await res.json();
               setStudentData(data);
          }
          } catch (err) {
          console.error('Error loading profile for settings:', err);
          }
     };
     fetchProfile();
     }, []);

     const handleLogout = () => {
     Alert.alert('Logout', 'Are you sure you want to log out?', [
          { text: 'Cancel', style: 'cancel' },
          {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
               await AsyncStorage.removeItem('student');
               navigation.replace('Login');
          },
          },
     ]);
     };

     return (
     <View style={styles.root}>
          <SafeAreaView edges={['top']} style={styles.headerWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
               <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ACCOUNT */}
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.accountCard}>
               <View style={styles.avatarWrap}>
               <Ionicons name="person" size={26} color={colors.primary} />
               </View>
               <View style={{ flex: 1 }}>
               <Text style={styles.accountName}>{studentData?.full_name || 'Student'}</Text>
               <Text style={styles.accountSub}>
               {studentData?.student_number || '--'}
               {studentData?.program ? `  •  ${studentData.program}` : ''}
               </Text>
               <Text style={styles.accountEmail}>{studentData?.email || ''}</Text>
               </View>
          </View>

          {/* SECURITY */}
          <Text style={styles.sectionLabel}>Security</Text>
          <View style={styles.card}>
               <TouchableOpacity
               style={styles.row}
               onPress={() => setChangePasswordOpen(true)}
               activeOpacity={0.6}
               >
               <View style={styles.rowIconWrap}>
               <Ionicons name="key-outline" size={18} color={colors.primary} />
               </View>
               <Text style={styles.rowLabel}>Change Password</Text>
               <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
               </TouchableOpacity>
          </View>

          {/* LOGOUT lives in the fixed footer below, not here — see root return */}
          </ScrollView>

          <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
               <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
               <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          </View>

          <ChangePasswordModal
          visible={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
          studentNumber={studentData?.student_number}
          />
     </View>
     );
}

const styles = StyleSheet.create({
     root: { flex: 1, backgroundColor: colors.background },
     headerWrap: {
     backgroundColor: colors.primary,
     paddingHorizontal: 20,
     paddingBottom: 20,
     flexDirection: 'row',
     alignItems: 'center',
     },
     backBtn: { marginRight: 12, marginTop: 4 },
     headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },

     scrollContent: { padding: 20, paddingBottom: 40 },

     sectionLabel: {
     fontSize: 11,
     fontWeight: '700',
     color: colors.textSecondary,
     textTransform: 'uppercase',
     letterSpacing: 0.5,
     marginBottom: 8,
     marginTop: 20,
     },

     card: {
     backgroundColor: '#fff',
     borderRadius: 16,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.06,
     shadowRadius: 8,
     elevation: 2,
     },

     accountCard: {
     backgroundColor: '#fff',
     borderRadius: 16,
     padding: 16,
     flexDirection: 'row',
     alignItems: 'center',
     gap: 14,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.06,
     shadowRadius: 8,
     elevation: 2,
     },

     avatarWrap: {
     width: 44,
     height: 44,
     borderRadius: 22,
     backgroundColor: '#E8F5E9',
     alignItems: 'center',
     justifyContent: 'center',
     },

     accountName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
     accountSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
     accountEmail: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },

     row: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 16,
     paddingHorizontal: 16,
     gap: 12,
     },
     rowIconWrap: {
     width: 32,
     height: 32,
     borderRadius: 16,
     backgroundColor: '#E8F5E9',
     alignItems: 'center',
     justifyContent: 'center',
     },
     rowLabel: { flex: 1, fontSize: 14.5, color: colors.textPrimary, fontWeight: '500' },

     logoutBtn: {
     width: '100%',
     height: 54,
     borderRadius: 14,
     backgroundColor: '#fffff',
     borderWidth: 1,
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     gap: 8,
     },
     logoutText: { color: '#B91C1C', fontSize: 15, fontWeight: '700' },

     footer: {
     paddingHorizontal: 20,
     paddingTop: 12,
     paddingBottom: 24,
     backgroundColor: colors.background,
     borderTopWidth: 1,
     borderTopColor: '#EEE',
     },
});