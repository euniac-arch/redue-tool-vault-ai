/**
 * Shared live-diagnostic score weights.
 * History list, rerun persist, and `/api/diagnostics/live` all compose
 * `totalScore` from the same Meta 30 + JSON-LD 40 + Knowledge Graph 30 table.
 */
import { normalizeSchemaType, parseJsonLdDocument } from '@/lib/audit/parser';
import {
	extractUniversalSameAs,
	harvestHttpUrls,
	validateChannelSignals,
} from '@/lib/audit/extractors/universal-same-as';
import type { AuditReport } from '@/lib/site-auditor';
import {
	LIVE_INDUSTRY_LABEL,
	type LiveDetectedSchema,
	type LiveDiagnosticIndustry,
	type LiveDiagnosticIssue,
	type LiveDiagnosticScores,
	type LiveIssueSeverity,
	type LiveMetaSnapshot,
	type LiveScoreBreakdown,
} from './liveDiagnosticTypes';

export const LIVE_SCORE_WEIGHTS = {
	meta: 30,
	jsonLd: 40,
	knowledgeGraph: 30,
} as const;

export const LIVE_SCORE_WEIGHT_TOTAL =
	LIVE_SCORE_WEIGHTS.meta + LIVE_SCORE_WEIGHTS.jsonLd + LIVE_SCORE_WEIGHTS.knowledgeGraph;

function compact(value: string | null | undefined): string {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function present(value: string | null | undefined): boolean {
	return compact(value).length > 0;
}

function issue(
	id: string,
	title: string,
	description: string,
	severity: LiveIssueSeverity,
): LiveDiagnosticIssue {
	return { id, title, description, severity };
}

export function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		value.forEach((item) => flattenJsonLd(item, out));
		return;
	}
	if (typeof value !== 'object') return;
	const obj = value as Record<string, unknown>;
	if (obj['@graph'] != null) flattenJsonLd(obj['@graph'], out);
	out.push(obj);
}

export function typeList(node: Record<string, unknown>): string[] {
	const raw = node['@type'];
	const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
	return list
		.filter((item): item is string => typeof item === 'string')
		.map(normalizeSchemaType)
		.filter(Boolean);
}

export function hasAnyType(types: Set<string>, candidates: readonly string[]): boolean {
	return candidates.some((type) => types.has(normalizeSchemaType(type)));
}

export function collectSameAsFromNodes(nodes: Record<string, unknown>[]): string[] {
	const urls = new Set<string>();
	for (const node of nodes) {
		for (const url of extractUniversalSameAs(node)) urls.add(url);
	}
	return Array.from(urls);
}

export function scoreMeta(meta: LiveMetaSnapshot): { points: number; issues: LiveDiagnosticIssue[] } {
	const checks = [
		{ id: 'title', label: '<title>', value: meta.title, weight: 8 },
		{ id: 'description', label: 'meta description', value: meta.description, weight: 8 },
		{ id: 'og-title', label: 'og:title', value: meta.ogTitle, weight: 5 },
		{ id: 'og-image', label: 'og:image', value: meta.ogImage, weight: 5 },
		{ id: 'canonical', label: 'canonical', value: meta.canonical, weight: 4 },
	] as const;
	let points = 0;
	const issues: LiveDiagnosticIssue[] = [];
	for (const check of checks) {
		if (present(check.value)) {
			points += check.weight;
		} else {
			issues.push(
				issue(
					`meta-${check.id}`,
					`${check.label} 누락`,
					`페이지 head에서 ${check.label}를 찾지 못했습니다. 검색·AI 인용 시 엔티티 식별이 약해집니다.`,
					check.weight >= 8 ? 'critical' : 'warning',
				),
			);
		}
	}
	if (issues.length === 0) {
		issues.push(
			issue('meta-ok', '메타태그 완결', 'title / description / og:title / og:image / canonical이 모두 확인되었습니다.', 'good'),
		);
	}
	return { points: Math.min(LIVE_SCORE_WEIGHTS.meta, points), issues };
}

