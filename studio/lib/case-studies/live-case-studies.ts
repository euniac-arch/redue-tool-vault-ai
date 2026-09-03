import type { Project } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
	formatRawScore,
	topPercentileFromScore,
	type DiagnosticCategoryId,
} from '@/lib/audit/onpage-diagnostic';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveReportTrack3Score } from '@/lib/audit/pagespeed';
import {
	getProjectCategoryLabel,
	normalizeProjectCategory,
} from '@/lib/project-categories';
import { formatTargetCategory } from '@/lib/audit/target-entity';
import { normalizeCaseStudyType } from '@/lib/projects';
import { preferProjectName, resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { toSolveCmsDisplay } from '@/lib/solve/types';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { getAuditProjectById, listAuditProjects } from '@/lib/firebase/audit-projects';
import type { AuditProjectDoc } from '@/lib/firebase/audit-projects-types';
import type { AuditReport } from '@/lib/site-auditor';
import type {
	CaseStudyActionTaken,
	CaseStudyAiEngine,
	CaseStudyAxis,
	CaseStudyData,
	CaseStudyDeficit,
	CaseStudyKind,
	CaseStudyScoreBand,
	Severity,
} from '@/lib/case-study-types';
import {
	parseCustomBaseline,
	resolveCaseStudyBaseline,
	type AxisScoreSnapshot,
	type CustomBaselineScores,
} from '@/lib/case-studies/custom-baseline';

/**
 * Admin-toggled case studies, scored only from stored diagnostic reports.
 * No domain, brand, or numeric literals are special-cased.
 */

const AXIS_DEFS: Array<{
	id: DiagnosticCategoryId;
	key: string;
	label: string;
	aliases: string[];
}> = [
	{ id: 'seo', key: 'seo', label: 'SEO 기술 기본기', aliases: ['seo', 'searchBasics', 'search_basics'] },
	{ id: 'performance', key: 'performance', label: '웹 성능 & CWV', aliases: ['performance', 'cwv', 'webPerf', 'web_perf'] },
	{ id: 'schema', key: 'schema', label: '스키마 구조화', aliases: ['schema'] },
	{ id: 'geo', key: 'geo', label: 'GEO & AI 신뢰도', aliases: ['geo', 'eeat', 'geoSignal', 'geo_signal', 'externalTrust'] },
];

interface AxisScore {
	id: DiagnosticCategoryId;
	score100: number;
	rawScore: number;
	maxScore: number;
}

interface AuditScorePacket {
	totalScore: number;
	scores: {
		seo: number;
		performance: number;
		schema: number;
		geo: number;
	};
	axes: AxisScore[];
	engines: CaseStudyAiEngine[];
	onpage: { totalRawScore: number; maxPossibleScore: number };
}

function hostKey(raw: string | null | undefined): string {
	if (!raw) return '';
	try {
		return new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}

function safeParseReport(json: string | null | undefined): AuditReport | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		return parsed && typeof parsed === 'object' ? (parsed as AuditReport) : null;
	} catch {
		return null;
	}
}

function asPercentScore(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	if (value < 0 || value > 100) return null;
	return Math.round(value);
}

function scoreBand(rawScore: number | null | undefined): CaseStudyScoreBand {
	const score = asPercentScore(rawScore) ?? 0;
	const percentile = topPercentileFromScore(score);
	if (score >= 80) {
		return { score, maxScore: 100, tone: 'good', label: `상위 추천 선점 · 상위 ${percentile}%` };
	}
	if (score >= 60) {
		return { score, maxScore: 100, tone: 'warning', label: `개선 권장 · 상위 ${percentile}%` };
	}
	return { score, maxScore: 100, tone: 'critical', label: `노출 위험 · 상위 ${percentile}%` };
}

function readRecordScore(source: unknown, aliases: string[]): number | null {
	if (!source || typeof source !== 'object') return null;
	const record = source as Record<string, unknown>;
	for (const alias of aliases) {
		const direct = asPercentScore(record[alias]);
		if (direct != null) return direct;
		const nested = record[alias];
		if (nested && typeof nested === 'object') {
			const bag = nested as Record<string, unknown>;
			const fromNested = asPercentScore(bag.score ?? bag.score100 ?? bag.value ?? bag.percentage);
			if (fromNested != null) return fromNested;
		}
	}
	return null;
}

function categoryById(report: AuditReport, id: string) {
	return report.categories?.find((cat) => cat.id === id) ?? null;
}

