/**
 * 실시간 진단(라이브) 결과를 경량 `RoundSnapshot`으로 정제(sanitize)하는 순수 함수.
 * 클라이언트/서버 양쪽에서 안전하게 import 가능 — Firebase SDK 의존 없음.
 */

import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import type { DomainMilestoneHistory, MilestoneRound, MilestoneSnapshot } from '@/lib/audit/milestone-types';
import { MILESTONE_ROUND_META } from '@/lib/audit/milestone-types';
import {
	TRACKING_ROUND_LABEL,
	type AuditTrackingDoc,
	type RoundSnapshot,
	type TrackingRound,
} from '@/lib/audit/round-tracking-types';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

export { sanitizeUrlToDocId } from '@/lib/audit/round-tracking-types';

function hasSchemaTypeLike(types: string[] | undefined, pattern: RegExp): boolean {
	return Boolean(types?.some((t) => pattern.test(t)));
}

/**
 * 라이브 진단 결과(전체 `AuditReport` + GEO 내러티브)에서 저장할 필요가 있는
 * 핵심 메트릭만 뽑아 경량 스냅샷으로 정제한다. 원시 DOM/HTML/JSON-LD 풀 코퍼스,
 * 체크리스트 근거 문장 등 용량이 큰 필드는 절대 포함하지 않는다.
 */
export function buildRoundSnapshot(
	report: AuditReport,
	geoNarrative: GeoNarrativeReport | null | undefined,
	lang: AuditLang,
	round: TrackingRound,
	isLocked: boolean,
	options?: { coreWebVitalsScore100?: number | null },
): RoundSnapshot {
	const scoreSnapshot = buildDiagnosisScoreSnapshot(report, geoNarrative ?? null, lang, {
		coreWebVitalsScore100: options?.coreWebVitalsScore100,
	});
	const metrics = report.metrics;
	const detectedSchemas = metrics?.schemaTypes ?? [];
	const hasFaqSchema = Boolean(
		report.checklist?.find((item) => item.id === 'faq-howto-schema')?.passed,
	) || hasSchemaTypeLike(detectedSchemas, /faqpage|howto/i);

	return {
		savedAt: new Date().toISOString(),
		roundLabel: TRACKING_ROUND_LABEL[round],
		scores: {
			total: scoreSnapshot.measuredScore,
			grade: scoreSnapshot.grade,
			seo: scoreSnapshot.radarScores.seo,
			aeo: scoreSnapshot.externalTrustScore,
			geo: scoreSnapshot.geoComprehensive.rawGeoScore,
			schema: scoreSnapshot.radarScores.schema,
		},
		metrics: {
			altCoverageRate: metrics?.imageAltCoveragePct ?? 0,
			altMissingCount: metrics?.imagesMissingAlt ?? 0,
			hasLlmsTxt: Boolean(metrics?.hasLlmsTxt),
			hasFaqSchema,
			hasSpeakable: hasSchemaTypeLike(detectedSchemas, /speakable/i),
			detectedSchemas,
		},
		isLocked,
	};
}

/**
 * Firestore에서 받아온 경량 히스토리(`AuditTrackingDoc`)를 로컬 마일스톤 히스토리에
 * 병합한다. 로컬에 이미 전체 데이터(`data`)가 있는 회차는 그 데이터를 유지한 채
 * `roundSnapshot`(점수 요약)만 최신화하고, 로컬에 아예 없던 회차는 경량 데이터만
 * 가진 "shell" 스냅샷으로 새로 채워 넣어 다른 기기에서도 회차 배지/점수가 보이게 한다.
 */
export function mergeTrackingIntoMilestoneHistory(
	local: DomainMilestoneHistory,
	remote: AuditTrackingDoc,
): DomainMilestoneHistory {
	const mergedSnapshots: DomainMilestoneHistory['snapshots'] = { ...local.snapshots };

	(Object.keys(remote.rounds) as Array<`${TrackingRound}`>).forEach((roundKey) => {
		const round = Number(roundKey) as MilestoneRound;
		const roundSnapshot = remote.rounds[round as unknown as TrackingRound];
		if (!roundSnapshot) return;
		const localSnap = local.snapshots[round];
		if (localSnap) {
			mergedSnapshots[round] = { ...localSnap, roundSnapshot, isLocked: true };
			return;
		}
		const shell: MilestoneSnapshot = {
			round,
			title: MILESTONE_ROUND_META[round].defaultTitle,
			date: roundSnapshot.savedAt.slice(0, 10),
			lockedAt: roundSnapshot.savedAt,
			isLocked: true,
			roundSnapshot,
			data: undefined,
		};
		mergedSnapshots[round] = shell;
	});

	return { ...local, snapshots: mergedSnapshots };
}
