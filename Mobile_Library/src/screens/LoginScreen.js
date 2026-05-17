import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your school email');
      return;
    }

    try {
      setLoading(true);
      
      // Standardized connection endpoint matching the Register and Home setups
      const response = await fetch('http://192.168.1.13:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }), 
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Login Failed', data.message);
        return;
      }

      // 1. Stores the complete student object returned by the database session backend
      await AsyncStorage.setItem('student', JSON.stringify(data.student));
      Alert.alert('Success', 'Login successful');
      
      // 2. Redirects directly to the main dashboard stack
      navigation.replace('HomeScreen'); 

    } catch (error) {
      console.error("Network Error:", error);
      Alert.alert('Connection Error', 'Ensure phone and laptop are on the same Wi-Fi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <Ionicons name="library" size={70} color="#1B5E20" />

          <Text style={styles.title}>LibraPass</Text>

          <Text style={styles.subtitle}>
            Login using your school email
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter school email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
          >
            <Text
              style={{
                textAlign: 'center',
                marginTop: 20,
                color: '#1B5E20',
                fontWeight: '600',
              }}
            >
              No account yet? Register here
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1B5E20',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});