function categoryPercent(report: AuditReport, id: string): number | null {
	const cat = categoryById(report, id);
	if (!cat) return null;
	if (typeof cat.maxScore === 'number' && cat.maxScore > 0 && typeof cat.score === 'number') {
		return asPercentScore(Math.round((cat.score / cat.maxScore) * 100));
	}
	return asPercentScore(cat.score);
}

/**
 * One audit → one score packet. Prefers the same snapshot the result page
 * uses (`measuredScore` + 4 on-page axes). Also reads any stored `scores`
 * bag (seo / performance / cwv / schema / geo / eeat) so older logs bind
 * without a recompute.
 *
 * `preferStoredTotal` keeps the row-level `AuditLead.score` / `totalScore`
 * for the baseline (최초 진단) when report JSON was later overwritten.
 */
function scoresFromReport(
	report: AuditReport,
	opts?: { leadScore?: number | null; preferStoredTotal?: boolean },
): AuditScorePacket | null {
	try {
		const stored = (report as AuditReport & { scores?: Record<string, unknown>; totalScore?: unknown }).scores;
		const storedTotal = asPercentScore(
			(report as AuditReport & { totalScore?: unknown }).totalScore,
		);

		const track3 = resolveReportTrack3Score(report);
		const snapshot = buildDiagnosisScoreSnapshot(report, null, report.lang === 'en' ? 'en' : 'ko', {
			coreWebVitalsScore100: track3,
		});
		const byId = new Map(snapshot.onpage.categories.map((cat) => [cat.id, cat]));

		const pickAxis = (def: (typeof AXIS_DEFS)[number]): AxisScore => {
			const cat = byId.get(def.id);
			const fromStored = readRecordScore(stored, def.aliases);
			const fromCategory = categoryPercent(report, def.id);
			const fromSnapshot = asPercentScore(cat?.score100);
			const fromCwv = def.id === 'performance' ? asPercentScore(track3) : null;
			const score100 = fromCwv ?? fromStored ?? fromSnapshot ?? fromCategory ?? 0;
			return {
				id: def.id,
				score100,
				rawScore: cat?.rawScore ?? categoryById(report, def.id)?.score ?? 0,
				maxScore: cat?.maxScore ?? categoryById(report, def.id)?.maxScore ?? 0,
			};
		};

		const axes = AXIS_DEFS.map(pickAxis);
		const computedTotal =
			asPercentScore(snapshot.measuredScore) ??
			storedTotal ??
			asPercentScore(report.score) ??
			asPercentScore(opts?.leadScore) ??
			0;
		const frozenLead = asPercentScore(opts?.leadScore);
		const totalScore =
			opts?.preferStoredTotal && frozenLead != null
				? frozenLead
				: computedTotal;

		return {
			totalScore,
			scores: {
				seo: axes.find((a) => a.id === 'seo')?.score100 ?? 0,
				performance: axes.find((a) => a.id === 'performance')?.score100 ?? 0,
				schema: axes.find((a) => a.id === 'schema')?.score100 ?? 0,
				geo: axes.find((a) => a.id === 'geo')?.score100 ?? 0,
			},
			axes,
			engines: (snapshot.engines ?? []).map((engine) => ({
				engine: engine.engineLabel,
				stars: engine.stars,
				statusLabel: engine.statusLabel,
				reason: engine.reason,
			})),
			onpage: {
				totalRawScore: snapshot.onpage.totalRawScore,
				maxPossibleScore: snapshot.onpage.maxPossibleScore,
			},
		};
	} catch (err) {
		console.error('[live-case-studies] scoresFromReport failed:', err);
		return null;
	}
}

type FallbackScore = {
	overall: number | null;
	seo: number | null;
	geo: number | null;
	schema: number | null;
};

function fallbackAxisScore(def: (typeof AXIS_DEFS)[number], fallback: FallbackScore | null): number | null {
	if (def.id === 'seo') return asPercentScore(fallback?.seo);
	if (def.id === 'geo') return asPercentScore(fallback?.geo);
	if (def.id === 'schema') return asPercentScore(fallback?.schema);
	return null;
}

