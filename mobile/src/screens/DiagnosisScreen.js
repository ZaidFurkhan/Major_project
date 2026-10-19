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

function formatEvidenceValue(val) {
  if (typeof val === 'number') {
    return val.toFixed(2);
  }
  return String(val);
}

export default function DiagnosisScreen({ onBack }) {
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
              Set a service case ID in mobile/src/monitorSettings.js to view its diagnosis.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const latestDiagnosis = reportData?.latestDiagnosis ?? null;

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
          <Text style={styles.headerTitle}>Diagnosis</Text>
          <Text style={styles.headerSubtitle}>{CASE_ID}</Text>
        </View>

        {reportState === 'loading' && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colours.textSecondary} />
            <Text style={styles.waitingText}>Loading diagnosis...</Text>
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

        {reportState === 'ok' && !latestDiagnosis && (
          <View style={styles.stateContainer}>
            <Text style={styles.messageText}>No diagnosis is stored for this case yet.</Text>
            <Pressable onPress={handleRetry} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {reportState === 'ok' && latestDiagnosis && (
          <View style={styles.diagnosisSection}>
            {reportData?.repairOutcome && (
              <View style={styles.repairOutcomeContainer}>
                <Text style={styles.repairOutcomeText}>
                  Repair outcome: {REPAIR_OUTCOME_LABELS[reportData.repairOutcome] || reportData.repairOutcome}
                </Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                {latestDiagnosis.status === 'diagnosed'
                  ? 'Diagnosed'
                  : latestDiagnosis.status === 'inconclusive'
                  ? 'Inconclusive: no fault signature detected'
                  : latestDiagnosis.status}
              </Text>
            </View>

            {Array.isArray(latestDiagnosis.signatures) && latestDiagnosis.signatures.length > 0 && (
              <View style={styles.signaturesSection}>
                <Text style={styles.subSectionTitle}>Signatures</Text>
                <View style={styles.signatureList}>
                  {latestDiagnosis.signatures.map((sig, idx) => {
                    const sigType = typeof sig === 'string' ? sig : sig?.type;
                    const label = SIGNATURE_LABELS[sigType] || sigType;
                    return (
                      <View key={idx} style={styles.signaturePill}>
                        <Text style={styles.signaturePillText}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {Array.isArray(latestDiagnosis.candidates) && latestDiagnosis.candidates.length > 0 && (
              <View style={styles.candidatesSection}>
                <Text style={styles.sectionTitle}>Possible causes to check</Text>
                {latestDiagnosis.candidates.map((candidate, idx) => {
                  const isContradicted = Boolean(candidate.contradicted);
                  return (
                    <View
                      key={candidate.id || idx}
                      style={[
                        styles.candidateCard,
                        isContradicted && styles.contradictedCard,
                      ]}
                    >
                      <Text style={styles.candidateLabel}>{candidate.label}</Text>

                      {isContradicted && (
                        <Text style={styles.contradictedNotice}>
                          Marked contradicted
                        </Text>
                      )}

                      {Array.isArray(candidate.supportingEvidence) &&
                        candidate.supportingEvidence.length > 0 && (
                          <View style={styles.evidenceContainer}>
                            <Text style={styles.evidenceTitle}>Supporting evidence</Text>
                            {candidate.supportingEvidence.map((ev, evIdx) => (
                              <View key={evIdx} style={styles.evidenceBlock}>
                                {Object.entries(ev).map(([key, val]) => (
                                  <Text key={key} style={styles.evidenceFieldText}>
                                    {key}: {formatEvidenceValue(val)}
                                  </Text>
                                ))}
                              </View>
                            ))}
                          </View>
                        )}

                      {candidate.checkNext ? (
                        <View style={styles.checkNextContainer}>
                          <Text style={styles.checkNextLabel}>Check next:</Text>
                          <Text style={styles.checkNextText}>{candidate.checkNext}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {Boolean(latestDiagnosis.dataSources) && (
              <Text style={styles.dataSourceText}>
                Data source: {Array.isArray(latestDiagnosis.dataSources) ? latestDiagnosis.dataSources.join(', ') : String(latestDiagnosis.dataSources)}
              </Text>
            )}

            {latestDiagnosis.uncertainty ? (
              <View style={styles.uncertaintyContainer}>
                <Text style={styles.uncertaintyText}>{latestDiagnosis.uncertainty}</Text>
              </View>
            ) : null}
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
  diagnosisSection: {
    width: '100%',
  },
  repairOutcomeContainer: {
    marginBottom: 12,
  },
  repairOutcomeText: {
    fontSize: 14,
    color: colours.textSecondary,
  },
  statusRow: {
    marginBottom: 16,
  },
  statusText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colours.textPrimary,
  },
  signaturesSection: {
    marginBottom: 20,
  },
  subSectionTitle: {
    fontSize: 13,
    color: colours.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signatureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signaturePill: {
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.pillRadius,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  signaturePillText: {
    fontSize: 12,
    color: colours.textSecondary,
  },
  candidatesSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colours.textPrimary,
    marginBottom: 12,
  },
  candidateCard: {
    backgroundColor: colours.card,
    borderWidth: 1,
    borderColor: colours.cardBorder,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: spacing.cardGap,
  },
  contradictedCard: {
    borderColor: colours.warning,
  },
  candidateLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colours.textPrimary,
    lineHeight: 22,
  },
  contradictedNotice: {
    fontSize: 12,
    color: colours.warning,
    marginTop: 6,
    marginBottom: 4,
  },
  evidenceContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
  },
  evidenceTitle: {
    fontSize: 12,
    color: colours.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceBlock: {
    marginBottom: 6,
  },
  evidenceFieldText: {
    fontSize: 13,
    color: colours.textSecondary,
    lineHeight: 18,
  },
  checkNextContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
  },
  checkNextLabel: {
    fontSize: 12,
    color: colours.textSecondary,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkNextText: {
    fontSize: 14,
    color: colours.textPrimary,
    lineHeight: 20,
  },
  dataSourceText: {
    fontSize: 13,
    color: colours.textSecondary,
    marginTop: 8,
    marginBottom: 12,
  },
  uncertaintyContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colours.cardBorder,
  },
  uncertaintyText: {
    fontSize: 13,
    color: colours.textSecondary,
    lineHeight: 18,
  },
});
