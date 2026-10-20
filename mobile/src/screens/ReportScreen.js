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

export default function ReportScreen({ onBack }) {
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
              Set a service case ID in mobile/src/monitorSettings.js to view its report.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const outcomeLabel =
    reportData?.repairOutcome === 'verified'
      ? 'Verified'
      : reportData?.repairOutcome === 'not_verified'
      ? 'Not verified'
      : 'No verification recorded';

  const isNotVerified = reportData?.repairOutcome === 'not_verified';
  const diagnosesCount = Array.isArray(reportData?.diagnoses) ? reportData.diagnoses.length : 0;
  const verificationsCount = Array.isArray(reportData?.verifications) ? reportData.verifications.length : 0;

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
          <Text style={styles.headerTitle}>Case report</Text>
          <Text style={styles.headerSubtitle}>{CASE_ID}</Text>
        </View>

        {reportState === 'loading' && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colours.textSecondary} />
            <Text style={styles.waitingText}>Loading report...</Text>
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

        {reportState === 'ok' && reportData && (
          <View style={styles.contentSection}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Case</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Status: </Text>
                <Text style={styles.fieldValue}>{reportData.case?.status}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Detected symptom: </Text>
                <Text style={styles.fieldValue}>
                  {reportData.case?.detectedSymptom ?? 'Not recorded'}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Created: </Text>
                <Text style={styles.fieldValue}>
                  {formatPlainDateTime(reportData.case?.createdAt)}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Closed: </Text>
                <Text style={styles.fieldValue}>
                  {reportData.case?.closedAt ? formatPlainDateTime(reportData.case.closedAt) : 'Open'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Machine</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name: </Text>
                <Text style={styles.fieldValue}>{reportData.machine?.name}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Type: </Text>
                <Text style={styles.fieldValue}>{reportData.machine?.type}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Location: </Text>
                <Text style={styles.fieldValue}>{reportData.machine?.location}</Text>
              </View>
            </View>

            <View style={styles.outcomeContainer}>
              <Text style={[styles.outcomeText, isNotVerified && styles.warningOutcomeText]}>
                Repair outcome: {outcomeLabel}
              </Text>
            </View>

            <View style={styles.countsContainer}>
              <Text style={styles.countText}>
                Diagnoses stored: {diagnosesCount}
              </Text>
              <Text style={styles.countText}>
                Verifications recorded: {verificationsCount}
              </Text>
            </View>

            {Array.isArray(reportData?.notes) && reportData.notes.length > 0 && (
              <View style={styles.notesContainer}>
                {reportData.notes.map((note, idx) => (
                  <Text key={idx} style={styles.noteText}>
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
  card: {
    backgroundColor: colours.card,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: spacing.cardGap,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colours.textPrimary,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 14,
    color: colours.textSecondary,
  },
  fieldValue: {
    fontSize: 14,
    color: colours.textPrimary,
  },
  outcomeContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  outcomeText: {
    fontSize: 15,
    color: colours.textPrimary,
  },
  warningOutcomeText: {
    color: colours.warning,
  },
  countsContainer: {
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    color: colours.textSecondary,
    marginBottom: 4,
  },
  notesContainer: {
    marginTop: 8,
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
