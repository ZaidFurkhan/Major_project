import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ConnectionCheckScreen from './src/screens/ConnectionCheckScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ConnectionCheckScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
