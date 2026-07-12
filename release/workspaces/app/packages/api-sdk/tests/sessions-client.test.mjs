import assert from "node:assert/strict";
import test from "node:test";

import { createSessionsApiClient } from "../dist/index.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("createSessionsApiClient serializes listSessionPacks query and parses summaries", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);

      assert.equal(url.pathname, "/v1/sessions");
      assert.equal(url.searchParams.get("workspaceContextKey"), "brand-lab");
      assert.equal(url.searchParams.get("packageId"), "brand-poster-suite");
      assert.equal(url.searchParams.get("serviceId"), "poster-batch");
      assert.equal(url.searchParams.get("q"), "poster");
      assert.equal(headers.get("authorization"), "Bearer session-token");

      return jsonResponse([
        {
          sessionVersionId: "sev_brand_poster_suite",
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          updatedAt: "2026-07-10T01:00:00.000Z",
        },
      ]);
    },
  });

  const result = await client.listSessionPacks({
    workspaceContextKey: "brand-lab",
    packageId: "brand-poster-suite",
    serviceId: "poster-batch",
    q: "poster",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].sessionVersionId, "sev_brand_poster_suite");
  assert.equal(result[0].primaryPackageId, "brand-poster-suite");
});

test("createSessionsApiClient parses session-pack detail", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/sessions/sev_brand_poster_suite");

      return jsonResponse({
        sessionVersionId: "sev_brand_poster_suite",
        displayName: {
          zh: "Brand Poster Session",
          en: "Brand Poster Session",
        },
        summary: {
          zh: "Poster batch flow",
          en: "Poster batch flow",
        },
        manifestVersion: "lingban.session-pack/v1",
        primaryPackageId: "brand-poster-suite",
        sourcePackageIds: ["brand-poster-suite"],
        primaryTaskVersionId: "tsv_poster_batch",
        linkedServiceIds: ["poster-batch"],
        linkedWorkshopIds: ["brand-poster-suite"],
        workspaceContextKeys: ["brand-lab"],
        sourcePackageState: "ready",
        releaseChannel: {
          zh: "Production",
          en: "Production",
        },
        runtimeProfile: {
          profileId: "brand-poster-suite",
          runnerImage: "lingban/runner:2026.07",
          browserRequired: false,
          playwrightRequired: false,
        },
        requiredBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: ["connector://imagegen/private-brand-key"],
          credentialIds: ["cred_image_brand"],
        },
        expectedRootFiles: ["manifest.json", "conversation.jsonl"],
        archiveSource: "runtime-derived",
        archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
        archiveSizeBytes: 2048,
        archiveRecordedAt: "2026-07-10T01:05:00.000Z",
        runtimeSourceRunId: "run_brand_poster_suite",
        runtimeSourceTargetPath: "/workspace/poster-batch-17/runs/poster-batch",
        runtimeSourceUpdatedAt: "2026-07-10T01:04:00.000Z",
        updatedAt: "2026-07-10T01:00:00.000Z",
        sourceReleaseIds: ["rel_brand_poster_prod"],
        activeActivationIds: ["act_brand_poster_prod"],
        runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
        optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
        informationCollectionReview: {
          slotSchemaVersion: "generated.v1",
          totalSlots: 1,
          requiredSlots: 0,
          satisfiedSlots: 1,
          totalAnswers: 2,
          userMessageAnswerCount: 1,
          manualReviewAnswerCount: 1,
          revisionCount: 1,
          pendingReviewCount: 0,
          approvedReviewCount: 1,
          rejectedReviewCount: 0,
          supersededReviewCount: 1,
          latestAnsweredAt: "2026-07-10T01:03:00.000Z",
          latestReviewedAt: "2026-07-10T01:04:00.000Z",
          slots: [
            {
              key: "request_context",
              title: "Request context",
              type: "string",
              required: false,
              secret: false,
              status: "satisfied",
              answerCount: 1,
              trackedAnswerCount: 2,
              userMessageAnswerCount: 1,
              manualReviewAnswerCount: 1,
              revisionCount: 1,
              pendingReviewCount: 0,
              approvedReviewCount: 1,
              rejectedReviewCount: 0,
              supersededReviewCount: 1,
              lastAnsweredAt: "2026-07-10T01:03:00.000Z",
              lastReviewedAt: "2026-07-10T01:04:00.000Z",
              latestAnswerId: "ica_review_ica_msg_request_context_text_1_20260710010400",
              latestSource: "manual-review",
              latestSourceMessageId: "review:ica_msg_request_context_text_1",
              effectiveAnswerId: "ica_review_ica_msg_request_context_text_1_20260710010400",
              effectiveSource: "manual-review",
              effectiveSourceMessageId: "review:ica_msg_request_context_text_1",
              answers: [
                {
                  answerId: "ica_msg_request_context_text_1",
                  kind: "text",
                  source: "user-message",
                  sourceMessageId: "msg_request_context",
                  reviewStatus: "superseded",
                  reviewedAt: "2026-07-10T01:04:00.000Z",
                  reviewedByUserId: "usr_brand_reviewer",
                  supersedesAnswerId: null,
                  supersededByAnswerId: "ica_review_ica_msg_request_context_text_1_20260710010400",
                  createdAt: "2026-07-10T01:03:00.000Z",
                },
                {
                  answerId: "ica_review_ica_msg_request_context_text_1_20260710010400",
                  kind: "text",
                  source: "manual-review",
                  sourceMessageId: "review:ica_msg_request_context_text_1",
                  reviewStatus: "approved",
                  reviewedAt: "2026-07-10T01:04:00.000Z",
                  reviewedByUserId: "usr_brand_reviewer",
                  supersedesAnswerId: "ica_msg_request_context_text_1",
                  supersededByAnswerId: null,
                  createdAt: "2026-07-10T01:04:00.000Z",
                },
              ],
            },
          ],
        },
        redactionSummary: {
          mapVersion: "imported.v1",
          slotSchemaVersion: "imported.v1",
          totalRules: 2,
          linkedSlotRuleCount: 1,
          linkedSecretSlotRuleCount: 1,
          unlinkedRuleCount: 1,
          orphanSlotKeyCount: 0,
          secretSlotCount: 1,
          coveredSecretSlotCount: 1,
          uncoveredSecretSlotCount: 0,
          secretCoverageComplete: true,
          targetKinds: ["text", "json-path"],
          strategies: ["mask", "replace"],
          secretSlotKeys: ["tax_secret"],
          coveredSecretSlotKeys: ["tax_secret"],
          uncoveredSecretSlotKeys: [],
          orphanSlotKeys: [],
          previewMatchedRuleCount: 2,
          previewTotalMatches: 2,
          previewMutatedEntries: ["conversation.jsonl", "runtime-config.json"],
          previewUnmatchedRuleIds: [],
          previewError: null,
          rules: [
            {
              ruleId: "mask-export-secret",
              slotKey: null,
              targetKind: "text",
              selector: "SECRET-7788",
              strategy: "mask",
              rationale: "Mask copied export markers",
              linkedSlotExists: false,
              linkedSecretSlot: false,
              previewMatched: true,
              previewMatchCount: 1,
              previewMutatedEntries: ["conversation.jsonl"],
            },
            {
              ruleId: "replace-tax-secret",
              slotKey: "tax_secret",
              targetKind: "json-path",
              selector: "runtime-config.json#$.env.TAX_SECRET",
              strategy: "replace",
              rationale: "Replace runtime tax secret",
              linkedSlotExists: true,
              linkedSecretSlot: true,
              previewMatched: true,
              previewMatchCount: 1,
              previewMutatedEntries: ["runtime-config.json"],
            },
          ],
        },
        consumerGovernance: {
          totalConsumerVersions: 1,
          workspaceIds: ["wsp_brand_lab"],
          serviceIds: ["poster-batch"],
          entrySurfaces: ["dashboard"],
          items: [
            {
              sessionVersionId: "sev_brand_poster_suite_consumer",
              sessionId: "ses_brand_poster_suite_consumer",
              displayName: {
                zh: "Poster Consumer Session",
                en: "Poster Consumer Session",
              },
              summary: {
                zh: "Derived for a consumer run",
                en: "Derived for a consumer run",
              },
              inheritMode: "consumer",
              isCurrent: false,
              depth: 1,
              viaSessionVersionId: "sev_brand_poster_suite",
              workspaceContextKeys: ["brand-lab"],
              linkedServiceIds: ["poster-batch"],
              linkedWorkshopIds: ["brand-poster-suite"],
              consumerRunId: "run_brand_poster_suite_consumer",
              consumerWorkspaceId: "wsp_brand_lab",
              consumerServiceId: "poster-batch",
              consumerWorkshopId: "brand-poster-suite",
              consumerEntrySurface: "dashboard",
              consumerTargetPath: "/workspace/poster-batch-17/runs/poster-batch",
              archiveSource: "runtime-derived",
              publishedTargetCount: 2,
              runtimeSourceRunId: "run_brand_poster_suite_consumer",
              runtimeSourceTargetPath: "/workspace/poster-batch-17/runs/poster-batch",
              runtimeSourceUpdatedAt: "2026-07-10T01:04:30.000Z",
              updatedAt: "2026-07-10T01:05:00.000Z",
            },
          ],
        },
        governanceSummary: {
          state: "published",
          riskLevel: "medium",
          flags: [
            "published_targets_attached",
            "live_consumer_versions_visible",
            "consumer_descendants_present",
            "runtime_evidence_present",
          ],
          baselineSessionVersionId: "sev_brand_poster_suite",
          liveConsumerCount: 1,
          publishedConsumerCount: 1,
          unpublishedConsumerCount: 0,
          totalDescendantCount: 1,
          draftDescendantCount: 0,
          consumerDescendantCount: 1,
          rollbackDescendantCount: 0,
          runtimeEvidenceCount: 1,
          hasCurrentRuntimeEvidence: true,
          latestConsumerUpdatedAt: "2026-07-10T01:05:00.000Z",
          latestRuntimeEvidenceUpdatedAt: "2026-07-10T01:04:30.000Z",
          driftCount: 0,
          driftFieldKeys: [],
        },
        runtimeEvidenceSummary: {
          totalRecords: 1,
          latestCapturedAt: "2026-07-10T01:04:30.000Z",
          latestRunId: "run_brand_poster_suite_consumer",
          latestLaunchMode: "local-process",
          containerizedRecordCount: 0,
          currentRunId: "run_brand_poster_suite_consumer",
          hasCurrentRunRecord: true,
          items: [
            {
              evidenceId:
                "sev_brand_poster_suite:run_brand_poster_suite_consumer:2026-07-10T01:04:30.000Z",
              capturedAt: "2026-07-10T01:04:30.000Z",
              archiveSource: "runtime-derived",
              runId: "run_brand_poster_suite_consumer",
              workspaceId: "wsp_brand_lab",
              requestedByUserId: "usr_brand_reviewer",
              targetPath: "/workspace/poster-batch-17/runs/poster-batch",
              launchMode: "local-process",
              containerName: null,
              startedAt: "2026-07-10T01:02:00.000Z",
              readyAt: "2026-07-10T01:03:00.000Z",
              finishedAt: "2026-07-10T01:04:00.000Z",
              exitCode: 0,
              exitSignal: null,
              runtimeProfileId: "brand-poster-suite",
              runnerImage: "lingban/runner:2026.07",
              manifestRuntimeDerived: true,
              runtimeSourceUpdatedAt: "2026-07-10T01:04:30.000Z",
              archiveSha256:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
              workspaceBaseCaptured: true,
              workspaceBaseCaptureError: null,
            },
          ],
        },
        signatureSummary: {
          present: true,
          algorithm: "hmac-sha256",
          keyId: "brand-poster-key",
          verificationRequired: true,
          status: "verified",
          verified: true,
          reason: null,
          signingEnabled: true,
          activeSigningReady: true,
          activeSigningError: null,
          activeSigningAlgorithm: "hmac-sha256",
          activeSigningKeyId: "brand-poster-key",
          acceptedVerificationKeyIds: ["brand-poster-key"],
          acceptsDefaultVerificationKey: false,
          signatureKeyAcceptedByKeyring: true,
          distributionState: "partial",
          distributionTargetCount: 2,
          freshDistributionTargetCount: 2,
          staleDistributionTargetCount: 0,
          manifestKeyDistributedTargetCount: 2,
          manifestKeyMissingTargetCount: 0,
          manifestKeyDistributedToAllTargets: true,
          activeSigningKeyDistributedTargetCount: 1,
          activeSigningKeyMissingTargetCount: 1,
          activeSigningKeyDistributedToAllTargets: false,
          distributionTargets: [
            {
              targetId: "worker-prod-a",
              displayName: {
                zh: "Worker Prod A",
                en: "Worker Prod A",
              },
              channel: "worker",
              acceptedKeyIds: ["brand-poster-key"],
              activeKeyId: "brand-poster-key",
              acceptsManifestKey: true,
              acceptsActiveSigningKey: true,
              reportFresh: true,
              lastReportedAt: "2026-07-10T01:03:00.000Z",
            },
            {
              targetId: "worker-prod-b",
              displayName: {
                zh: "Worker Prod B",
                en: "Worker Prod B",
              },
              channel: "worker",
              acceptedKeyIds: [],
              activeKeyId: null,
              acceptsManifestKey: true,
              acceptsActiveSigningKey: false,
              reportFresh: true,
              lastReportedAt: "2026-07-10T01:03:00.000Z",
            },
          ],
          matchesActiveSigningAlgorithm: true,
          matchesActiveSigningKey: true,
        },
        policySummary: {
          evaluatedAt: "2026-07-10T01:05:00.000Z",
          requireApprovedRedactionReviewForRedactedExport: true,
          requireApprovedRedactionReviewForPublish: true,
          requireSuccessfulRedactionPreviewForRedactedExport: true,
          requireSuccessfulRedactionPreviewForPublish: true,
          requireCompleteSecretCoverageForRedactedExport: true,
          requireCompleteSecretCoverageForPublish: true,
          requireVerifiedSignatureForInherit: true,
          requireVerifiedSignatureForPublish: true,
          requireVerifiedSignatureForRollback: true,
          requireSignatureKeyAcceptedForPublish: true,
          requireSignatureKeyAcceptedForRollback: true,
          requireSignatureKeyDistributionForPublish: true,
          requireSignatureKeyDistributionForRollback: true,
          warnOnActiveSigningKeyDistributionDrift: true,
          warnOnUnpublishWithLiveConsumers: true,
          checks: [
            {
              code: "active_signing_alignment_recommended",
              decision: "warn",
              appliesToActions: ["rollback"],
              title: {
                zh: "签名策略与当前运行时未完全对齐",
                en: "Archive signing is not fully aligned with the active runtime policy",
              },
              detail: {
                zh: "当前归档的签名算法或 key 与运行时激活策略不完全一致。",
                en: "The archive signature algorithm or key does not fully match the active runtime signing policy.",
              },
            },
          ],
          actions: [
            {
              action: "archive-redacted",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "inherit",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "publish",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
            {
              action: "rollback",
              decision: "warn",
              blockingCheckCount: 0,
              warningCheckCount: 1,
              checkCodes: ["active_signing_alignment_recommended"],
            },
            {
              action: "unpublish",
              decision: "allow",
              blockingCheckCount: 0,
              warningCheckCount: 0,
              checkCodes: [],
            },
          ],
        },
        sourcePackages: [
          {
            packageId: "brand-poster-suite",
            title: {
              zh: "Brand Poster Suite",
              en: "Brand Poster Suite",
            },
            state: "ready",
            updatedAt: "2026-07-10T01:00:00.000Z",
            workspaceContextKeys: ["brand-lab"],
            linkedServiceIds: ["poster-batch"],
            linkedWorkshopIds: ["brand-poster-suite"],
          },
        ],
      });
    },
  });

  const result = await client.getSessionPack("sev_brand_poster_suite");
  assert.equal(result.sourceReleaseIds[0], "rel_brand_poster_prod");
  assert.equal(result.optionalRootFiles.includes("redaction-map.json"), true);
  assert.equal(result.archiveSource, "runtime-derived");
  assert.equal(result.runtimeSourceRunId, "run_brand_poster_suite");
  assert.equal(result.informationCollectionReview?.slotSchemaVersion, "generated.v1");
  assert.equal(result.informationCollectionReview?.slots[0]?.key, "request_context");
  assert.equal(result.governanceSummary?.state, "published");
  assert.equal(result.governanceSummary?.liveConsumerCount, 1);
  assert.equal(result.governanceSummary?.runtimeEvidenceCount, 1);
  assert.equal(result.governanceSummary?.flags.includes("consumer_descendants_present"), true);
  assert.equal(result.runtimeEvidenceSummary?.totalRecords, 1);
  assert.equal(result.runtimeEvidenceSummary?.latestLaunchMode, "local-process");
  assert.equal(result.runtimeEvidenceSummary?.items[0]?.runId, "run_brand_poster_suite_consumer");
  assert.equal(result.signatureSummary?.status, "verified");
  assert.equal(result.signatureSummary?.matchesActiveSigningKey, true);
  assert.equal(result.signatureSummary?.distributionState, "partial");
  assert.equal(result.signatureSummary?.distributionTargets[1]?.acceptsActiveSigningKey, false);
  assert.equal(result.policySummary?.requireApprovedRedactionReviewForPublish, true);
  assert.equal(result.policySummary?.requireSignatureKeyDistributionForRollback, true);
  assert.equal(result.policySummary?.actions[0]?.action, "archive-redacted");
  assert.equal(result.policySummary?.actions[3]?.decision, "warn");
  assert.equal(result.informationCollectionReview?.approvedReviewCount, 1);
  assert.equal(result.informationCollectionReview?.manualReviewAnswerCount, 1);
  assert.equal(result.informationCollectionReview?.revisionCount, 1);
  assert.equal(result.informationCollectionReview?.slots[0]?.effectiveSource, "manual-review");
  assert.equal(result.informationCollectionReview?.slots[0]?.answers[0]?.reviewStatus, "superseded");
  assert.equal(result.informationCollectionReview?.slots[0]?.answers[1]?.source, "manual-review");
  assert.equal(result.redactionSummary?.totalRules, 2);
  assert.equal(result.redactionSummary?.secretCoverageComplete, true);
  assert.equal(result.redactionSummary?.coveredSecretSlotKeys[0], "tax_secret");
  assert.equal(result.redactionSummary?.previewMatchedRuleCount, 2);
  assert.equal(result.redactionSummary?.previewTotalMatches, 2);
  assert.equal(result.redactionSummary?.previewMutatedEntries.includes("conversation.jsonl"), true);
  assert.equal(result.redactionSummary?.rules[1]?.linkedSecretSlot, true);
  assert.equal(result.redactionSummary?.rules[1]?.previewMatched, true);
  assert.equal(result.redactionSummary?.rules[1]?.previewMatchCount, 1);
  assert.equal(result.consumerGovernance?.totalConsumerVersions, 1);
  assert.equal(result.consumerGovernance?.items[0]?.sessionVersionId, "sev_brand_poster_suite_consumer");
  assert.equal(result.consumerGovernance?.items[0]?.consumerRunId, "run_brand_poster_suite_consumer");
});

