import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MACHINE_ID, POLL_INTERVAL_MS } from '../monitorSettings';
import { fetchLatestTelemetry } from '../services/api';
import { colours, spacing } from '../theme';

export default function LiveMonitorScreen() {
  const [temperatureWarning] = useState(false);
  const [screenState, setScreenState] = useState('waiting');
  const [telemetry, setTelemetry] = useState(null);
  const [lastKnown, setLastKnown] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    let inFlight = false;

    const poll = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;

      try {
        const result = await fetchLatestTelemetry(MACHINE_ID, abortController.signal);
        if (abortController.signal.aborted) {
          return;
        }

        if (result.ok) {
          setTelemetry(result.data);
          setLastKnown(result.data);
          setScreenState('ok');
        } else if (result.reason === 'no_telemetry') {
          setScreenState('no_telemetry');
        } else {
          setScreenState('network');
        }
      } finally {
        inFlight = false;
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      abortController.abort();
    };
  }, []);

  const renderTelemetryContent = (data) => {
    const reading = data.reading;
    const ageSeconds = typeof data.ageMs === 'number' ? (data.ageMs / 1000).toFixed(1) : '0.0';
    const isStale = Boolean(data.stale);

    const tempStr = typeof reading.temperatureC === 'number' ? reading.temperatureC.toFixed(1) : '--';
    const vibStr = typeof reading.vibrationRmsG === 'number' ? reading.vibrationRmsG.toFixed(3) : '--';
    const currStr = typeof reading.currentA === 'number' ? reading.currentA.toFixed(2) : '--';
    const rpmStr = typeof reading.rpm === 'number' ? reading.rpm.toFixed(0) : '--';

    const commandedText = reading.commandedRpm !== null && reading.commandedRpm !== undefined
      ? `Commanded: ${Math.round(reading.commandedRpm)} RPM`
      : 'Commanded: not available';

    return (
      <View style={styles.telemetrySection}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourcePillText}>
            {reading.source === 'sensor' ? 'Sensor data' : 'Simulated data'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isStale ? colours.critical : colours.live },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isStale ? colours.critical : colours.textPrimary },
            ]}
          >
            {isStale
              ? `Data is stale. Last reading was ${ageSeconds} seconds ago.`
              : `Live, ${ageSeconds} s old`}
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={[styles.card, temperatureWarning && styles.temperatureWarningCard]}>
              <Text style={styles.cardLabel}>Temperature</Text>
              <Text style={styles.cardValue}>
                {tempStr} <Text style={styles.cardUnit}>°C</Text>
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Vibration RMS</Text>
              <Text style={styles.cardValue}>
                {vibStr} <Text style={styles.cardUnit}>g</Text>
              </Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Current</Text>
              <Text style={styles.cardValue}>
                {currStr} <Text style={styles.cardUnit}>A</Text>
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Speed</Text>
              <Text style={styles.cardValue}>
                {rpmStr} <Text style={styles.cardUnit}>RPM</Text>
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.commandedText}>{commandedText}</Text>

        {reading.dataQuality && (
          <Text style={styles.dataQualityText}>
            Window samples: {reading.dataQuality.windowSamples ?? 0}, dropouts: {reading.dataQuality.dropoutCount ?? 0}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live Monitor</Text>
          <Text style={styles.headerSubtitle}>{MACHINE_ID}</Text>
        </View>

        {screenState === 'waiting' && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colours.live} />
            <Text style={styles.waitingText}>Waiting for telemetry...</Text>
          </View>
        )}

        {screenState === 'no_telemetry' && (
          <View style={styles.stateContainer}>
            <Text style={styles.messageText}>
              No telemetry yet for this machine. Check that the development stack and the backend are running.
            </Text>
          </View>
        )}

        {screenState === 'network' && (
          <View style={styles.stateContainer}>
            <Text style={styles.errorTitle}>Cannot reach backend</Text>
            <Text style={styles.errorHint}>
              Check that the PC and phone are on the same Wi-Fi and that the backend is running.
            </Text>
            {lastKnown && (
              <View style={styles.lastKnownContainer}>
                <Text style={styles.lastKnownLabel}>Last known values</Text>
                {renderTelemetryContent(lastKnown)}
              </View>
            )}
          </View>
        )}

        {screenState === 'ok' && telemetry && renderTelemetryContent(telemetry)}

        {/* Tab bar comes with the other screens. */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colours.background,
  },
  container: {
    padding: spacing.screenPadding,
    backgroundColor: colours.background,
    flexGrow: 1,
  },
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colours.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colours.textSecondary,
    marginTop: 4,
  },
  stateContainer: {
    marginTop: 32,
    alignItems: 'flex-start',
    width: '100%',
  },
  waitingText: {
    marginTop: 16,
    fontSize: 16,
    color: colours.textSecondary,
  },
  messageText: {
    fontSize: 15,
    color: colours.textSecondary,
    lineHeight: 22,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colours.critical,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: colours.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  lastKnownContainer: {
    width: '100%',
    marginTop: 12,
  },
  lastKnownLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colours.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  telemetrySection: {
    width: '100%',
  },
  sourcePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.pillRadius,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
    marginBottom: 10,
  },
  sourcePillText: {
    fontSize: 12,
    color: colours.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
  },
  grid: {
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: spacing.cardGap,
  },
  card: {
    flex: 1,
    backgroundColor: colours.card,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.cardRadius,
    padding: 16,
  },
  temperatureWarningCard: {
    borderColor: colours.warning,
  },
  cardLabel: {
    fontSize: 13,
    color: colours.textSecondary,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colours.textPrimary,
  },
  cardUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: colours.textSecondary,
  },
  commandedText: {
    fontSize: 14,
    color: colours.textSecondary,
    marginTop: 4,
  },
  dataQualityText: {
    fontSize: 13,
    color: colours.textSecondary,
    marginTop: 6,
  },
});