export function scoreJsonLd(
	industry: LiveDiagnosticIndustry,
	detected: LiveDetectedSchema,
	nodes: Record<string, unknown>[],
): { points: number; issues: LiveDiagnosticIssue[] } {
	let points = 0;
	const issues: LiveDiagnosticIssue[] = [];

	if (detected.blockCount > 0) {
		points += 10;
	} else {
		issues.push(
			issue('jsonld-missing', 'JSON-LD 스키마 없음', 'application/ld+json 블록이 없거나 파싱에 실패했습니다.', 'critical'),
		);
	}

	if (detected.hasOrganization) {
		points += 10;
	} else {
		issues.push(
			issue(
				'schema-organization',
				'Organization 타입 누락',
				'Organization / LocalBusiness 계열 @type이 없어 브랜드 엔티티가 일반 페이지로 분류됩니다.',
				'critical',
			),
		);
	}

	const industryTypeOk =
		industry === 'medical'
			? detected.hasMedicalBusiness || hasAnyType(new Set(detected.types), ['MedicalClinic', 'Physician', 'Dentist', 'Hospital'])
			: industry === 'veterinary'
				? hasAnyType(new Set(detected.types), ['VeterinaryCare'])
				: industry === 'ecommerce'
					? hasAnyType(new Set(detected.types), ['OnlineStore', 'Store', 'Product', 'Offer'])
					: hasAnyType(new Set(detected.types), ['ProfessionalService', 'Organization']);

	if (industryTypeOk) {
		points += 10;
	} else {
		const expected =
			industry === 'medical'
				? 'MedicalBusiness / MedicalClinic / Physician'
				: industry === 'veterinary'
					? 'VeterinaryCare'
					: industry === 'ecommerce'
						? 'OnlineStore / Organization'
						: 'Organization / ProfessionalService';
		issues.push(
			issue(
				'schema-industry',
				`업종 스키마(${expected}) 미검출`,
				`${LIVE_INDUSTRY_LABEL[industry]} 카테고리에 맞는 @type이 JSON-LD에 없습니다.`,
				'critical',
			),
		);
	}

	if (detected.hasPhysician || (industry !== 'medical' && hasAnyType(new Set(detected.types), ['Person']))) {
		points += 5;
	} else if (industry === 'medical' || industry === 'veterinary') {
		issues.push(
			issue('schema-physician', 'Physician / Person 노드 부재', '대표원장 Person 또는 Physician 타입이 없어 E-E-A-T 연결이 끊깁니다.', 'warning'),
		);
	}

	const orgNode = nodes.find((node) =>
		typeList(node).some((type) =>
			/Organization|LocalBusiness|MedicalClinic|MedicalBusiness|VeterinaryCare|OnlineStore|ProfessionalService/i.test(type),
		),
	);
	const hasName = present(typeof orgNode?.name === 'string' ? orgNode.name : '');
	const hasUrl = present(typeof orgNode?.url === 'string' ? orgNode.url : '');
	const hasNap = Boolean(orgNode?.address || orgNode?.telephone);
	if (hasName && (hasUrl || hasNap)) {
		points += 5;
	} else if (detected.blockCount > 0) {
		issues.push(
			issue('schema-required', 'JSON-LD 필수 필드 부족', '구조화 데이터에 name과 url(또는 address/telephone)이 함께 없습니다.', 'warning'),
		);
	}

	return { points: Math.min(LIVE_SCORE_WEIGHTS.jsonLd, points), issues };
}

export function scoreKnowledgeGraph(sameAs: string[], html: string): { points: number; issues: LiveDiagnosticIssue[] } {
	const harvested = harvestHttpUrls(html);
	const channels = validateChannelSignals([...sameAs, ...harvested]);
	let points = 0;
	const issues: LiveDiagnosticIssue[] = [];

	if (sameAs.length > 0) {
		points += 10;
	} else {
		issues.push(
			issue('sameas-missing', 'sameAs 링크 없음', 'JSON-LD sameAs가 비어 있어 지식그래프에서 동일 엔티티로 묶기 어렵습니다.', 'critical'),
		);
	}

	const social =
		channels.urls.filter((url) =>
			/instagram\.com|youtube\.com|facebook\.com|linkedin\.com|twitter\.com|x\.com/i.test(url),
		).length > 0;
	if (social) points += 8;
	else issues.push(issue('kg-social', '공식 SNS 채널 미연결', 'Instagram / YouTube / Facebook 등 공식 소셜 URL이 sameAs에 없습니다.', 'warning'));

	if (channels.hasNaverChannel || channels.isGoogleMapsLinked || channels.isKakaoLinked) {
		points += 8;
	} else {
		issues.push(
			issue('kg-map', '지도·플레이스 링크 없음', '네이버 플레이스 / 구글 맵 / 카카오맵 sameAs가 확인되지 않았습니다.', 'warning'),
		);
	}

	if (sameAs.length >= 2) points += 4;

	if (points >= 26) {
		issues.push(issue('kg-ok', '지식그래프 시그널', 'sameAs와 공식 채널이 확인되어 엔티티 연결 기반은 양호합니다.', 'good'));
	}

	return { points: Math.min(LIVE_SCORE_WEIGHTS.knowledgeGraph, points), issues };
}

