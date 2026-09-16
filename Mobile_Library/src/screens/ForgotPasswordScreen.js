import React, { useState } from 'react';
import {
     View,
     Text,
     TextInput,
     TouchableOpacity,
     StyleSheet,
     KeyboardAvoidingView,
     Platform,
     ActivityIndicator,
     useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';

export default function ForgotPasswordScreen({ navigation }) {
     const { width, height } = useWindowDimensions();
     const layout = getResponsive(width, height);
     const [email, setEmail] = useState('');
     const [emailFocused, setEmailFocused] = useState(false);
     const [loading, setLoading] = useState(false);
     const [submitted, setSubmitted] = useState(false);
     const [errorText, setErrorText] = useState('');

     const handleSubmit = async () => {
     setErrorText('');
     if (!email.trim()) {
          setErrorText('Please enter your email address.');
          return;
     }
     if (!/^[^\s@]+@cvsu\.edu\.ph$/i.test(email.trim())) {
          setErrorText('Please enter a correctly formatted @cvsu.edu.ph email address.');
          return;
     }

     setLoading(true);
     try {
          const response = await fetch(`${API_URL}/api/student/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
          });
          // The backend always returns the same generic message here whether
          // or not the email is registered — that's intentional (prevents
          // using this form to check who has an account), so the UI just
          // shows one confirmation state regardless of what came back.
          await response.json();
          setSubmitted(true);
     } catch (error) {
          console.error('Forgot password error:', error);
          setErrorText('Could not reach the server. Check your connection and try again.');
     } finally {
          setLoading(false);
     }
     };

     return (
     <View style={styles.root}>
          <SafeAreaView edges={['top']} style={styles.headerWrap}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
               <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          </SafeAreaView>

          <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          >
          <View style={[styles.content, { paddingHorizontal: layout.horizontalPadding, maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }]}>
               {!submitted ? (
               <>
               <View style={styles.iconWrap}>
                    <Ionicons name="mail-outline" size={32} color={colors.primary} />
               </View>
               <Text style={styles.title}>Forgot your password?</Text>
               <Text style={styles.sub}>
                    Enter the email address linked to your account. We'll send you a one-time
                    link to reset your password.
               </Text>

               <Text style={styles.fieldLabel}>E-mail Address</Text>
               <TextInput
                    style={[styles.input, emailFocused && styles.inputFocused]}
                    placeholder="name@cvsu.edu.ph"
                    placeholderTextColor={colors.gray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
               />
               {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

               <View style={{ height: 12 }} />

               <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
               >
                    {loading ? (
                    <ActivityIndicator color="#fff" />
                    ) : (
                    <Text style={styles.buttonText}>SEND RESET LINK</Text>
                    )}
               </TouchableOpacity>
               </>
               ) : (
               <>
               <View style={styles.iconWrapSuccess}>
                    <Ionicons name="checkmark-circle-outline" size={36} color={colors.primary} />
               </View>
               <Text style={styles.title}>Check your email</Text>
               <Text style={styles.sub}>
                    If that email is registered, we've sent a link to reset your password.
                    The link is valid for 30 minutes and can only be used once.
               </Text>

               <View style={{ height: 12 }} />

               <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.85}
               >
                    <Text style={styles.buttonText}>BACK TO LOGIN</Text>
               </TouchableOpacity>
               </>
               )}
          </View>
          </KeyboardAvoidingView>
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

     content: { flex: 1, paddingHorizontal: 28, paddingTop: 32 },

     iconWrap: {
     width: 64, height: 64, borderRadius: 32,
     backgroundColor: colors.grayLight || '#F0F0F0',
     alignItems: 'center', justifyContent: 'center', marginBottom: 20,
     },
     iconWrapSuccess: {
     width: 72, height: 72, borderRadius: 36,
     backgroundColor: '#E8F5E9',
     alignItems: 'center', justifyContent: 'center', marginBottom: 20,
     },
     title: { fontSize: 19, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
     sub: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20, marginBottom: 28 },

     fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
     input: {
     width: '100%',
     borderBottomWidth: 1.5,
     borderBottomColor: colors.border,
     paddingBottom: 10,
     fontSize: 15,
     color: colors.textPrimary,
     },
     inputFocused: { borderBottomColor: colors.primary },
     errorText: { color: '#B91C1C', fontSize: 12.5, marginTop: 8 },

     button: {
     width: '100%',
     backgroundColor: colors.primary,
     height: 54,
     borderRadius: 14,
     justifyContent: 'center',
     alignItems: 'center',
     },
     buttonDisabled: { opacity: 0.7 },
     buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
});