function buildAxis(
	def: (typeof AXIS_DEFS)[number],
	beforePacket: AuditScorePacket | null,
	afterPacket: AuditScorePacket | null,
	fallback: FallbackScore | null,
	hasBaseline: boolean,
): CaseStudyAxis {
	const beforeCat = beforePacket?.axes.find((c) => c.id === def.id) ?? null;
	const afterCat = afterPacket?.axes.find((c) => c.id === def.id) ?? null;
	const fallbackValue = fallbackAxisScore(def, fallback);

	const afterScore = asPercentScore(afterCat?.score100) ?? fallbackValue ?? 0;
	const beforeScore = hasBaseline ? (asPercentScore(beforeCat?.score100) ?? 0) : 0;

	const axis: CaseStudyAxis = {
		key: def.key,
		label: def.label,
		before: {
			score: beforeScore,
			raw: beforeCat ? `${formatRawScore(beforeCat.rawScore)}/${beforeCat.maxScore}` : `${beforeScore}/100`,
		},
		after: {
			score: afterScore,
			raw: afterCat ? `${formatRawScore(afterCat.rawScore)}/${afterCat.maxScore}` : undefined,
		},
	};

	if (def.id === 'schema') {
		if (beforeScore === 0) axis.before.badge = { label: 'FAIL', tone: 'critical' };
		if (afterScore >= 95) axis.after.badge = { label: 'PASS', tone: 'good' };
	} else if (def.id === 'geo') {
		if (beforeScore > 0 && beforeScore < 60) axis.before.badge = { label: 'WARN', tone: 'warning' };
	}

	return axis;
}

function resolutionForDeficit(title: string): string {
	const text = title.toLowerCase();
	if (/organization|logo|sameas|엔티티|entity/.test(text)) return '엔티티 및 스키마 보강';
	if (/json-ld|schema|스키마/.test(text)) return 'LLM 친화적 구조화 데이터 자동 주입 완료';
	if (/alt|image|이미지|접근성/.test(text)) return '접근성 및 키워드 최적화 완료';
	if (/geo|eeat|인용|faq/.test(text)) return 'GEO 인용 신호 및 E-E-A-T 보정 완료';
	return 'REDUE AI 처방 적용 및 재검증 완료';
}

function buildDeficits(report: AuditReport | null | undefined): CaseStudyDeficit[] {
	if (!report?.categories?.length) return [];
	return report.categories
		.flatMap((cat) => cat.checks?.map((check) => ({ check })) ?? [])
		.filter(({ check }) => !check.passed)
		.sort((a, b) => (b.check.weight ?? 0) - (a.check.weight ?? 0))
		.slice(0, 3)
		.map(({ check }): CaseStudyDeficit => ({
			severity: (check.status === 'warning' ? 'medium' : (check.weight ?? 0) >= 8 ? 'critical' : 'high') as Severity,
			title: check.label,
			impact: check.impact || check.why || '개선이 필요한 항목입니다.',
			resolution: resolutionForDeficit(check.label || check.id || ''),
		}));
}

function buildActionsTaken(
	beforeReport: AuditReport | null | undefined,
	afterReport: AuditReport | null | undefined,
): CaseStudyActionTaken[] {
	if (!beforeReport?.categories?.length || !afterReport?.categories?.length) return [];
	const beforeFails = new Map(
		beforeReport.categories.flatMap((cat) => (cat.checks ?? []).filter((c) => !c.passed).map((c) => [c.id, c] as const)),
	);
	return afterReport.categories
		.flatMap((cat) => cat.checks ?? [])
		.filter((check) => check.passed && beforeFails.has(check.id))
		.slice(0, 3)
		.map((check): CaseStudyActionTaken => ({ title: check.label, detail: check.why || undefined }));
}

/**
 * Card badge: same full diagnostic category as `/audit/result` (`formatTargetCategory`).
 * Never truncate "의료 / 피부시술" down to "피부시술" or remap to a project code label.
 */
function resolveCategoryLabel(report: AuditReport | null | undefined, projectCategory?: string | null): string {
	if (report?.siteMeta) {
		const formatted = formatTargetCategory(report.siteMeta, report.lang === 'en' ? 'en' : 'ko').trim();
		if (formatted) return formatted;
	}
	const metaCategory = report?.siteMeta?.category?.trim();
	if (metaCategory) return metaCategory;
	if (projectCategory && /[가-힣/／]/.test(projectCategory)) return projectCategory.trim();
	if (projectCategory) return getProjectCategoryLabel(normalizeProjectCategory(projectCategory));
	return getProjectCategoryLabel(normalizeProjectCategory(null));
}

interface HistoryRow {
	id: string;
	reportJson?: string | null;
	createdAt: Date;
	url?: string | null;
	score?: number | null;
}

interface AuditHistoryLog {
	id: string;
	createdAt: Date;
	report: AuditReport | null;
	score: number | null;
}

interface ResolvedHistory {
	logs: AuditHistoryLog[];
	verifiedAt?: string;
}

