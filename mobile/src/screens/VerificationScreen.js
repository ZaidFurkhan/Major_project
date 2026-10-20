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
import { CASE_ID } from '../monitorSettings';
import { fetchCaseReport } from '../services/api';
import { colours, spacing } from '../theme';

const SIGNATURE_LABELS = Object.freeze({
  vibration_elevated: 'Vibration rise',
  overheating: 'Overheating',
  abnormal_load: 'Abnormal load',
  rpm_deviation: 'Speed deviation',
});

const REPAIR_OUTCOME_LABELS = Object.freeze({
  verified: 'Verified',
  not_verified: 'Not verified',
  no_verification_recorded: 'No verification recorded',
});

function formatPlainDateTime(dateVal) {
  if (!dateVal) {
    return '';
  }
  const dateObj = new Date(dateVal);
  if (isNaN(dateObj.getTime())) {
    return String(dateVal);
  }
  const iso = dateObj.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

export default function VerificationScreen({ onBack }) {
  const [reportState, setReportState] = useState('loading');
  const [reportData, setReportData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!CASE_ID || CASE_ID.trim() === '') {
      return;
    }

    const abortController = new AbortController();
    setReportState('loading');

    fetchCaseReport(CASE_ID, abortController.signal).then((result) => {
      if (abortController.signal.aborted) {
        return;
      }
      if (result.ok) {
        setReportData(result.data);
        setReportState('ok');
      } else {
        setReportState(result.reason);
      }
    });

    return () => {
      abortController.abort();
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1);
  };

  const hasCaseId = Boolean(CASE_ID && CASE_ID.trim() !== '');

  if (!hasCaseId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topBar}>
            <Pressable onPress={onBack} style={styles.navButton}>
              <Text style={styles.navButtonText}>Back</Text>
            </Pressable>
          </View>
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>No case selected</Text>
            <Text style={styles.messageText}>
              Set a service case ID in mobile/src/monitorSettings.js to view its verifications.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const rawVerifications = Array.isArray(reportData?.verifications)
    ? reportData.verifications
    : [];

  const sortedVerifications = [...rawVerifications].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeA - timeB;
  });

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

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verification</Text>
          <Text style={styles.headerSubtitle}>{CASE_ID}</Text>
        </View>

        {reportState === 'loading' && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colours.textSecondary} />
            <Text style={styles.waitingText}>Loading verifications...</Text>
          </View>
        )}

        {reportState === 'not_found' && (
          <View style={styles.stateContainer}>
            <Text style={styles.messageText}>Case not found.</Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {reportState === 'invalid_id' && (
          <View style={styles.stateContainer}>
            <Text style={styles.messageText}>The case ID is not valid.</Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {reportState === 'network' && (
          <View style={styles.stateContainer}>
            <Text style={styles.errorTitle}>Cannot reach backend</Text>
            <Text style={styles.errorHint}>
              Check that the PC and phone are on the same Wi-Fi and that the backend is running.
            </Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {reportState === 'ok' && sortedVerifications.length === 0 && (
          <View style={styles.stateContainer}>
            <Text style={styles.messageText}>
              No verification has been recorded for this case yet.
            </Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {reportState === 'ok' && sortedVerifications.length > 0 && (
          <View style={styles.contentSection}>
            <View style={styles.outcomeContainer}>
              <Text style={styles.outcomeText}>
                Repair outcome: {REPAIR_OUTCOME_LABELS[reportData?.repairOutcome] || reportData?.repairOutcome}
              </Text>
            </View>

            <View style={styles.cardList}>
              {sortedVerifications.map((item, idx) => {
                const isWarning = item.status === 'FAIL' || item.status === 'INCONCLUSIVE';
                const targetLabel = SIGNATURE_LABELS[item.targetSignature] || item.targetSignature;
                const detectedLabels = Array.isArray(item.detectedSignatures) && item.detectedSignatures.length > 0
                  ? item.detectedSignatures.map((s) => SIGNATURE_LABELS[s] || s).join(', ')
                  : 'None';

                return (
                  <View key={idx} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={[styles.statusLabel, isWarning && styles.warningStatusLabel]}>
                        {item.status}
                      </Text>
                      <Text style={styles.dateText}>
                        {formatPlainDateTime(item.createdAt)}
                      </Text>
                    </View>

                    <Text style={styles.targetFaultText}>
                      Target fault: {targetLabel}
                    </Text>

                    <Text style={styles.reasonText}>
                      {item.reason}
                    </Text>

                    <Text style={styles.detectedText}>
                      Detected: {detectedLabels}
                    </Text>

                    {item.uncertainty ? (
                      <View style={styles.uncertaintyContainer}>
                        <Text style={styles.uncertaintyText}>
                          {item.uncertainty}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {Array.isArray(reportData?.notes) && reportData.notes.length > 0 && (
              <View style={styles.notesContainer}>
                {reportData.notes.map((note, noteIdx) => (
                  <Text key={noteIdx} style={styles.noteText}>
                    {note}
                  </Text>
                ))}
              </View>
            )}
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
  header: {
    marginBottom: 16,
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
  stateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colours.textPrimary,
    marginBottom: 8,
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
    color: colours.textPrimary,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: colours.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
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
  contentSection: {
    width: '100%',
  },
  outcomeContainer: {
    marginBottom: 16,
  },
  outcomeText: {
    fontSize: 15,
    color: colours.textSecondary,
  },
  cardList: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: colours.card,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: spacing.cardGap,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colours.textPrimary,
  },
  warningStatusLabel: {
    color: colours.warning,
  },
  dateText: {
    fontSize: 12,
    color: colours.textSecondary,
  },
  targetFaultText: {
    fontSize: 14,
    fontWeight: '600',
    color: colours.textPrimary,
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 14,
    color: colours.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  detectedText: {
    fontSize: 13,
    color: colours.textSecondary,
    marginBottom: 8,
  },
  uncertaintyContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
  },
  uncertaintyText: {
    fontSize: 12,
    color: colours.textSecondary,
    lineHeight: 17,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
    marginBottom: 24,
  },
  noteText: {
    fontSize: 12,
    color: colours.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
});