test("createSessionsApiClient parses session-pack lineage", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/sessions/sev_brand_poster_suite/lineage");

      return jsonResponse({
        focus: {
          sessionVersionId: "sev_brand_poster_suite",
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          updatedAt: "2026-07-10T01:00:00.000Z",
          sourceReleaseIds: ["rel_brand_poster_prod"],
          activeActivationIds: [],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
        },
        ancestors: [
          {
            sessionVersionId: "sev_brand_poster_suite_base",
            displayName: {
              zh: "Base Poster Session",
              en: "Base Poster Session",
            },
            summary: {
              zh: "Base flow",
              en: "Base flow",
            },
            manifestVersion: "lingban.session-pack/v1",
            primaryPackageId: "brand-poster-suite",
            sourcePackageIds: ["brand-poster-suite"],
            primaryTaskVersionId: "tsv_poster_batch",
            linkedServiceIds: ["poster-batch"],
            linkedWorkshopIds: ["brand-poster-suite"],
            workspaceContextKeys: ["brand-lab"],
            sourcePackageState: "ready",
            releaseChannel: {
              zh: "Production",
              en: "Production",
            },
            runtimeProfile: {
              profileId: "brand-poster-suite-base",
              runnerImage: "lingban/runner:2026.07",
              browserRequired: false,
              playwrightRequired: false,
            },
            requiredBindings: {
              firstPartyMcpIds: [],
              externalConnectorRefs: [],
              credentialIds: [],
            },
            expectedRootFiles: ["manifest.json", "conversation.jsonl"],
            updatedAt: "2026-07-09T01:00:00.000Z",
            relation: "lineage_parent",
            depth: 1,
            viaSessionVersionId: "sev_brand_poster_suite",
          },
        ],
        descendants: [
          {
            sessionVersionId: "sev_brand_poster_suite_draft_ab12cd34",
            displayName: {
              zh: "Brand Poster Session Draft",
              en: "Brand Poster Session Draft",
            },
            summary: {
              zh: "Draft flow",
              en: "Draft flow",
            },
            manifestVersion: "lingban.session-pack/v1",
            primaryPackageId: "brand-poster-suite",
            sourcePackageIds: ["brand-poster-suite"],
            primaryTaskVersionId: "tsv_poster_batch",
            linkedServiceIds: ["poster-batch"],
            linkedWorkshopIds: ["brand-poster-suite"],
            workspaceContextKeys: ["brand-lab"],
            sourcePackageState: "ready",
            releaseChannel: {
              zh: "Production",
              en: "Production",
            },
            runtimeProfile: {
              profileId: "brand-poster-suite-draft",
              runnerImage: "lingban/runner:2026.07",
              browserRequired: false,
              playwrightRequired: false,
            },
            requiredBindings: {
              firstPartyMcpIds: [],
              externalConnectorRefs: ["connector://imagegen/private-brand-key"],
              credentialIds: ["cred_image_brand"],
            },
            expectedRootFiles: ["manifest.json", "conversation.jsonl"],
            updatedAt: "2026-07-10T03:00:00.000Z",
            relation: "lineage_child",
            depth: 1,
            viaSessionVersionId: "sev_brand_poster_suite",
          },
        ],
      });
    },
  });

  const result = await client.getSessionPackLineage("sev_brand_poster_suite");
  assert.equal(result.ancestors[0].relation, "lineage_parent");
  assert.equal(result.descendants[0].relation, "lineage_child");
  assert.equal(result.focus.sessionVersionId, "sev_brand_poster_suite");
});