const NEAR_DUP_MS = 90_000;

function reportRichness(report: AuditReport): number {
	let richness = 0;
	if (report.pageSpeedMobile || report.pageSpeedDesktop) richness += 2;
	if (report.categories?.length) richness += 1;
	if (report.siteMeta) richness += 1;
	return richness;
}

function toHistoryLog(row: HistoryRow): AuditHistoryLog {
	return {
		id: row.id,
		createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
		report: safeParseReport(row.reportJson),
		score: asPercentScore(row.score),
	};
}

function preferHistoryRow(existing: HistoryRow, incoming: HistoryRow): HistoryRow {
	const existingPct = asPercentScore(existing.score);
	const incomingPct = asPercentScore(incoming.score);
	if (existingPct == null && incomingPct != null) return incoming;
	if (!existing.reportJson && incoming.reportJson) return incoming;
	return existing;
}

function addHistoryRow(byId: Map<string, HistoryRow>, row: HistoryRow | null | undefined, host?: string) {
	if (!row?.id) return;
	if (host && row.url && hostKey(row.url) && hostKey(row.url) !== host) return;
	const existing = byId.get(row.id);
	byId.set(row.id, existing ? preferHistoryRow(existing, row) : row);
}

/** Collapse same-scan copies (AuditLead + AuditReport) that share score + timestamp. */
function dedupeNearDuplicateLogs(rows: HistoryRow[]): HistoryRow[] {
	const sorted = [...rows].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);
	const kept: HistoryRow[] = [];
	for (const row of sorted) {
		const stamp = new Date(row.createdAt).getTime();
		const parsed = safeParseReport(row.reportJson);
		const twin = kept.find((existing) => {
			const sameScore = asPercentScore(existing.score) === asPercentScore(row.score);
			const close = Math.abs(new Date(existing.createdAt).getTime() - stamp) < NEAR_DUP_MS;
			const existingReport = safeParseReport(existing.reportJson);
			const sameFetch =
				parsed?.fetchedAt &&
				existingReport?.fetchedAt &&
				parsed.fetchedAt === existingReport.fetchedAt;
			return (sameScore && close) || Boolean(sameFetch && sameScore);
		});
		if (!twin) {
			kept.push(row);
			continue;
		}
		const twinReport = safeParseReport(twin.reportJson);
		if (parsed && (!twinReport || reportRichness(parsed) > reportRichness(twinReport))) {
			const idx = kept.indexOf(twin);
			if (idx >= 0) kept[idx] = row;
		}
	}
	return kept;
}

function parseHistoryRows(rows: HistoryRow[]): ResolvedHistory {
	const unique = dedupeNearDuplicateLogs(rows);
	const logs = unique.map(toHistoryLog);
	const lastCreatedAt = unique[unique.length - 1]?.createdAt;
	return {
		logs,
		verifiedAt: lastCreatedAt ? new Date(lastCreatedAt).toISOString().slice(0, 10) : undefined,
	};
}

const HISTORY_META_SELECT = {
	id: true,
	createdAt: true,
	url: true,
	score: true,
} as const;

async function loadHistoryByHost(host: string): Promise<HistoryRow[]> {
	if (!host) return [];
	try {
		const rows = await prisma.auditLead.findMany({
			where: { url: { contains: host } },
			orderBy: { createdAt: 'asc' },
			select: HISTORY_META_SELECT,
		});
		return rows
			.filter((row) => hostKey(row.url) === host)
			.map((row) => ({ ...row, reportJson: null }));
	} catch (err) {
		console.error('[live-case-studies] host lead query failed:', err);
		return [];
	}
}

async function hydrateReportJson(
	rows: HistoryRow[],
	opts?: { preferAuditReport?: boolean },
): Promise<HistoryRow[]> {
	const targets = rows.filter((row) => row.id && (opts?.preferAuditReport || !row.reportJson));
	if (!targets.length) return rows;
	const byId = new Map(rows.map((row) => [row.id, row]));
	const ids = targets.map((row) => row.id);

	// AuditReport keeps the frozen snapshot; AuditLead.reportJson is often overwritten on rescan.
	try {
		const reports = await prisma.auditReport.findMany({
			where: { id: { in: ids } },
			select: { id: true, reportJson: true },
		});
		for (const report of reports) {
			const current = byId.get(report.id);
			if (current && report.reportJson) current.reportJson = report.reportJson;
		}
	} catch (err) {
		console.error('[live-case-studies] report hydrate failed:', err);
	}

	const stillMissing = ids.filter((id) => !byId.get(id)?.reportJson);
	if (stillMissing.length) {
		try {
			const leads = await prisma.auditLead.findMany({
				where: { id: { in: stillMissing } },
				select: { id: true, reportJson: true },
			});
			for (const lead of leads) {
				const current = byId.get(lead.id);
				if (current && lead.reportJson) current.reportJson = lead.reportJson;
			}
		} catch (err) {
			console.error('[live-case-studies] lead hydrate failed:', err);
		}
	}

	return rows;
}