export function composeLiveDiagnosticScores(input: {
	meta: number;
	jsonLd: number;
	knowledgeGraph: number;
}): LiveDiagnosticScores & { scoreBreakdown: LiveScoreBreakdown } {
	const meta = Math.max(0, Math.min(LIVE_SCORE_WEIGHTS.meta, Math.round(input.meta)));
	const jsonLd = Math.max(0, Math.min(LIVE_SCORE_WEIGHTS.jsonLd, Math.round(input.jsonLd)));
	const knowledgeGraphPts = Math.max(0, Math.min(LIVE_SCORE_WEIGHTS.knowledgeGraph, Math.round(input.knowledgeGraph)));
	const overall = Math.max(0, Math.min(LIVE_SCORE_WEIGHT_TOTAL, meta + jsonLd + knowledgeGraphPts));
	const knowledgeGraph = Math.round((knowledgeGraphPts / LIVE_SCORE_WEIGHTS.knowledgeGraph) * 100);
	return {
		overall,
		schema: Math.round((jsonLd / LIVE_SCORE_WEIGHTS.jsonLd) * 100),
		knowledgeGraph,
		geo: Math.round(overall * 0.55 + knowledgeGraph * 0.45),
		scoreBreakdown: { meta, jsonLd, knowledgeGraph: knowledgeGraphPts },
	};
}

export function scoreLiveDiagnosticPage(input: {
	industry: LiveDiagnosticIndustry;
	meta: LiveMetaSnapshot;
	detected: LiveDetectedSchema;
	nodes: Record<string, unknown>[];
	html: string;
}): {
	scores: LiveDiagnosticScores;
	scoreBreakdown: LiveScoreBreakdown;
	issues: LiveDiagnosticIssue[];
	metaPoints: number;
	jsonLdPoints: number;
	kgPoints: number;
} {
	const metaScore = scoreMeta(input.meta);
	const jsonLdScore = scoreJsonLd(input.industry, input.detected, input.nodes);
	const kgScore = scoreKnowledgeGraph(input.detected.sameAs, input.html);
	const composed = composeLiveDiagnosticScores({
		meta: metaScore.points,
		jsonLd: jsonLdScore.points,
		knowledgeGraph: kgScore.points,
	});
	return {
		scores: {
			overall: composed.overall,
			schema: composed.schema,
			knowledgeGraph: composed.knowledgeGraph,
			geo: composed.geo,
		},
		scoreBreakdown: composed.scoreBreakdown,
		issues: [...metaScore.issues, ...jsonLdScore.issues, ...kgScore.issues],
		metaPoints: metaScore.points,
		jsonLdPoints: jsonLdScore.points,
		kgPoints: kgScore.points,
	};
}

function checklistPassed(report: AuditReport, id: string): boolean {
	const checks = [
		...(report.checklist || []),
		...(report.categories || []).flatMap((category) => category.checks || []),
	];
	const hit = checks.find((check) => check.id === id || check.id.endsWith(id));
	return Boolean(hit && (hit.status === 'pass' || hit.passed));
}