test("createSessionsApiClient uploads session-pack archives", async () => {
  const archive = new Uint8Array([1, 2, 3, 4]);
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const body = init?.body;

      assert.equal(url.pathname, "/v1/sessions/import");
      assert.equal(url.searchParams.get("workspaceContextKey"), "brand-lab");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/octet-stream");
      assert.ok(body instanceof Uint8Array);
      assert.deepEqual([...body], [...archive]);

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_imported_pack",
          displayName: {
            zh: "Imported Pack",
            en: "Imported Pack",
          },
          summary: {
            zh: "Imported archive",
            en: "Imported archive",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: null,
          sourcePackageIds: [],
          primaryTaskVersionId: null,
          linkedServiceIds: [],
          linkedWorkshopIds: [],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: null,
          releaseChannel: null,
          runtimeProfile: {
            profileId: "imported",
            runnerImage: null,
            browserRequired: true,
            playwrightRequired: true,
          },
          requiredBindings: {
            firstPartyMcpIds: ["browser-core"],
            externalConnectorRefs: ["connector://seedance/private"],
            credentialIds: ["cred_seedance"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          updatedAt: "2026-07-10T02:00:00.000Z",
          sourceReleaseIds: [],
          activeActivationIds: [],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
        },
        archiveDownloadPath: "/v1/sessions/sev_imported_pack/archive",
        archiveFileName: "sev_imported_pack.session-pack.json.gz",
        archiveSizeBytes: 4,
        importedAt: "2026-07-10T02:00:00.000Z",
        importedByUserId: "usr_0001",
        persistedArchive: true,
      });
    },
  });

  const result = await client.importSessionPackArchive(archive, {
    workspaceContextKey: "brand-lab",
  });

  assert.equal(result.archiveSizeBytes, 4);
  assert.equal(result.sessionPack.requiredBindings.firstPartyMcpIds[0], "browser-core");
});