function firestoreDocToRow(doc: AuditProjectDoc): HistoryRow {
	return {
		id: doc.id,
		reportJson: doc.auditPayload?.report ? JSON.stringify(doc.auditPayload.report) : null,
		createdAt: new Date(doc.createdAt),
		url: doc.url,
		score: doc.score,
	};
}

/**
 * 해당 도메인(또는 projectId)의 전체 진단 로그를 생성일 ASC로 수집.
 * projectId 연결분 + 동일 호스트 AuditLead + AuditReport + latestAuditId + Firestore를 합친다.
 * 단일 소스에서 1건이 나와도 다른 소스를 건너뛰지 않는다.
 */
async function getAuditsByDomainOrProjectId(args: {
	projectId?: string | null;
	host: string;
	latestAuditId?: string | null;
	seedRows?: HistoryRow[];
	firestoreDocs?: AuditProjectDoc[];
}): Promise<HistoryRow[]> {
	const byId = new Map<string, HistoryRow>();
	const host = args.host;

	for (const row of args.seedRows ?? []) addHistoryRow(byId, row, host);

	if (args.projectId) {
		try {
			const linked = await prisma.auditLead.findMany({
				where: { projectId: args.projectId },
				orderBy: { createdAt: 'asc' },
				select: HISTORY_META_SELECT,
			});
			for (const row of linked) addHistoryRow(byId, { ...row, reportJson: null }, host);
		} catch (err) {
			console.error('[live-case-studies] projectId lead query failed:', err);
		}
	}

	if (host) {
		const byHost = await loadHistoryByHost(host);
		for (const row of byHost) addHistoryRow(byId, row, host);

		try {
			const persisted = await prisma.auditReport.findMany({
				where: { domain: host },
				orderBy: { createdAt: 'asc' },
				select: { id: true, createdAt: true, domain: true, score: true },
			});
			for (const row of persisted) {
				addHistoryRow(
					byId,
					{ id: row.id, reportJson: null, createdAt: row.createdAt, url: row.domain, score: row.score },
					host,
				);
			}
		} catch (err) {
			console.error('[live-case-studies] domain AuditReport query failed:', err);
		}
	}

	const latestId = args.latestAuditId?.trim();
	if (latestId && !byId.has(latestId)) {
		try {
			const latestLead = await prisma.auditLead.findUnique({
				where: { id: latestId },
				select: HISTORY_META_SELECT,
			});
			if (latestLead) {
				addHistoryRow(byId, { ...latestLead, reportJson: null }, host);
			} else {
				const latestReport = await prisma.auditReport.findUnique({
					where: { id: latestId },
					select: { id: true, createdAt: true, domain: true, score: true },
				});
				if (latestReport) {
					addHistoryRow(
						byId,
						{
							id: latestReport.id,
							reportJson: null,
							createdAt: latestReport.createdAt,
							url: latestReport.domain,
							score: latestReport.score,
						},
						host,
					);
				}
			}
		} catch (err) {
			console.error('[live-case-studies] latestAuditId query failed:', err);
		}
	}

	for (const doc of args.firestoreDocs ?? []) {
		if (host && hostKey(doc.url) !== host) continue;
		addHistoryRow(byId, firestoreDocToRow(doc), host);
	}

	const ordered = [...byId.values()].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);
	const unique = dedupeNearDuplicateLogs(ordered);
	if (!unique.length) return unique;

	const initial = unique[0];
	const latest = unique[unique.length - 1];
	await hydrateReportJson([initial], { preferAuditReport: true });
	if (latest.id !== initial.id) {
		await hydrateReportJson([latest], { preferAuditReport: !latest.reportJson });
	}
	return unique;
}

async function loadHistoryForProject(
	project: Pick<Project, 'id' | 'targetUrl' | 'latestAuditId'> & {
		auditLeads?: HistoryRow[];
	},
	firestoreDocs?: AuditProjectDoc[],
): Promise<ResolvedHistory> {
	const host = hostKey(project.targetUrl);
	const rows = await getAuditsByDomainOrProjectId({
		projectId: project.id,
		host,
		latestAuditId: project.latestAuditId,
		seedRows: project.auditLeads,
		firestoreDocs,
	});
	return parseHistoryRows(rows);
}

