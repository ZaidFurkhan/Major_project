import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LiveMonitorScreen from './src/screens/LiveMonitorScreen';

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <SafeAreaProvider>
      {showWelcome ? (
        <WelcomeScreen onStart={() => setShowWelcome(false)} />
      ) : (
        <LiveMonitorScreen />
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