test("createSessionsApiClient inherits a session-pack draft", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_brand_poster_suite/inherit");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.inheritMode, "draft");
      assert.equal(payload.reason, "fork for workspace delivery");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_brand_poster_suite_draft_ab12cd34",
          sessionId: "ses_brand_poster_suite",
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          lineageParentVersionId: "sev_brand_poster_suite",
          rollbackFromVersionId: null,
          persistedArchive: true,
          updatedAt: "2026-07-10T03:00:00.000Z",
          sourceReleaseIds: ["rel_brand_poster_prod"],
          activeActivationIds: ["act_brand_poster_prod"],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [
            {
              packageId: "brand-poster-suite",
              title: {
                zh: "Brand Poster Suite",
                en: "Brand Poster Suite",
              },
              state: "ready",
              updatedAt: "2026-07-10T01:00:00.000Z",
              workspaceContextKeys: ["brand-lab"],
              linkedServiceIds: ["poster-batch"],
              linkedWorkshopIds: ["brand-poster-suite"],
            },
          ],
        },
        archiveDownloadPath: "/v1/sessions/sev_brand_poster_suite_draft_ab12cd34/archive",
        archiveFileName: "sev_brand_poster_suite_draft_ab12cd34.session-pack.json.gz",
        archiveSizeBytes: 512,
        inheritedAt: "2026-07-10T03:00:00.000Z",
        inheritedByUserId: "usr_0001",
        inheritedFromSessionVersionId: "sev_brand_poster_suite",
        inheritMode: "draft",
        createdDraft: true,
      });
    },
  });

  const result = await client.inheritSessionPack("sev_brand_poster_suite", {
    workspaceContextKey: "brand-lab",
    reason: "fork for workspace delivery",
  });

  assert.equal(result.sessionPack.lineageParentVersionId, "sev_brand_poster_suite");
  assert.equal(result.inheritedFromSessionVersionId, "sev_brand_poster_suite");
  assert.equal(result.inheritMode, "draft");
  assert.equal(result.createdDraft, true);
});