function pickInitialAndLatest(logs: AuditHistoryLog[]): {
	initial: AuditHistoryLog | null;
	latest: AuditHistoryLog | null;
	hasBaseline: boolean;
} {
	if (!logs.length) return { initial: null, latest: null, hasBaseline: false };
	const initial = logs[0];
	const latest = logs[logs.length - 1];
	const distinct = initial.id !== latest.id;
	return { initial, latest, hasBaseline: distinct };
}

function axesFromPacket(packet: AuditScorePacket | null): AxisScoreSnapshot | null {
	if (!packet) return null;
	return {
		seo: packet.scores.seo,
		performance: packet.scores.performance,
		schema: packet.scores.schema,
		geo: packet.scores.geo,
	};
}

function packetFromBaseline(baseline: CustomBaselineScores): AuditScorePacket {
	const seo = asPercentScore(baseline.seo) ?? 0;
	const performance = asPercentScore(baseline.performance) ?? 0;
	const schema = asPercentScore(baseline.schema) ?? 0;
	const geo = asPercentScore(baseline.geo) ?? 0;
	return {
		totalScore: asPercentScore(baseline.overall) ?? 0,
		scores: { seo, performance, schema, geo },
		axes: AXIS_DEFS.map((def) => {
			const score100 =
				def.id === 'seo'
					? seo
					: def.id === 'performance'
						? performance
						: def.id === 'schema'
							? schema
							: geo;
			return { id: def.id, score100, rawScore: score100, maxScore: 100 };
		}),
		engines: [],
		onpage: { totalRawScore: 0, maxPossibleScore: 0 },
	};
}

function readStoredCustomBaseline(source: unknown): CustomBaselineScores | null {
	if (!source || typeof source !== 'object') return null;
	const row = source as { customBaseline?: unknown };
	return parseCustomBaseline(row.customBaseline);
}

function packetFromLog(log: AuditHistoryLog | null, preferStoredTotal: boolean): AuditScorePacket | null {
	if (!log) return null;
	if (log.report) {
		return scoresFromReport(log.report, { leadScore: log.score, preferStoredTotal });
	}
	if (log.score == null) return null;
	return {
		totalScore: log.score,
		scores: { seo: 0, performance: 0, schema: 0, geo: 0 },
		axes: AXIS_DEFS.map((def) => ({ id: def.id, score100: 0, rawScore: 0, maxScore: 0 })),
		engines: [],
		onpage: { totalRawScore: 0, maxPossibleScore: 0 },
	};
}

