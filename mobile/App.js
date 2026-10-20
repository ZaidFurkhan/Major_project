import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LiveMonitorScreen from './src/screens/LiveMonitorScreen';
import DiagnosisScreen from './src/screens/DiagnosisScreen';
import RepairGuideScreen from './src/screens/RepairGuideScreen';
import VerificationScreen from './src/screens/VerificationScreen';
import ReportScreen from './src/screens/ReportScreen';
import { colours } from './src/theme';

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showRepairGuide, setShowRepairGuide] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showReport, setShowReport] = useState(false);

  return (
    <SafeAreaProvider>
      {showWelcome ? (
        <WelcomeScreen onStart={() => setShowWelcome(false)} />
      ) : showDiagnosis ? (
        <DiagnosisScreen onBack={() => setShowDiagnosis(false)} />
      ) : showRepairGuide ? (
        <RepairGuideScreen onBack={() => setShowRepairGuide(false)} />
      ) : showVerification ? (
        <VerificationScreen onBack={() => setShowVerification(false)} />
      ) : showReport ? (
        <ReportScreen onBack={() => setShowReport(false)} />
      ) : (
        <View style={styles.monitorWrapper}>
          <View style={styles.monitorContent}>
            <LiveMonitorScreen />
          </View>
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <Pressable
              onPress={() => setShowDiagnosis(true)}
              style={styles.diagnosisButton}
            >
              <Text style={styles.diagnosisButtonText}>View diagnosis</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowRepairGuide(true)}
              style={styles.repairGuideButton}
            >
              <Text style={styles.repairGuideButtonText}>View repair guide</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowVerification(true)}
              style={styles.verificationButton}
            >
              <Text style={styles.verificationButtonText}>View verification</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowReport(true)}
              style={styles.reportButton}
            >
              <Text style={styles.reportButtonText}>View report</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  monitorWrapper: {
    flex: 1,
    backgroundColor: colours.background,
  },
  monitorContent: {
    flex: 1,
  },
  bottomBar: {
    backgroundColor: colours.background,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
  },
  diagnosisButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  diagnosisButtonText: {
    fontSize: 14,
    color: colours.textSecondary,
  },
  repairGuideButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  repairGuideButtonText: {
    fontSize: 14,
    color: colours.textSecondary,
  },
  verificationButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  verificationButtonText: {
    fontSize: 14,
    color: colours.textSecondary,
  },
  reportButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reportButtonText: {
    fontSize: 14,
    color: colours.textSecondary,
  },
});