test("createSessionsApiClient publishes a session-pack into launch templates", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_imported_pack/publish");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.serviceId, "poster-batch");
      assert.equal(payload.entrySurface, "dashboard");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_imported_pack",
          sessionId: "ses_imported_pack",
          displayName: {
            zh: "Imported Pack",
            en: "Imported Pack",
          },
          summary: {
            zh: "Imported archive",
            en: "Imported archive",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: null,
          sourcePackageIds: [],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: [],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: null,
          releaseChannel: null,
          runtimeProfile: {
            profileId: "imported",
            runnerImage: null,
            browserRequired: true,
            playwrightRequired: true,
          },
          requiredBindings: {
            firstPartyMcpIds: ["browser-core"],
            externalConnectorRefs: ["connector://seedance/private"],
            credentialIds: ["cred_seedance"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          publishedTargetCount: 1,
          persistedArchive: true,
          updatedAt: "2026-07-10T04:00:00.000Z",
          sourceReleaseIds: [],
          activeActivationIds: [],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
          publishedTargets: [
            {
              templateKey: "poster-batch:brand-lab:dashboard",
              serviceId: "poster-batch",
              workspaceContextKey: "brand-lab",
              entrySurface: "dashboard",
              taskVersionId: "tsv_poster_batch",
              sessionVersionId: "sev_imported_pack",
              title: {
                zh: "品牌海报批量生成",
                en: "Brand Poster Batch",
              },
              targetRoot: "/workspace/poster-batch-17/runs/poster-batch",
              bindings: {
                firstPartyMcpIds: ["browser-core"],
                externalConnectorRefs: ["connector://seedance/private"],
                credentialIds: ["cred_seedance"],
              },
            },
          ],
        },
        publishedTargets: [
          {
            templateKey: "poster-batch:brand-lab:dashboard",
            serviceId: "poster-batch",
            workspaceContextKey: "brand-lab",
            entrySurface: "dashboard",
            taskVersionId: "tsv_poster_batch",
            sessionVersionId: "sev_imported_pack",
            title: {
              zh: "品牌海报批量生成",
              en: "Brand Poster Batch",
            },
            targetRoot: "/workspace/poster-batch-17/runs/poster-batch",
            bindings: {
              firstPartyMcpIds: ["browser-core"],
              externalConnectorRefs: ["connector://seedance/private"],
              credentialIds: ["cred_seedance"],
            },
          },
        ],
        publishedAt: "2026-07-10T04:00:00.000Z",
        publishedByUserId: "usr_0001",
        publishedSessionVersionId: "sev_imported_pack",
        replacedSessionVersionIds: ["sev_brand_poster_suite"],
      });
    },
  });

  const result = await client.publishSessionPack("sev_imported_pack", {
    workspaceContextKey: "brand-lab",
    serviceId: "poster-batch",
    entrySurface: "dashboard",
  });

  assert.equal(result.publishedSessionVersionId, "sev_imported_pack");
  assert.equal(result.publishedTargets[0].templateKey, "poster-batch:brand-lab:dashboard");
  assert.equal(result.sessionPack.publishedTargetCount, 1);
});