function buildCaseStudyFromReports(args: {
	id: string;
	kind: CaseStudyKind;
	name: string;
	domain: string;
	domainUrl: string;
	projectCategory?: string | null;
	techStack: string;
	logs: AuditHistoryLog[];
	fallbackScore?: FallbackScore | null;
	verifiedAt?: string;
	latestAuditId?: string | null;
	customBaseline?: CustomBaselineScores | null;
}): CaseStudyData {
	const { logs, fallbackScore } = args;
	const { initial, latest, hasBaseline: hasAuditBaseline } = pickInitialAndLatest(logs);

	const beforeAudit = hasAuditBaseline ? initial?.report ?? null : null;
	const afterAudit = latest?.report ?? initial?.report ?? null;

	const afterPacket = packetFromLog(latest, false);
	const auditBeforePacket = hasAuditBaseline ? packetFromLog(initial, true) : null;

	const afterOverall = afterPacket?.totalScore ?? asPercentScore(fallbackScore?.overall) ?? 0;
	const afterAxes: AxisScoreSnapshot = axesFromPacket(afterPacket) ?? {
		seo: asPercentScore(fallbackScore?.seo) ?? 0,
		performance: 0,
		schema: asPercentScore(fallbackScore?.schema) ?? 0,
		geo: asPercentScore(fallbackScore?.geo) ?? 0,
	};

	const resolved = resolveCaseStudyBaseline({
		customBaseline: args.customBaseline,
		beforeOverall: hasAuditBaseline ? (auditBeforePacket?.totalScore ?? null) : null,
		afterOverall,
		beforeAxes: axesFromPacket(auditBeforePacket),
		afterAxes,
	});

	const beforePacket = resolved.baseline
		? packetFromBaseline(resolved.baseline)
		: auditBeforePacket;
	const hasBaseline = Boolean(beforePacket) && (hasAuditBaseline || resolved.source !== 'audit');

	const beforeOverall = hasBaseline ? (beforePacket?.totalScore ?? 0) : 0;

	const axes = AXIS_DEFS.map((def) =>
		buildAxis(def, beforePacket, afterPacket, fallbackScore ?? null, hasBaseline),
	);
	const metaReport = afterAudit ?? beforeAudit;
	const latestAuditId = latest?.id || args.latestAuditId || undefined;
	const resultHref = latestAuditId
		? `/audit/result?id=${encodeURIComponent(latestAuditId)}`
		: `/portfolio/case-study/${args.id}`;

	if (process.env.NODE_ENV !== 'production') {
		console.info('[live-case-studies]', {
			id: args.id,
			logCount: logs.length,
			hasBaseline,
			initialId: initial?.id,
			latestId: latest?.id,
			before: { totalScore: beforeOverall, scores: beforePacket?.scores },
			after: { totalScore: afterOverall, scores: afterPacket?.scores },
		});
	}

	return {
		id: args.id,
		kind: args.kind,
		latestAuditId,
		resultHref,
		hasBaseline,
		siteInfo: {
			name: args.name,
			domain: args.domain || args.domainUrl,
			domainUrl: args.domainUrl,
			category: resolveCategoryLabel(metaReport, args.projectCategory),
			techStack: args.techStack,
			httpsEnabled: metaReport?.hasSsl ?? true,
			ttfbMs: metaReport?.responseTimeMs ?? 0,
			ttfbTone: (metaReport?.responseTimeMs ?? 999) <= 200 ? 'good' : 'warning',
		},
		normalizedScore: {
			before: scoreBand(beforeOverall),
			after: scoreBand(afterOverall),
		},
		algorithmScore: {
			before: hasBaseline ? (beforePacket?.onpage.totalRawScore ?? 0) : 0,
			after: afterPacket?.onpage.totalRawScore ?? 0,
			maxScore: afterPacket?.onpage.maxPossibleScore ?? beforePacket?.onpage.maxPossibleScore ?? 0,
		},
		axes,
		deficits: buildDeficits(hasBaseline ? beforeAudit : afterAudit),
		aiEngines: afterPacket?.engines ?? beforePacket?.engines ?? [],
		actionsTaken: (() => {
			const taken = hasBaseline ? buildActionsTaken(beforeAudit, afterAudit) : [];
			if (taken.length) return taken;
			return buildDeficits(hasBaseline ? beforeAudit : afterAudit).map((deficit) => ({
				title: deficit.title,
				detail: deficit.resolution,
			}));
		})(),
		verifiedAt: args.verifiedAt,
	};
}

async function buildFromPrismaProject(
	project: Project & { auditLeads?: HistoryRow[] },
	firestoreDocs?: AuditProjectDoc[],
): Promise<CaseStudyData | null> {
	const caseStudyType = normalizeCaseStudyType(project.caseStudyType);
	if (!caseStudyType) return null;

	const { logs, verifiedAt } = await loadHistoryForProject(project, firestoreDocs);

	return buildCaseStudyFromReports({
		id: project.id,
		kind: caseStudyType,
		name: preferProjectName(project.name, null, project.targetUrl),
		domain: hostKey(project.targetUrl),
		domainUrl: project.targetUrl,
		projectCategory: project.category,
		techStack: toSolveCmsDisplay(project.cmsType),
		logs,
		fallbackScore: {
			overall: asPercentScore(project.latestScore),
			seo: asPercentScore(project.latestSeoScore),
			geo: asPercentScore(project.latestGeoScore),
			schema: asPercentScore(project.latestSchemaScore),
		},
		verifiedAt: verifiedAt ?? project.updatedAt?.toISOString().slice(0, 10),
		latestAuditId: project.latestAuditId,
		customBaseline: readStoredCustomBaseline(project as Project & { customBaseline?: unknown }),
	});
}

