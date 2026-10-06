import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';
import { PasswordRulesCheck, PasswordMatchCheck, isStrongPassword } from '../screens/RegisterScreen';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';
import { useAppDialog } from './AppDialog';

// Pop-up (opened from Settings) where a student changes their password.
// Same password rules as registration: 8+ characters, an uppercase letter,
// a lowercase letter and a number.
export default function ChangePasswordModal({ visible, onClose, studentNumber }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  // Styled pop-up for errors/success (see components/AppDialog.js).
  const { dialog, showDialog } = useAppDialog();

  // Clears the fields and closes the pop-up.
  const resetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  // "Update Password" button: checks the fields, then asks the server to change it.
  const handleSubmit = async () => {
    if (!currentPassword) {
      showDialog({ tone: 'warning', title: 'Missing Info', message: 'Please enter your current password.' });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      showDialog({
        tone: 'error',
        title: 'Weak Password',
        message: 'Your new password needs at least 8 characters, an uppercase letter, a lowercase letter, and a number.',
      });
      return;
    }
    if (newPassword === currentPassword) {
      showDialog({ tone: 'warning', title: 'Same Password', message: 'Your new password must be different from your current one.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showDialog({ tone: 'error', title: 'Password Mismatch', message: 'New password and confirm password do not match.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/student/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_number: studentNumber,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showDialog({
          tone: 'error',
          title: response.status === 401 ? 'Incorrect Password' : 'Could Not Change Password',
          message: data.message || 'Please try again.',
        });
        return;
      }

      showDialog({
        tone: 'success',
        title: 'Password Changed',
        message: 'Use your new password the next time you log in.',
        buttons: [{ text: 'Done', style: 'primary', onPress: resetAndClose }],
      });
    } catch (error) {
      console.error('Change password error:', error);
      showDialog({ tone: 'error', title: "Can't Reach the Server", message: 'Check that your phone and the server are on the same Wi-Fi.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      {/* Moves the card up when the keyboard opens so fields aren't covered */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.sheet, { maxWidth: Math.min(420, layout.contentWidth), padding: layout.cardPadding }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="key-outline" size={18} color={BRAND.green} />
              </View>
              <Text style={styles.title}>Change Password</Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <PwField
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            visible={showCurrent}
            onToggle={() => setShowCurrent(!showCurrent)}
          />
          <PwField
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="8+ characters, A–Z, a–z, 0–9"
            visible={showNew}
            onToggle={() => setShowNew(!showNew)}
          />
          {/* Same checklist as registration; shows once they start typing */}
          {newPassword.length > 0 && <PasswordRulesCheck password={newPassword} />}
          <PwField
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            visible={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
          />
          {confirmPassword.length > 0 && (
            <PasswordMatchCheck matches={confirmPassword === newPassword} />
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Update Password</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Error/success pop-up, shown on top of this one */}
      {dialog}
    </Modal>
  );
}

// Password input with a show/hide eye button.
function PwField({ label, visible, onToggle, ...rest }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.gray}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        <TouchableOpacity onPress={onToggle} hitSlop={10}>
          <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // alignItems + justifyContent center = the card sits in the exact middle.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 26, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: BRAND.mint,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
  },
  input: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 10 },

  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});