test("createSessionsApiClient rolls back a published session-pack", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_imported_pack/rollback");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.serviceId, "poster-batch");
      assert.equal(payload.rollbackToSessionVersionId, "sev_brand_poster_suite");
      assert.equal(payload.entrySurface, "dashboard");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_brand_poster_suite",
          sessionId: null,
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          publishedTargetCount: 1,
          persistedArchive: false,
          updatedAt: "2026-07-10T04:10:00.000Z",
          sourceReleaseIds: ["rel_brand_poster_prod"],
          activeActivationIds: [],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [
            {
              packageId: "brand-poster-suite",
              title: {
                zh: "Brand Poster Suite",
                en: "Brand Poster Suite",
              },
              state: "ready",
              updatedAt: "2026-07-10T01:00:00.000Z",
              workspaceContextKeys: ["brand-lab"],
              linkedServiceIds: ["poster-batch"],
              linkedWorkshopIds: ["brand-poster-suite"],
            },
          ],
          publishedTargets: [
            {
              templateKey: "poster-batch:brand-lab:dashboard",
              serviceId: "poster-batch",
              workspaceContextKey: "brand-lab",
              entrySurface: "dashboard",
              taskVersionId: "tsv_poster_batch",
              sessionVersionId: "sev_brand_poster_suite",
              title: {
                zh: "品牌海报批量生成",
                en: "Brand Poster Batch",
              },
              targetRoot: "/workspace/poster-batch-17/runs/poster-batch",
              bindings: {
                firstPartyMcpIds: [],
                externalConnectorRefs: ["connector://imagegen/private-brand-key"],
                credentialIds: ["cred_image_brand"],
              },
            },
          ],
        },
        publishedTargets: [
          {
            templateKey: "poster-batch:brand-lab:dashboard",
            serviceId: "poster-batch",
            workspaceContextKey: "brand-lab",
            entrySurface: "dashboard",
            taskVersionId: "tsv_poster_batch",
            sessionVersionId: "sev_brand_poster_suite",
            title: {
              zh: "品牌海报批量生成",
              en: "Brand Poster Batch",
            },
            targetRoot: "/workspace/poster-batch-17/runs/poster-batch",
            bindings: {
              firstPartyMcpIds: [],
              externalConnectorRefs: ["connector://imagegen/private-brand-key"],
              credentialIds: ["cred_image_brand"],
            },
          },
        ],
        rolledBackAt: "2026-07-10T04:10:00.000Z",
        rolledBackByUserId: "usr_0001",
        rolledBackFromSessionVersionId: "sev_imported_pack",
        rolledBackToSessionVersionId: "sev_brand_poster_suite",
        replacedSessionVersionIds: ["sev_imported_pack"],
      });
    },
  });

  const result = await client.rollbackSessionPack("sev_imported_pack", {
    workspaceContextKey: "brand-lab",
    serviceId: "poster-batch",
    rollbackToSessionVersionId: "sev_brand_poster_suite",
    entrySurface: "dashboard",
  });

  assert.equal(result.rolledBackFromSessionVersionId, "sev_imported_pack");
  assert.equal(result.rolledBackToSessionVersionId, "sev_brand_poster_suite");
  assert.equal(result.publishedTargets[0].sessionVersionId, "sev_brand_poster_suite");
});

test("createSessionsApiClient unpublishes a session-pack from launch templates", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_imported_pack/unpublish");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.serviceId, "poster-batch");
      assert.equal(payload.entrySurface, "dashboard");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_imported_pack",
          sessionId: "ses_imported_pack",
          displayName: {
            zh: "Imported Pack",
            en: "Imported Pack",
          },
          summary: {
            zh: "Imported archive",
            en: "Imported archive",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: null,
          sourcePackageIds: [],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: [],
          linkedWorkshopIds: [],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: null,
          releaseChannel: null,
          runtimeProfile: {
            profileId: "imported",
            runnerImage: null,
            browserRequired: true,
            playwrightRequired: true,
          },
          requiredBindings: {
            firstPartyMcpIds: ["browser-core"],
            externalConnectorRefs: ["connector://seedance/private"],
            credentialIds: ["cred_seedance"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          publishedTargetCount: 0,
          persistedArchive: true,
          updatedAt: "2026-07-10T04:20:00.000Z",
          sourceReleaseIds: [],
          activeActivationIds: [],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
          publishedTargets: [],
        },
        unpublishedTargets: [
          {
            templateKey: "poster-batch:brand-lab:dashboard",
            serviceId: "poster-batch",
            workspaceContextKey: "brand-lab",
            entrySurface: "dashboard",
            taskVersionId: "tsv_poster_batch",
            sessionVersionId: "sev_imported_pack",
            title: {
              zh: "鍝佺墝娴锋姤鎵归噺鐢熸垚",
              en: "Brand Poster Batch",
            },
            targetRoot: "/workspace/poster-batch-17/runs/poster-batch",
            bindings: {
              firstPartyMcpIds: ["browser-core"],
              externalConnectorRefs: ["connector://seedance/private"],
              credentialIds: ["cred_seedance"],
            },
          },
        ],
        unpublishedAt: "2026-07-10T04:20:00.000Z",
        unpublishedByUserId: "usr_0001",
        unpublishedSessionVersionId: "sev_imported_pack",
        removedTemplateKeys: ["poster-batch:brand-lab:dashboard"],
      });
    },
  });

  const result = await client.unpublishSessionPack("sev_imported_pack", {
    workspaceContextKey: "brand-lab",
    serviceId: "poster-batch",
    entrySurface: "dashboard",
  });

  assert.equal(result.unpublishedSessionVersionId, "sev_imported_pack");
  assert.equal(result.removedTemplateKeys[0], "poster-batch:brand-lab:dashboard");
  assert.equal(result.unpublishedTargets[0].sessionVersionId, "sev_imported_pack");
  assert.equal(result.sessionPack.publishedTargetCount, 0);
});