async function buildFromFirestoreDoc(
	doc: AuditProjectDoc,
	firestoreDocs?: AuditProjectDoc[],
): Promise<CaseStudyData | null> {
	const caseStudyType = normalizeCaseStudyType(doc.caseStudyType);
	if (!caseStudyType) return null;

	const report = doc.auditPayload?.report ?? null;
	const host = hostKey(doc.url);
	const rows = await getAuditsByDomainOrProjectId({
		host,
		latestAuditId: doc.id,
		firestoreDocs: firestoreDocs ?? [doc],
		seedRows: [firestoreDocToRow(doc)],
	});
	const { logs, verifiedAt } = parseHistoryRows(rows);
	const seoCat = report?.categories?.find((c) => c.id === 'seo');

	return buildCaseStudyFromReports({
		id: doc.id,
		kind: caseStudyType,
		name: preferProjectName(doc.siteName, report ? resolveProjectSiteName(report) : null, doc.url),
		domain: host,
		domainUrl: doc.url,
		projectCategory: report?.siteMeta?.category ?? report?.siteMeta?.industryType ?? null,
		techStack: toSolveCmsDisplay(doc.auditPayload?.cmsType ?? report?.cmsType),
		logs,
		fallbackScore: {
			overall: asPercentScore(doc.score),
			seo: seoCat
				? asPercentScore(Math.round((seoCat.score / Math.max(seoCat.maxScore, 1)) * 100))
				: asPercentScore(doc.score),
			geo: asPercentScore(report?.geoCitationScore),
			schema: asPercentScore(report?.schemaCoverage),
		},
		verifiedAt: verifiedAt ?? doc.createdAt?.slice(0, 10),
		latestAuditId: doc.id,
		customBaseline: parseCustomBaseline(doc.customBaseline),
	});
}

export async function getLiveCaseStudies(): Promise<CaseStudyData[]> {
	const results: CaseStudyData[] = [];
	const seenHosts = new Set<string>();

	let firestoreDocs: AuditProjectDoc[] = [];
	if (isFirebaseAdminConfigured()) {
		try {
			firestoreDocs = await listAuditProjects(200);
		} catch (err) {
			console.error('[live-case-studies] Firestore list failed:', err);
		}
	}

	try {
		const projects = await prisma.project.findMany({
			where: { isCaseStudy: true },
			orderBy: { createdAt: 'desc' },
			include: {
				auditLeads: {
					orderBy: { createdAt: 'asc' },
					select: HISTORY_META_SELECT,
				},
			},
		});
		for (const project of projects) {
			const host = hostKey(project.targetUrl);
			if (host && seenHosts.has(host)) continue;
			const data = await buildFromPrismaProject(project, firestoreDocs);
			if (!data) continue;
			results.push(data);
			if (host) seenHosts.add(host);
		}
	} catch (err) {
		console.error('[live-case-studies] Prisma query failed:', err);
	}

	if (firestoreDocs.length) {
		try {
			for (const doc of firestoreDocs) {
				if (!doc.isCaseStudy || !doc.caseStudyType) continue;
				const host = hostKey(doc.url);
				if (host && seenHosts.has(host)) continue;
				const data = await buildFromFirestoreDoc(doc, firestoreDocs);
				if (!data) continue;
				results.push(data);
				if (host) seenHosts.add(host);
			}
		} catch (err) {
			console.error('[live-case-studies] Firestore query failed:', err);
		}
	}

	return results.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'verified' ? -1 : 1;
		return (b.verifiedAt || '').localeCompare(a.verifiedAt || '');
	});
}

export async function getLiveCaseStudyById(id: string): Promise<CaseStudyData | null> {
	const key = typeof id === 'string' ? id.trim() : '';
	if (!key) return null;

	try {
		const project = await prisma.project.findUnique({
			where: { id: key },
			include: {
				auditLeads: {
					orderBy: { createdAt: 'asc' },
					select: HISTORY_META_SELECT,
				},
			},
		});
		if (project?.isCaseStudy) {
			const firestoreDocs = isFirebaseAdminConfigured()
				? await listAuditProjects(200).catch(() => [] as AuditProjectDoc[])
				: [];
			const data = await buildFromPrismaProject(project, firestoreDocs);
			if (data) return data;
		}
	} catch (err) {
		console.error('[live-case-studies] Prisma by-id lookup failed:', err);
	}

	if (isFirebaseAdminConfigured()) {
		try {
			const doc = await getAuditProjectById(key);
			if (doc?.isCaseStudy && doc.caseStudyType) {
				const firestoreDocs = await listAuditProjects(200).catch(() => [] as AuditProjectDoc[]);
				const data = await buildFromFirestoreDoc(doc, firestoreDocs);
				if (data) return data;
			}
		} catch (err) {
			console.error('[live-case-studies] Firestore by-id lookup failed:', err);
		}
	}

	try {
		const all = await getLiveCaseStudies();
		return all.find((item) => item.id === key) ?? null;
	} catch (err) {
		console.error('[live-case-studies] fallback list lookup failed:', err);
		return null;
	}
}
