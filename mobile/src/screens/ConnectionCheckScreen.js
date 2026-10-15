import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Button,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { fetchHealth } from '../services/api';

export default function ConnectionCheckScreen() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const checkConnection = async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await fetchHealth();
    if (result.ok) {
      setHealthData(result.body);
      setErrorMessage(null);
    } else {
      setHealthData(null);
      setErrorMessage(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {loading && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.text}>Checking backend...</Text>
          </View>
        )}

        {!loading && healthData && (
          <View style={styles.stateContainer}>
            <Text style={styles.title}>Backend connected</Text>
            <Text style={styles.text}>Service: {healthData.service}</Text>
            <Text style={styles.text}>Status: {healthData.status}</Text>
            <View style={styles.buttonContainer}>
              <Button title="Retry" onPress={checkConnection} color="#000000" />
            </View>
          </View>
        )}

        {!loading && errorMessage && (
          <View style={styles.stateContainer}>
            <Text style={styles.title}>Cannot reach backend</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Text style={styles.hintText}>
              Check that the PC and phone are on the same Wi-Fi and that the backend is running.
            </Text>
            <View style={styles.buttonContainer}>
              <Button title="Retry" onPress={checkConnection} color="#000000" />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#000000',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#000000',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 16,
    minWidth: 120,
  },
});
