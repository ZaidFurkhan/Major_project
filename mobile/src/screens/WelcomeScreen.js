import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ onStart }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.upperArea}>
        <Image
          source={require('../../assets/orbit.jpg')}
          style={styles.orbitGraphic}
          resizeMode="contain"
          accessibilityLabel="Orbit graphic"
        />
      </View>

      <View style={styles.lowerArea}>
        <Text style={styles.headline}>
          Catch the fault.{'\n'}Confirm the fix.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Start monitoring"
        >
          <Text style={styles.buttonText}>Start monitoring</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  upperArea: {
    flex: 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  orbitGraphic: {
    width: '100%',
    maxWidth: 320,
    maxHeight: 380,
    aspectRatio: 1,
  },
  lowerArea: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
});
