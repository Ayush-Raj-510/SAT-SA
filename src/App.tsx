/**
 * SAT-SA — Supervisory Analytics Tool for SOC Assessment
 * Problem statement SIH 26157 | NTRO / NCIIPC
 * Air-gapped, evidence-first supervisory decision support platform.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { EntityDetailModal } from './components/EntityDetailModal';
import { ReviewQueueTab } from './components/ReviewQueueTab';
import { EvidenceGraphTab } from './components/EvidenceGraphTab';
import { FindingsTab } from './components/FindingsTab';
import { DataQualityTab } from './components/DataQualityTab';
import { SyntheticBenchmarkTab } from './components/SyntheticBenchmarkTab';
import { IngestTab } from './components/IngestTab';
import { AuditTab } from './components/AuditTab';
import { AiAnalystTab } from './components/AiAnalystTab';
import { ReportModal } from './components/ReportModal';
import { TrendAnalysisTab } from './components/TrendAnalysisTab';
import {
  exportFindingsCSV,
  exportReviewQueueCSV,
  exportEntityScoresCSV,
} from './engine/exportUtils';

import { generateComprehensiveDataset, SyntheticDataset } from './data/syntheticGenerator';
import { runAnalyticsEngine, AnalyticsRunResult } from './engine/analyticsEngine';
import { runDataQualityAssessment } from './engine/dataQuality';
import { computeSHA256 } from './engine/crypto';
import { IngestSummary } from './engine/dataParser';
import { LoginModal } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { getStoredSession, saveSession, clearSession } from './data/authUsers';
import {
  UserRole,
  UserProfile,
  ReviewStatus,
  AnalysisRunRecord,
  ExaminerAuditEntry,
  ReviewQueueItem,
} from './types';
import { RefreshCw, UploadCloud, Database } from 'lucide-react';
import { ConfirmDialog } from './components/ui';

const BASELINE_NAME = 'Default 6-CSE ground-truth baseline (2026-Q3)';

export default function App() {
  // ---------------------------------------------------------------- session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredSession());
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const session = getStoredSession();
    return session?.role || 'Examiner';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // ------------------------------------------------------------------ data
  const [dataset, setDataset] = useState<SyntheticDataset>(() => generateComprehensiveDataset());
  const [activeDatasetInfo, setActiveDatasetInfo] = useState<{
    name: string;
    isCustom: boolean;
    timestamp: string;
    recordCounts: { entities: number; assets: number; alerts: number; cases: number; escalations: number };
  }>({
    name: BASELINE_NAME,
    isCustom: false,
    timestamp: new Date().toISOString(),
    recordCounts: { entities: 6, assets: 22, alerts: 120, cases: 110, escalations: 40 },
  });

  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-Q3');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [targetAlertForGraph, setTargetAlertForGraph] = useState<string | undefined>(undefined);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  // ------------------------------------------------------------- run hashes
  const [runId, setRunId] = useState<string>('RUN-NCIIPC-2026Q3-8419');
  const [datasetHash, setDatasetHash] = useState<string>(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  const [normalizedHash, setNormalizedHash] = useState<string>(
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  );
  const [configHash, setConfigHash] = useState<string>(
    '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  );

  useEffect(() => {
    let cancelled = false;
    async function calculateHashes() {
      const dHash = await computeSHA256(dataset.alerts);
      const nHash = await computeSHA256(dataset.cases);
      const cHash = await computeSHA256({
        ruleset: 'v1.2.0-STABLE',
        weights: { exec: 0.4, neg: 0.35, trend: 0.15, peer: 0.1 },
      });
      if (cancelled) return;
      setDatasetHash(dHash);
      setNormalizedHash(nHash);
      setConfigHash(cHash);
    }
    calculateHashes();
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  // --------------------------------------------------------------- analysis
  const analytics: AnalyticsRunResult = useMemo(
    () =>
      runAnalyticsEngine(
        runId,
        dataset.entities,
        dataset.assets,
        dataset.alerts,
        dataset.cases,
        dataset.escalations,
        dataset.historical_snapshots,
      ),
    [dataset, runId],
  );

  const dataQuality = useMemo(
    () =>
      runDataQualityAssessment(
        dataset.entities,
        dataset.assets,
        dataset.alerts,
        dataset.cases,
        dataset.escalations,
      ),
    [dataset],
  );

  // Review queue mutable state (examiner determinations)
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() => analytics.review_queue);

  useEffect(() => {
    setReviewQueue(analytics.review_queue);
  }, [analytics]);

  // ------------------------------------------------------------- audit trail
  const [auditTrail, setAuditTrail] = useState<ExaminerAuditEntry[]>(() => [
    {
      id: 'AUD-001',
      timestamp: new Date().toISOString(),
      actor: 'system_airgap_init',
      role: 'Administrator',
      action: 'BATCH_INGEST_VERIFIED',
      target_id: 'SUBMISSION-2026Q3',
      details: 'Loaded 6 Critical Sector Entities with SHA-256 integrity check.',
    },
    {
      id: 'AUD-002',
      timestamp: new Date().toISOString(),
      actor: 'examiner_session',
      role: 'Examiner',
      action: 'ANALYTICS_RUN_EXECUTED',
      target_id: runId,
      details: 'Triggered deterministic detectors and computed the transparent risk ranking.',
    },
  ]);

  const pushAudit = (entry: Omit<ExaminerAuditEntry, 'id' | 'timestamp'>) => {
    setAuditTrail((prev) => [
      { ...entry, id: `AUD-${Date.now().toString().slice(-5)}`, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  };

  const actorLabel = currentUser
    ? `${currentUser.name} [${currentUser.badge_id}]`
    : `examiner_${userRole.toLowerCase()}`;

  // --------------------------------------------------------------- handlers
  const handleUpdateReviewStatus = (itemId: string, status: ReviewStatus, comment: string) => {
    setReviewQueue((prev) =>
      prev.map((item) =>
        item.queue_item_id === itemId
          ? { ...item, review_status: status, examiner_comment: comment }
          : item,
      ),
    );
    pushAudit({
      actor: actorLabel,
      role: userRole,
      action: 'EXAMINER_STATUS_UPDATED',
      target_id: itemId,
      details: `Determination set to "${status}". Note: "${comment || 'No comment provided'}"`,
    });
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setUserRole(user.role);
    saveSession(user);
    setIsLoginModalOpen(false);
    pushAudit({
      actor: user.badge_id,
      role: user.role,
      action: 'USER_AUTHENTICATED',
      target_id: user.session_token ? user.session_token.slice(0, 18) : 'TOKEN-ACTIVE',
      details: `${user.name} authenticated with ${user.clearance_level}. Organisation: ${user.organization}. Role: ${user.role}.`,
    });
  };

  const handleLogout = () => {
    if (currentUser) {
      pushAudit({
        actor: currentUser.badge_id,
        role: currentUser.role,
        action: 'USER_LOGGED_OUT',
        target_id: currentUser.session_token ? currentUser.session_token.slice(0, 18) : 'TOKEN-EXPIRED',
        details: `${currentUser.name} signed out. Terminal returned to the authentication gateway.`,
      });
    }
    clearSession();
    setCurrentUser(null);
    setIsLoginModalOpen(false);
  };

  const handleReRunAnalytics = () => {
    const newRunId = `RUN-NCIIPC-2026Q3-${Math.floor(1000 + Math.random() * 9000)}`;
    setRunId(newRunId);
    pushAudit({
      actor: actorLabel,
      role: userRole,
      action: 'RE_EXECUTE_ANALYTICS',
      target_id: newRunId,
      details: 'Deterministic rules and robust percentiles recomputed over the active dataset.',
    });
  };

  const handleRegenerateBenchmark = () => {
    setDataset(generateComprehensiveDataset());
    handleReRunAnalytics();
  };

  const handleIngestDataset = (newDataset: SyntheticDataset, summary: IngestSummary) => {
    setDataset(newDataset);
    const newRunId = `RUN-INGEST-${Math.floor(1000 + Math.random() * 9000)}`;
    setRunId(newRunId);
    setActiveDatasetInfo({
      name: summary.fileName,
      isCustom: true,
      timestamp: new Date().toISOString(),
      recordCounts: summary.recordCounts,
    });
    pushAudit({
      actor: actorLabel,
      role: userRole,
      action: 'BATCH_INGEST_VERIFIED',
      target_id: summary.sha256Hash.slice(0, 16),
      details: `Ingested ${summary.fileName} (${(summary.fileSize / 1024).toFixed(1)} KB). Loaded ${summary.recordCounts.entities} entities, ${summary.recordCounts.assets} assets, ${summary.recordCounts.alerts} alerts, ${summary.recordCounts.cases} cases, ${summary.recordCounts.escalations} escalations. Mode: ${summary.mode}. Hash: ${summary.sha256Hash}.`,
    });
  };

  const handleResetToBaseline = () => {
    const fresh = generateComprehensiveDataset();
    setDataset(fresh);
    const newRunId = `RUN-NCIIPC-2026Q3-${Math.floor(1000 + Math.random() * 9000)}`;
    setRunId(newRunId);
    setActiveDatasetInfo({
      name: BASELINE_NAME,
      isCustom: false,
      timestamp: new Date().toISOString(),
      recordCounts: {
        entities: fresh.entities.length,
        assets: fresh.assets.length,
        alerts: fresh.alerts.length,
        cases: fresh.cases.length,
        escalations: fresh.escalations.length,
      },
    });
    pushAudit({
      actor: actorLabel,
      role: userRole,
      action: 'DATASET_RESET_BASELINE',
      target_id: newRunId,
      details: 'Reverted the active dataset to the 6-entity ground-truth baseline enclave.',
    });
  };

  /** Reverting replaces the ingested submission, so it is gated behind a
   *  confirmation that names the dataset about to be discarded. */
  const requestResetBaseline = () => setIsResetConfirmOpen(true);

  const confirmResetBaseline = () => {
    setIsResetConfirmOpen(false);
    handleResetToBaseline();
  };

  const handleViewEvidenceGraph = (alertId?: string) => {
    if (alertId) setTargetAlertForGraph(alertId);
    setCurrentTab('evidence-graph');
  };

  const currentRunRecord: AnalysisRunRecord = {
    run_id: runId,
    dataset_hash: datasetHash,
    normalized_dataset_hash: normalizedHash,
    configuration_hash: configHash,
    ruleset_version: 'v1.2.0-STABLE',
    model_version: 'n/a (deterministic decision support)',
    application_version: 'SAT-SA 2026.09-AIRGAP',
    created_at: new Date().toISOString(),
    created_by: currentUser ? `${currentUser.name} [${currentUser.badge_id}]` : 'NCIIPC sectoral examiner',
    record_counts: {
      entities: dataset.entities.length,
      assets: dataset.assets.length,
      alerts: dataset.alerts.length,
      cases: dataset.cases.length,
      escalations: dataset.escalations.length,
      findings: analytics.findings.length,
      review_items: reviewQueue.length,
    },
    warnings: dataQuality.issues.map((i) => i.rule_name),
  };

  const selectedEntityScore = analytics.entity_scores.find((e) => e.entity_id === selectedEntityId);

  // ---------------------------------------------------------------- render
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>

      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        runId={runId}
        datasetHash={datasetHash}
        userRole={userRole}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        onReRunAnalysis={handleReRunAnalytics}
        onOpenReport={() => setIsReportOpen(true)}
      />

      {/* key={currentTab} remounts the view on switch, which is what plays
          the entrance animation and resets scroll for the new tab. */}
      <main className="app-main anim-view" id="main" tabIndex={-1} key={currentTab}>
        {/* Active custom dataset notice */}
        {activeDatasetInfo.isCustom && (
          <div
            className="callout callout-accent anim-fade"
            style={{ marginBottom: 16, alignItems: 'center' }}
          >
            <Database size={15} />
            <div className="row-between" style={{ flex: 1 }}>
              <div>
                <strong>Ingested submission active</strong>
                <span className="muted"> — {activeDatasetInfo.name}</span>
                <div className="text-xs dim" style={{ marginTop: 2 }}>
                  {dataset.entities.length} entities · {dataset.assets.length} assets ·{' '}
                  {dataset.alerts.length} alerts · {dataset.cases.length} cases ·{' '}
                  {dataset.escalations.length} escalations. All views reflect this dataset.
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => setCurrentTab('ingest')}>
                  <UploadCloud size={13} /> Ingest another
                </button>
                <button className="btn btn-sm btn-outline" onClick={requestResetBaseline}>
                  <RefreshCw size={13} /> Revert to baseline
                </button>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'overview' && (
          <OverviewTab
            entityScores={analytics.entity_scores}
            findings={analytics.findings}
            reviewQueue={reviewQueue}
            dataQuality={dataQuality}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            datasetHash={datasetHash}
            runId={runId}
          />
        )}

        {currentTab === 'leaderboard' && (
          <LeaderboardTab
            entityScores={analytics.entity_scores}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            onExport={() => exportEntityScoresCSV(analytics.entity_scores, runId, datasetHash)}
          />
        )}

        {currentTab === 'queue' && (
          <ReviewQueueTab
            queueItems={reviewQueue}
            userRole={userRole}
            currentUser={currentUser || undefined}
            onUpdateStatus={handleUpdateReviewStatus}
            onViewEvidenceGraph={handleViewEvidenceGraph}
            onExport={() => exportReviewQueueCSV(reviewQueue, runId, datasetHash)}
          />
        )}

        {currentTab === 'evidence-graph' && (
          <EvidenceGraphTab
            entities={dataset.entities}
            assets={dataset.assets}
            alerts={dataset.alerts}
            cases={dataset.cases}
            escalations={dataset.escalations}
            initialAlertId={targetAlertForGraph}
          />
        )}

        {currentTab === 'findings' && (
          <FindingsTab
            findings={analytics.findings}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            runId={runId}
            datasetHash={datasetHash}
            onExport={() => exportFindingsCSV(analytics.findings, runId, datasetHash)}
          />
        )}

        {currentTab === 'trends' && <TrendAnalysisTab entityTrends={analytics.entity_trends} />}

        {currentTab === 'data-quality' && <DataQualityTab report={dataQuality} />}

        {currentTab === 'benchmark' && (
          <SyntheticBenchmarkTab
            dataset={dataset}
            entityScores={analytics.entity_scores}
            findings={analytics.findings}
            reviewQueue={reviewQueue}
            onRegenerateData={handleRegenerateBenchmark}
            dataQuality={dataQuality}
          />
        )}

        {currentTab === 'ingest' && (
          <IngestTab
            userRole={userRole}
            currentUser={currentUser || undefined}
            currentDataset={dataset}
            onIngestSuccess={handleIngestDataset}
            onNavigateToOverview={() => setCurrentTab('overview')}
            onNavigateToLeaderboard={() => setCurrentTab('leaderboard')}
            onNavigateToFindings={() => setCurrentTab('findings')}
            onNavigateToQueue={() => setCurrentTab('queue')}
            activeDatasetName={activeDatasetInfo.name}
            isCustomDataset={activeDatasetInfo.isCustom}
            onResetBaseline={requestResetBaseline}
          />
        )}

        {currentTab === 'audit' && (
          <AuditTab
            currentRun={currentRunRecord}
            auditTrail={auditTrail}
            userRole={userRole}
            currentUser={currentUser || undefined}
          />
        )}

        {currentTab === 'ai' && (
          <AiAnalystTab
            runId={runId}
            datasetHash={datasetHash}
            entityScores={analytics.entity_scores}
            findings={analytics.findings}
            reviewQueue={reviewQueue}
            dataQuality={dataQuality}
          />
        )}
      </main>

      {/* Role authentication & session modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        isModal={true}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Entity deep-dive modal */}
      {selectedEntityId && selectedEntityScore && (
        <EntityDetailModal
          entityId={selectedEntityId}
          entityScore={selectedEntityScore}
          findings={analytics.findings}
          peerMetrics={analytics.peer_benchmarks[selectedEntityId]}
          assets={dataset.assets}
          reviewQueue={reviewQueue}
          onClose={() => setSelectedEntityId(null)}
          onSelectReviewItem={() => {
            setSelectedEntityId(null);
            setCurrentTab('queue');
          }}
        />
      )}

      {/* Destructive-action guard for the baseline revert */}
      {isResetConfirmOpen && (
        <ConfirmDialog
          title="Discard the ingested submission?"
          confirmLabel="Discard and revert"
          onConfirm={confirmResetBaseline}
          onCancel={() => setIsResetConfirmOpen(false)}
        >
          <p style={{ margin: 0 }}>
            <strong>{activeDatasetInfo.name}</strong> is loaded and every view currently reflects it.
            Reverting replaces it with the {BASELINE_NAME}.
          </p>
          <div className="confirm-facts">
            Will be discarded:
            <br />
            {dataset.entities.length} entities · {dataset.assets.length} assets ·{' '}
            {dataset.alerts.length} alerts · {dataset.cases.length} cases ·{' '}
            {dataset.escalations.length} escalations
            <br />
            Generate the supervisory report first if this submission still needs to be on record.
          </div>
        </ConfirmDialog>
      )}

      {/* Supervisory report generator */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        entityScores={analytics.entity_scores}
        findings={analytics.findings}
        reviewQueue={reviewQueue}
        dataQuality={dataQuality}
        currentRun={currentRunRecord}
        peerBenchmarks={analytics.peer_benchmarks}
      />

      <footer
        style={{
          borderTop: '1px solid var(--line)',
          background: 'var(--surface)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 11.5,
          color: 'var(--fg-3)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--fg-2)' }}>SAT-SA</strong> · SIH 26157 · NTRO / NCIIPC
        </span>
        <span className="mono">
          Run {runId} · SHA-256 {datasetHash.slice(0, 12)}
        </span>
      </footer>
    </div>
  );
}