test("createSessionsApiClient updates a session-pack redaction map", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_brand_poster_suite/redaction-map");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.mapVersion, "curated.v2");
      assert.deepEqual(payload.curatedSecretSlotKeys, ["company_name"]);
      assert.equal(payload.rules.length, 1);
      assert.equal(payload.rules[0].ruleId, "replace-tax-secret");
      assert.equal(payload.rules[0].slotKey, "tax_secret");
      assert.equal(payload.rules[0].targetKind, "json-path");
      assert.equal(payload.rules[0].selector, "runtime-config.json#$.env.TAX_SECRET");
      assert.equal(payload.rules[0].strategy, "replace");
      assert.equal(payload.rules[0].replacement, "[REDACTED]");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_brand_poster_suite",
          sessionId: "ses_brand_poster_suite",
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          archiveSource: "imported",
          archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
          archiveSizeBytes: 4096,
          archiveRecordedAt: "2026-07-10T05:00:00.000Z",
          updatedAt: "2026-07-10T05:00:00.000Z",
          sourceReleaseIds: ["rel_brand_poster_prod"],
          activeActivationIds: ["act_brand_poster_prod"],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
          informationCollectionReview: null,
          redactionSummary: {
            mapVersion: "curated.v2",
            slotSchemaVersion: "imported.v1",
            totalRules: 1,
            linkedSlotRuleCount: 1,
            linkedSecretSlotRuleCount: 1,
            unlinkedRuleCount: 0,
            orphanSlotKeyCount: 0,
            secretSlotCount: 2,
            coveredSecretSlotCount: 1,
            uncoveredSecretSlotCount: 1,
            secretCoverageComplete: false,
            targetKinds: ["json-path"],
            strategies: ["replace"],
            schemaSecretSlotKeys: ["tax_secret"],
            curatedSecretSlotKeys: ["company_name"],
            secretSlotKeys: ["tax_secret", "company_name"],
            coveredSecretSlotKeys: ["tax_secret"],
            uncoveredSecretSlotKeys: ["company_name"],
            orphanSlotKeys: [],
            previewMatchedRuleCount: 1,
            previewTotalMatches: 1,
            previewMutatedEntries: ["runtime-config.json"],
            previewUnmatchedRuleIds: [],
            previewError: null,
            rules: [
              {
                ruleId: "replace-tax-secret",
                slotKey: "tax_secret",
                targetKind: "json-path",
                selector: "runtime-config.json#$.env.TAX_SECRET",
                strategy: "replace",
                replacement: "[REDACTED]",
                rationale: "Replace runtime tax secret",
                linkedSlotExists: true,
                linkedSecretSlot: true,
                previewMatched: true,
                previewMatchCount: 1,
                previewMutatedEntries: ["runtime-config.json"],
              },
            ],
          },
          consumerGovernance: null,
        },
        updatedAt: "2026-07-10T05:00:00.000Z",
        updatedByUserId: "usr_0001",
        totalRules: 1,
        persistedArchive: true,
      });
    },
  });

  const result = await client.updateSessionPackRedactionMap("sev_brand_poster_suite", {
    workspaceContextKey: "brand-lab",
    mapVersion: "curated.v2",
    curatedSecretSlotKeys: ["company_name"],
    rules: [
      {
        ruleId: "replace-tax-secret",
        slotKey: "tax_secret",
        targetKind: "json-path",
        selector: "runtime-config.json#$.env.TAX_SECRET",
        strategy: "replace",
        replacement: "[REDACTED]",
      },
    ],
  });

  assert.equal(result.totalRules, 1);
  assert.equal(result.persistedArchive, true);
  assert.equal(result.sessionPack.redactionSummary?.mapVersion, "curated.v2");
  assert.equal(result.sessionPack.redactionSummary?.previewMatchedRuleCount, 1);
  assert.deepEqual(result.sessionPack.redactionSummary?.curatedSecretSlotKeys, ["company_name"]);
  assert.equal(result.sessionPack.redactionSummary?.rules[0]?.replacement, "[REDACTED]");
});

