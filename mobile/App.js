import React from 'react';
import { StatusBar } from 'expo-status-bar';
import ConnectionCheckScreen from './src/screens/ConnectionCheckScreen';

export default function App() {
  return (
    <>
      <ConnectionCheckScreen />
      <StatusBar style="auto" />
    </>
  );
}
