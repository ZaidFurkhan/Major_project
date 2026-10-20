import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchRepairGuide } from '../services/api';
import { colours, spacing } from '../theme';

const FAULT_SIGNATURES = [
  { key: 'vibration_elevated', label: 'Vibration rise' },
  { key: 'overheating', label: 'Overheating' },
  { key: 'abnormal_load', label: 'Abnormal load' },
  { key: 'rpm_deviation', label: 'Speed deviation' },
];

function formatPlainDate(isoDateString) {
  if (!isoDateString) {
    return '';
  }
  const dateObj = new Date(isoDateString);
  if (isNaN(dateObj.getTime())) {
    return String(isoDateString);
  }
  return dateObj.toISOString().split('T')[0];
}

export default function RepairGuideScreen({ onBack }) {
  const [selectedSignature, setSelectedSignature] = useState('overheating');
  const [guideState, setGuideState] = useState('loading');
  const [guideData, setGuideData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    setGuideState('loading');

    fetchRepairGuide(selectedSignature, abortController.signal).then((result) => {
      if (abortController.signal.aborted) {
        return;
      }
      if (result.ok) {
        if (result.data?.status === 'no_approved_procedure') {
          setGuideState('no_approved_procedure');
        } else {
          setGuideData(result.data);
          setGuideState('found');
        }
      } else {
        setGuideState(result.reason);
      }
    });

    return () => {
      abortController.abort();
    };
  }, [selectedSignature, reloadKey]);

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1);
  };

  const steps = Array.isArray(guideData?.steps) ? guideData.steps : [];
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.navButton}>
            <Text style={styles.navButtonText}>Back</Text>
          </Pressable>
          <Pressable onPress={handleRetry} style={styles.navButton}>
            <Text style={styles.navButtonText}>Retry</Text>
          </Pressable>
        </View>

        <View style={styles.selectorRow}>
          {FAULT_SIGNATURES.map((item) => {
            const isSelected = item.key === selectedSignature;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedSignature(item.key)}
                style={[
                  styles.selectorButton,
                  isSelected && styles.selectorButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.selectorButtonText,
                    isSelected && styles.selectorButtonTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {guideState === 'loading' && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colours.textSecondary} />
            <Text style={styles.waitingText}>Loading repair guide...</Text>
          </View>
        )}

        {guideState === 'no_approved_procedure' && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>
              No approved procedure exists for this fault yet.
            </Text>
            <Text style={styles.messageText}>
              Repair steps appear here only after a person approves a procedure from a source document.
            </Text>
          </View>
        )}

        {guideState === 'invalid_signature' && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>This fault signature is not recognised.</Text>
          </View>
        )}

        {guideState === 'network' && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>Cannot reach backend</Text>
            <Text style={styles.messageText}>
              Check that the PC and phone are on the same Wi-Fi and that the backend is running.
            </Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {guideState === 'found' && guideData?.procedure && (
          <View style={styles.guideContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Repair guide</Text>
              <Text style={styles.procedureTitle}>{guideData.procedure.title}</Text>
              <Text style={styles.metaLine}>
                Source: {guideData.procedure.sourceReference}
              </Text>
              <Text style={styles.metaLine}>
                Approved: {formatPlainDate(guideData.procedure.approvedAt)}
              </Text>
            </View>

            <View style={styles.stepsList}>
              {sortedSteps.map((step, idx) => (
                <View key={step.stepOrder ?? idx} style={styles.stepCard}>
                  <Text style={styles.stepNumber}>{step.stepOrder}</Text>
                  <Text style={styles.instructionText}>{step.instruction}</Text>
                  <Text style={styles.sourceLocationText}>
                    Source location: {step.sourceLocation}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                Follow the approved steps and the site safety rules. Confirm each step before moving on.
              </Text>
            </View>
          </View>
        )}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.pillRadius,
  },
  navButtonText: {
    fontSize: 13,
    color: colours.textSecondary,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  selectorButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.pillRadius,
    backgroundColor: colours.background,
  },
  selectorButtonSelected: {
    backgroundColor: colours.card,
    borderColor: colours.textSecondary,
  },
  selectorButtonText: {
    fontSize: 13,
    color: colours.textSecondary,
  },
  selectorButtonTextSelected: {
    color: colours.textPrimary,
  },
  stateContainer: {
    marginTop: 24,
    alignItems: 'flex-start',
    width: '100%',
  },
  stateTitle: {
    fontSize: 17,
    color: colours.textPrimary,
    marginBottom: 8,
  },
  waitingText: {
    marginTop: 16,
    fontSize: 15,
    color: colours.textSecondary,
  },
  messageText: {
    fontSize: 14,
    color: colours.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.pillRadius,
  },
  actionButtonText: {
    fontSize: 14,
    color: colours.textPrimary,
  },
  guideContent: {
    width: '100%',
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    color: colours.textPrimary,
    marginBottom: 6,
  },
  procedureTitle: {
    fontSize: 18,
    color: colours.textPrimary,
    marginBottom: 10,
  },
  metaLine: {
    fontSize: 13,
    color: colours.textSecondary,
    marginBottom: 4,
  },
  stepsList: {
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: colours.card,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: spacing.cardGap,
  },
  stepNumber: {
    fontSize: 16,
    color: colours.textPrimary,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 15,
    color: colours.textPrimary,
    lineHeight: 22,
    marginBottom: 10,
  },
  sourceLocationText: {
    fontSize: 13,
    color: colours.textSecondary,
  },
  footerContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 13,
    color: colours.textSecondary,
    lineHeight: 18,
  },
});