test("createSessionsApiClient records a session-pack redaction review", async () => {
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    getAccessToken: () => "session-token",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers ?? undefined);
      const payload = JSON.parse(String(init?.body ?? "{}"));

      assert.equal(url.pathname, "/v1/sessions/sev_brand_poster_suite/redaction-review");
      assert.equal(init?.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer session-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(payload.workspaceContextKey, "brand-lab");
      assert.equal(payload.decision, "approved");
      assert.equal(payload.note, "Secret coverage verified.");

      return jsonResponse({
        sessionPack: {
          sessionVersionId: "sev_brand_poster_suite",
          sessionId: "ses_brand_poster_suite",
          displayName: {
            zh: "Brand Poster Session",
            en: "Brand Poster Session",
          },
          summary: {
            zh: "Poster batch flow",
            en: "Poster batch flow",
          },
          manifestVersion: "lingban.session-pack/v1",
          primaryPackageId: "brand-poster-suite",
          sourcePackageIds: ["brand-poster-suite"],
          primaryTaskVersionId: "tsv_poster_batch",
          linkedServiceIds: ["poster-batch"],
          linkedWorkshopIds: ["brand-poster-suite"],
          workspaceContextKeys: ["brand-lab"],
          sourcePackageState: "ready",
          releaseChannel: {
            zh: "Production",
            en: "Production",
          },
          runtimeProfile: {
            profileId: "brand-poster-suite",
            runnerImage: "lingban/runner:2026.07",
            browserRequired: false,
            playwrightRequired: false,
          },
          requiredBindings: {
            firstPartyMcpIds: [],
            externalConnectorRefs: ["connector://imagegen/private-brand-key"],
            credentialIds: ["cred_image_brand"],
          },
          expectedRootFiles: ["manifest.json", "conversation.jsonl"],
          archiveSource: "imported",
          archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
          archiveSizeBytes: 4096,
          archiveRecordedAt: "2026-07-10T05:00:00.000Z",
          updatedAt: "2026-07-10T05:05:00.000Z",
          sourceReleaseIds: ["rel_brand_poster_prod"],
          activeActivationIds: ["act_brand_poster_prod"],
          runtimeAlternativeFiles: ["runtime-profile.json", "runtime-config.json"],
          optionalRootFiles: ["tool-events.jsonl", "validator-set.json", "redaction-map.json"],
          sourcePackages: [],
          informationCollectionReview: null,
          redactionSummary: {
            mapVersion: "curated.v2",
            slotSchemaVersion: "imported.v1",
            totalRules: 1,
            linkedSlotRuleCount: 1,
            linkedSecretSlotRuleCount: 1,
            unlinkedRuleCount: 0,
            orphanSlotKeyCount: 0,
            secretSlotCount: 1,
            coveredSecretSlotCount: 1,
            uncoveredSecretSlotCount: 0,
            secretCoverageComplete: true,
            targetKinds: ["json-path"],
            strategies: ["replace"],
            secretSlotKeys: ["tax_secret"],
            coveredSecretSlotKeys: ["tax_secret"],
            uncoveredSecretSlotKeys: [],
            orphanSlotKeys: [],
            previewMatchedRuleCount: 1,
            previewTotalMatches: 1,
            previewMutatedEntries: ["runtime-config.json"],
            previewUnmatchedRuleIds: [],
            previewError: null,
            rules: [
              {
                ruleId: "replace-tax-secret",
                slotKey: "tax_secret",
                targetKind: "json-path",
                selector: "runtime-config.json#$.env.TAX_SECRET",
                strategy: "replace",
                replacement: "[REDACTED]",
                rationale: "Replace runtime tax secret",
                linkedSlotExists: true,
                linkedSecretSlot: true,
                previewMatched: true,
                previewMatchCount: 1,
                previewMutatedEntries: ["runtime-config.json"],
              },
            ],
          },
          redactionReview: {
            decision: "approved",
            reviewedAt: "2026-07-10T05:05:00.000Z",
            reviewedByUserId: "usr_0001",
            note: "Secret coverage verified.",
            mapVersion: "curated.v2",
            totalRules: 1,
            previewMatchedRuleCount: 1,
            secretCoverageComplete: true,
          },
          archiveExportAudit: {
            totalExports: 2,
            redactedExportCount: 1,
            plainExportCount: 1,
            latestExportedAt: "2026-07-10T05:04:00.000Z",
            latestRedactedExportedAt: "2026-07-10T05:04:00.000Z",
            entries: [
              {
                exportId: "sex_sev_brand_poster_suite_20260710050400_r",
                exportedAt: "2026-07-10T05:04:00.000Z",
                exportedByUserId: "usr_0001",
                workspaceContextKey: "brand-lab",
                redacted: true,
                archiveSource: "imported",
                archiveFileName: "sev_brand_poster_suite.session-pack.json.gz",
                archiveSizeBytes: 2048,
                archiveSha256:
                  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              },
            ],
          },
          consumerGovernance: null,
        },
        reviewedAt: "2026-07-10T05:05:00.000Z",
        reviewedByUserId: "usr_0001",
        decision: "approved",
        persistedArchive: true,
      });
    },
  });

  const result = await client.reviewSessionPackRedaction("sev_brand_poster_suite", {
    workspaceContextKey: "brand-lab",
    decision: "approved",
    note: "Secret coverage verified.",
  });

  assert.equal(result.decision, "approved");
  assert.equal(result.persistedArchive, true);
  assert.equal(result.sessionPack.redactionReview?.decision, "approved");
  assert.equal(result.sessionPack.redactionReview?.note, "Secret coverage verified.");
  assert.equal(result.sessionPack.archiveExportAudit?.totalExports, 2);
  assert.equal(result.sessionPack.archiveExportAudit?.entries[0]?.redacted, true);
});

test("createSessionsApiClient downloads session-pack archives and serializes redaction query", async () => {
  const archive = new Uint8Array([9, 8, 7, 6]);
  const client = createSessionsApiClient({
    baseUrl: "http://example.test",
    fetcher: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/sessions/sev_imported_pack/archive");
      assert.equal(url.searchParams.get("redact"), "true");

      return new Response(Buffer.from(archive), {
        status: 200,
        headers: {
          "content-type": "application/gzip",
          "content-disposition":
            "attachment; filename=\"sev_imported_pack.session-pack.json.gz\"; filename*=UTF-8''sev_imported_pack.session-pack.json.gz",
          "x-lingban-session-pack-redacted": "true",
        },
      });
    },
  });

  const result = await client.downloadSessionPackArchive("sev_imported_pack", {
    redact: true,
  });
  assert.equal(result.contentType, "application/gzip");
  assert.equal(result.fileName, "sev_imported_pack.session-pack.json.gz");
  assert.equal(result.redacted, true);
  assert.deepEqual([...result.content], [...archive]);
});