export function industryFromAuditReport(report: AuditReport): LiveDiagnosticIndustry {
	const schemaTypes = report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes ?? [];
	const corpus = [report.siteMeta?.category, report.siteMeta?.industryType, schemaTypes.join(' '), report.url]
		.filter(Boolean)
		.join(' ');
	if (/VeterinaryCare|동물병원|반려동물|veterinary/i.test(corpus)) return 'veterinary';
	if (report.siteMeta?.industryType === 'MEDICAL' || /MedicalClinic|MedicalBusiness|Physician/i.test(corpus)) {
		return 'medical';
	}
	if (report.siteMeta?.industryType === 'LOCAL_STORE' || /Product|Offer|Store|쇼핑몰|커머스/i.test(corpus)) {
		return 'ecommerce';
	}
	return 'corporate';
}

export function scoreLiveDiagnosticFromAuditReport(report: AuditReport): LiveDiagnosticScores & {
	scoreBreakdown: LiveScoreBreakdown;
} {
	// `jsonLdFullBlocks` holds every ld+json block untruncated, one raw JSON
	// document per array entry. `jsonLdSnippets` is a 1200-char display preview —
	// re-parsing it as JSON silently drops every node once a multi-entity `@graph`
	// (Organization + MedicalClinic + MedicalWebPage + Person, …) gets cut
	// mid-object, which zeroes out hasOrganization/sameAs/NAP for that page.
	const snippets = report.metrics?.jsonLdFullBlocks ?? report.metrics?.jsonLdSnippets ?? [];
	const nodes: Record<string, unknown>[] = [];
	for (const body of snippets) {
		flattenJsonLd(parseJsonLdDocument(body), nodes);
	}
	const types = new Set<string>();
	for (const node of nodes) typeList(node).forEach((type) => types.add(type));
	if ((report.metrics?.schemaTypes || []).length > 0) {
		for (const type of report.metrics?.schemaTypes || []) types.add(normalizeSchemaType(type));
	}

	const sameAs = collectSameAsFromNodes(nodes);
	const harvestedCorpus = [report.footerText || '', ...(report.collectedUrls || [])].join('\n');
	const extra = validateChannelSignals([...sameAs, ...harvestHttpUrls(harvestedCorpus), ...(report.collectedUrls || [])]);
	const mergedSameAs = Array.from(
		new Set([
			...sameAs,
			...extra.naverBlogUrls,
			...extra.naverPlaceUrls,
			...extra.googleMapsUrls,
			...extra.kakaoUrls,
		]),
	);

	const detected: LiveDetectedSchema = {
		types: Array.from(types).sort(),
		blockCount: report.metrics?.jsonLdBlockCount ?? snippets.length,
		hasMedicalBusiness: hasAnyType(types, ['MedicalBusiness', 'MedicalClinic', 'Physician', 'Dentist', 'Hospital']),
		hasPhysician: hasAnyType(types, ['Physician']),
		hasOrganization: hasAnyType(types, [
			'Organization',
			'LocalBusiness',
			'MedicalClinic',
			'MedicalBusiness',
			'VeterinaryCare',
			'OnlineStore',
			'ProfessionalService',
		]),
		sameAs: mergedSameAs,
	};

	const meta: LiveMetaSnapshot = {
		title: report.metrics?.documentTitle || report.metrics?.pageTitle || report.siteMeta?.title || '',
		description: report.metrics?.metaDescription || report.siteMeta?.metaDescription || '',
		ogTitle: report.metrics?.ogTitle || report.siteMeta?.ogTitle || '',
		ogImage: report.siteMeta?.ogImage || report.logoUrl || '',
		canonical: checklistPassed(report, 'canonical') ? report.finalUrl || report.url : '',
	};

	const scored = scoreLiveDiagnosticPage({
		industry: industryFromAuditReport(report),
		meta,
		detected,
		nodes,
		html: harvestedCorpus,
	});
	return {
		...scored.scores,
		scoreBreakdown: scored.scoreBreakdown,
	};
}

export function liveScoresMatchHistoryFields(
	live: Pick<LiveDiagnosticScores, 'overall' | 'geo' | 'schema' | 'knowledgeGraph'>,
	history: { totalScore: number; geoScore: number; schemaScore: number; knowledgeGraphScore?: number },
): boolean {
	return (
		live.overall === history.totalScore &&
		live.geo === history.geoScore &&
		live.schema === history.schemaScore &&
		(history.knowledgeGraphScore == null || live.knowledgeGraph === history.knowledgeGraphScore)
	);
}
