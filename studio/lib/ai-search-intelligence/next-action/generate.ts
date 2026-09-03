/**
 * Build executable actions from Opportunity / Evidence / Gap / Audit / Readiness.
 * A kind is emitted only when its source data exists.
 */
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type { AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type {
	AsiActionKind,
	AsiAgentReadinessSnapshot,
	AsiCompetitorGapKind,
	AsiCompetitorGapMetric,
	AsiCompetitorGapSnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiEvidenceSourceType,
	AsiNextAction,
	AsiOpportunityRow,
	AsiOpportunitySnapshot,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';
import {
	auditResultHref,
	pageTitleFromPath,
	pagesFromAudit,
	pagesMatchingQueries,
	preferredContentPage,
} from '@/lib/ai-search-intelligence/next-action/pages';
import { actionPriority, actionTier, clampScore, effortTier } from '@/lib/ai-search-intelligence/next-action/score';

const CITATION_TYPE_LABEL: Partial<Record<AsiEvidenceSourceType, string>> = {
	blog: '블로그',
	directory: '디렉터리',
	news: '뉴스',
	review: '리뷰',
	social: '소셜',
	youtube: 'YouTube',
	map: '지도',
	other: '제3자',
};

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

function leadingGapMetric(
	gap: AsiCompetitorGapSnapshot | null | undefined,
	kind: AsiCompetitorGapKind,
): AsiCompetitorGapMetric | undefined {
	return gap?.metrics.find((item) => item.kind === kind && item.available && item.gap > 0);
}

function makeAction(input: {
	kind: AsiActionKind;
	title: string;
	why: string;
	howToFix: string;
	evidence: string[];
	affectedQueries: string[];
	relatedPages: string[];
	auditHref?: string;
	impact: number;
	effort: number;
	confidence: number;
	source: AsiNextAction['source'];
}): AsiNextAction {
	const impact = clampScore(input.impact);
	const effort = clampScore(input.effort);
	const confidence = clampScore(input.confidence);
	const priority = actionPriority({ impact, effort, confidence });
	return {
		id: `${input.kind}::${input.title}`,
		kind: input.kind,
		title: input.title,
		why: input.why,
		howToFix: input.howToFix,
		evidence: unique(input.evidence),
		affectedQueries: unique(input.affectedQueries),
		relatedPages: unique(input.relatedPages),
		auditHref: input.auditHref,
		priority,
		priorityTier: actionTier(priority),
		impact,
		effort,
		confidence,
		impactTier: actionTier(impact),
		effortTier: effortTier(effort),
		confidenceTier: actionTier(confidence),
		estimatedImpact: impact,
		source: input.source,
	};
}

export function generateNextActions(input: {
	opportunity: AsiOpportunitySnapshot | null;
	evidence: AsiEvidenceExplorerSnapshot | null;
	gap: AsiCompetitorGapSnapshot | null;
	audit: LatestAuditPayload | null | undefined;
	gaps: readonly AsiAuditSignalId[];
	boundFromAudit: boolean;
	siteUrl: string;
	site?: AsiWarRoomSite | null;
	readiness?: AsiAgentReadinessSnapshot | null;
	aeoWeak?: boolean;
}): AsiNextAction[] {
	const actions: AsiNextAction[] = [];
	const site = input.site ?? input.opportunity?.site ?? input.gap?.site ?? input.evidence?.site;
	const href = auditResultHref(input.audit, input.siteUrl);
	const pages = pagesFromAudit(input.audit, input.siteUrl);
	const rows = input.opportunity?.rows ?? [];
	const targets = rows.filter((row) => row.status === 'miss' || row.status === 'compete' || row.isOpportunity);
	const miss = targets.filter((row) => row.status === 'miss' || row.isOpportunity);
	const compete = targets.filter((row) => row.status === 'compete');
	const targetQueries = targets.map((row) => row.query);
	const recTargets = targets.filter(
		(row) => row.intent === 'recommend' || row.intent === 'compare' || row.intent === 'solve',
	);
	const localTargets = targets.filter(
		(row) =>
			row.intent === 'local' ||
			Boolean(row.query && site?.location && row.query.includes(site.location)),
	);
	const matchedPages = pagesMatchingQueries(targetQueries, pages);
	const youtubeCompetitor = (input.evidence?.sources ?? []).filter(
		(row) => row.sourceType === 'youtube' && row.relatedTo === 'competitor',
	);
	const youtubeBrand = (input.evidence?.sources ?? []).filter((row) => row.sourceType === 'youtube' && row.relatedTo === 'brand');
	const citationRow = (input.gap?.rows ?? []).find((row) => row.kind === 'citation');
	const evidenceGap = (input.gap?.rows ?? []).find((row) => row.kind === 'evidence');
	const recGap = (input.gap?.rows ?? []).find((row) => row.kind === 'recommendation');
	const visGap = (input.gap?.rows ?? []).find((row) => row.kind === 'visibility' || row.kind === 'entity');
	const localGap = (input.gap?.rows ?? []).find((row) => row.kind === 'local');
	const contentGap = (input.gap?.rows ?? []).find((row) => row.kind === 'content');
	const coverageGap = (input.gap?.rows ?? []).find((row) => row.kind === 'coverage');
	const citationMetric = leadingGapMetric(input.gap, 'citation');
	const entityMetric = leadingGapMetric(input.gap, 'entity') ?? leadingGapMetric(input.gap, 'visibility');
	const localMetric = leadingGapMetric(input.gap, 'local');
	const unavailable = input.evidence?.summary.unavailable ?? 0;
	const brandCite = input.evidence?.brand.citations ?? 0;
	const themExternal = Math.max(0, ...(input.evidence?.competitors ?? []).map((row) => row.externalSources));
	const collected = input.audit?.report.collectedUrls ?? [];
	const pageMetas = input.audit?.report.pageMetas ?? [];
	const competitorSources = (input.evidence?.sources ?? []).filter((row) => row.relatedTo === 'competitor');
	const occupiedTypes = unique(
		competitorSources
			.map((row) => CITATION_TYPE_LABEL[row.sourceType] || row.sourceType)
			.filter((item) => item && item !== 'official'),
	);
	const location = site?.location?.trim() || '';
	const service = site?.category?.trim() || '';

	if (targets.length) {
		const page = preferredContentPage(matchedPages, pages);
		const lead = targets[0];
		const title = page
			? `${pageTitleFromPath(page)} 콘텐츠 보강`
			: lead
				? `${lead.query} 콘텐츠 보강`
				: '관련 콘텐츠 보강';
		const keywordList = targetQueries.slice(0, 3).join(', ');
		actions.push(
			makeAction({
				kind: 'content',
				title,
				why:
					contentGap?.why ||
					(compete.length && !miss.length
						? 'COMPETE 질문에서 브랜드는 보이지만 추천을 놓치고 있습니다.'
						: 'MISS·COMPETE 질문에 대응하는 페이지 신호가 약합니다.'),
				howToFix: page
					? `${page}에 “${keywordList}” 의도에 맞는 정의·절차·사례를 보강하고 FAQPage 스키마와 브랜드 엔티티를 명시하세요.`
					: `타깃 키워드(${keywordList})로 서비스 페이지를 보강하고 제목·본문·FAQ에 브랜드·지역을 명확히 넣으세요.`,
				evidence: unique([...(contentGap?.evidence ?? []), ...targets.slice(0, 3).flatMap((row) => row.citations)]),
				affectedQueries: targetQueries,
				relatedPages: matchedPages.length ? matchedPages : pages.slice(0, 3),
				auditHref: href,
				impact: clampScore((lead?.score ?? 60) * 0.7 + targets.length * 4),
				effort: matchedPages.length ? 32 : 55,
				confidence: input.boundFromAudit ? 78 : 58,
				source: contentGap ? 'gap' : 'opportunity',
			}),
		);
		actions.push(
			makeAction({
				kind: 'faq',
				title: recTargets.length ? 'FAQ·FAQPage 스키마 생성' : 'FAQ 스키마 보강',
				why: recGap?.why || 'MISS·COMPETE 질문에 답하는 FAQ와 FAQPage 스키마가 없습니다.',
				howToFix:
					'추천·비교 질문을 FAQ로 옮기고 FAQPage JSON-LD를 연결하세요. 각 답에 브랜드명과 시그니처 서비스를 포함하세요.',
				evidence: recGap?.evidence ?? targetQueries.slice(0, 3),
				affectedQueries: unique([...recTargets.map((row) => row.query), ...targetQueries, ...(recGap?.query ? [recGap.query] : [])]),
				relatedPages: pagesMatchingQueries(recTargets.map((row) => row.query), pages).concat(matchedPages).slice(0, 4),
				auditHref: href,
				impact: clampScore((recGap?.impact ?? 62) + targets.length * 3),
				effort: 28,
				confidence: recGap || input.gaps.includes('faq') ? 74 : 60,
				source: recGap ? 'gap' : input.gaps.includes('faq') ? 'audit' : 'opportunity',
			}),
		);
	} else if (input.gaps.includes('faq') || recGap) {
		actions.push(
			makeAction({
				kind: 'faq',
				title: 'FAQ 추가',
				why: recGap?.why || '추천·비교 질문에서 브랜드가 밀리거나 FAQ 신호가 없습니다.',
				howToFix: '추천 질문에 답하는 FAQ를 추가하고 FAQPage 스키마로 연결하세요.',
				evidence: recGap?.evidence ?? [],
				affectedQueries: recGap?.query ? [recGap.query] : [],
				relatedPages: pages.slice(0, 2),
				auditHref: href,
				impact: recGap?.impact ?? 62,
				effort: 28,
				confidence: 74,
				source: recGap ? 'gap' : 'audit',
			}),
		);
	}

	if (input.gaps.includes('entity') || visGap || entityMetric || localMetric || localTargets.length || input.gaps.includes('local')) {
		const loc = location || '서비스 지역';
		const svc = service || '시그니처 서비스';
		actions.push(
			makeAction({
				kind: 'entity',
				title: `${loc} ${svc} Local Business 엔티티 강화`,
				why:
					visGap?.why ||
					(entityMetric
						? '브랜드 Entity 신호가 약해 경쟁사가 먼저 연결됩니다.'
						: '지역명과 시그니처 서비스가 LocalBusiness로 묶여 있지 않습니다.'),
				howToFix: `Organization/LocalBusiness JSON-LD에 “${loc}”과 “${svc}”를 결합해 name·areaServed·makesOffer를 맞추고, 페이지 본문 NAP와 동일한 표기를 쓰세요.`,
				evidence: visGap?.evidence?.length
					? visGap.evidence
					: entityMetric
						? [`entity-gap:${entityMetric.gap}`]
						: [],
				affectedQueries: unique([
					...(visGap?.query ? [visGap.query] : []),
					...localTargets.map((row) => row.query),
					...targetQueries,
				]),
				relatedPages: pages.slice(0, 2),
				auditHref: href,
				impact: visGap?.impact ?? entityMetric?.gap ?? 68,
				effort: 40,
				confidence: input.boundFromAudit ? 76 : 54,
				source: visGap || entityMetric ? 'gap' : input.gaps.includes('entity') || input.gaps.includes('local') ? 'audit' : 'opportunity',
			}),
		);
	}

	if (input.gaps.includes('local') || localGap || localTargets.length) {
		actions.push(
			makeAction({
				kind: 'local',
				title: '지역 정보 보강',
				why: localGap?.why || '지역 질문에서 브랜드 노출이 약합니다.',
				howToFix: location
					? `NAP, 지도 프로필, “${location}”이 들어간 서비스 문구를 공식 페이지에 고정하세요.`
					: 'NAP, 지도 프로필, 지역명이 들어간 서비스 문구를 공식 페이지에 고정하세요.',
				evidence: localGap?.evidence ?? [],
				affectedQueries: unique([...localTargets.map((row) => row.query), ...(localGap?.query ? [localGap.query] : [])]),
				relatedPages: pagesMatchingQueries(localTargets.map((row) => row.query), pages),
				auditHref: href,
				impact: localGap?.impact ?? clampScore(58 + localTargets.length * 5),
				effort: 48,
				confidence: input.boundFromAudit || localGap ? 70 : 50,
				source: localGap ? 'gap' : input.gaps.includes('local') ? 'audit' : 'opportunity',
			}),
		);
	}

	const citationLead = Boolean(citationRow || citationMetric);
	if (
		citationLead ||
		input.gaps.includes('citation') ||
		(unavailable > 0 && brandCite === 0) ||
		(occupiedTypes.length > 0 && brandCite === 0)
	) {
		const typeLabel = occupiedTypes.slice(0, 3).join(', ') || '블로그, 디렉터리';
		actions.push(
			makeAction({
				kind: 'citation',
				title: `${typeLabel} Citation 확보`,
				why: citationRow?.why || '경쟁사가 선점한 출처 유형에서 브랜드 인용이 부족합니다.',
				howToFix: `경쟁사가 선점한 ${typeLabel} 출처에 검증 가능한 브랜드 정보를 올리고, 공식 페이지에 인용 가능한 정의 문단과 sameAs를 두세요.`,
				evidence: unique([...(citationRow?.evidence ?? []), ...competitorSources.map((row) => row.url).slice(0, 4)]),
				affectedQueries: unique([...(citationRow?.query ? [citationRow.query] : []), ...targetQueries]),
				relatedPages: input.evidence?.brand.relevantPages ? pages.slice(0, 2) : matchedPages,
				auditHref: href,
				impact: citationRow?.impact ?? clampScore(60 + (citationMetric?.gap ?? 0)),
				effort: 52,
				confidence: citationRow?.evidence.length ? 72 : 56,
				source: citationRow || citationMetric ? 'gap' : input.gaps.includes('citation') ? 'audit' : 'evidence',
			}),
		);
	}

	if (input.boundFromAudit && pageMetas.length >= 2 && collected.length > 0) {
		const orphans = pageMetas
			.map((item) => item.urlPath)
			.filter((path) => path && !collected.some((item) => item.toLowerCase().includes(path.toLowerCase().replace(/^\//, ''))));
		if (orphans.length) {
			actions.push(
				makeAction({
					kind: 'internal_link',
					title: '내부 링크 개선',
					why: '수집된 페이지 중 내비게이션에 노출되지 않는 경로가 있습니다.',
					howToFix: `${pageTitleFromPath(orphans[0])} 등 고립 페이지를 메뉴·본문 내부 링크로 연결하세요.`,
					evidence: orphans.slice(0, 4),
					affectedQueries: targetQueries,
					relatedPages: orphans.slice(0, 4),
					auditHref: href,
					impact: 54,
					effort: 30,
					confidence: 68,
					source: 'audit',
				}),
			);
		}
	}

	const structuredWeak = input.readiness?.items.some(
		(item) => item.id === 'structured_data' && item.status !== 'ready',
	);
	const readinessLow = Boolean(input.readiness && input.readiness.overall < 70);
	if (input.gaps.includes('schema') || input.aeoWeak || readinessLow || structuredWeak) {
		actions.push(
			makeAction({
				kind: 'schema',
				title: '/llms.txt · JSON-LD 구조화 데이터 보강',
				why: input.aeoWeak
					? 'Agent Readiness가 낮고 llms.txt·구조화 데이터 신호가 없습니다.'
					: '구조화 데이터 커버리지가 낮아 Agent가 엔티티를 읽기 어렵습니다.',
				howToFix:
					'사이트 루트에 /llms.txt를 추가하고, Organization·LocalBusiness·FAQPage JSON-LD를 실제 페이지 내용과 맞게 넣으세요.',
				evidence: unique([
					...(input.aeoWeak ? ['llms.txt'] : []),
					...(structuredWeak ? ['structured_data'] : []),
				]),
				affectedQueries: targetQueries,
				relatedPages: pages.slice(0, 2),
				auditHref: href,
				impact: 66,
				effort: 36,
				confidence: input.boundFromAudit || input.aeoWeak ? 80 : 62,
				source: input.aeoWeak || readinessLow ? 'readiness' : 'audit',
			}),
		);
	}

	if (youtubeCompetitor.length && youtubeBrand.length === 0) {
		actions.push(
			makeAction({
				kind: 'youtube',
				title: 'YouTube 콘텐츠',
				why: '경쟁사 YouTube가 AI Citation에 보이지만 우리 채널은 관측되지 않았습니다.',
				howToFix: '추천 질문에 답하는 영상과 설명란에 공식 URL·브랜드 엔티티를 넣으세요.',
				evidence: youtubeCompetitor.map((row) => row.url),
				affectedQueries: unique(youtubeCompetitor.map((row) => row.query)),
				relatedPages: [],
				auditHref: href,
				impact: 60,
				effort: 72,
				confidence: 64,
				source: 'evidence',
			}),
		);
	}

	if (evidenceGap || (themExternal > 0 && (input.evidence?.brand.externalSources ?? 0) < themExternal)) {
		actions.push(
			makeAction({
				kind: 'external_mention',
				title: '외부 Mention 확보',
				why: evidenceGap?.why || '외부 출처에서 경쟁사 언급이 더 많습니다.',
				howToFix: '뉴스·리뷰·디렉터리 등 제3자 페이지에 검증 가능한 브랜드 정보를 확보하세요.',
				evidence: evidenceGap?.evidence ?? [],
				affectedQueries: unique([...(evidenceGap?.query ? [evidenceGap.query] : []), ...targetQueries]),
				relatedPages: [],
				auditHref: href,
				impact: evidenceGap?.impact ?? 58,
				effort: 74,
				confidence: 60,
				source: evidenceGap ? 'gap' : 'evidence',
			}),
		);
	}

	const missOnly = targets.filter((row) => row.status === 'miss');
	if (coverageGap || missOnly.length) {
		if (missOnly.length || coverageGap) {
			const querySet = missOnly.length ? missOnly : targets;
			actions.push(
				makeAction({
					kind: 'query',
					title: '경쟁 Query 대응',
					why: coverageGap?.why || 'AI가 추천하지 않는 질문이 관측되었습니다.',
					howToFix: 'Opportunity Finder의 MISS·COMPETE 질문을 페이지 제목·FAQ·비교표에 직접 대응하세요.',
					evidence: coverageGap?.evidence ?? querySet.map((row) => row.query),
					affectedQueries: querySet.map((row) => row.query),
					relatedPages: pagesMatchingQueries(querySet.map((row) => row.query), pages),
					auditHref: href,
					impact: clampScore((coverageGap?.impact ?? querySet[0]?.score ?? 70) * 0.85 + querySet.length * 2),
					effort: 50,
					confidence: 66,
					source: coverageGap ? 'gap' : 'opportunity',
				}),
			);
		}
	}

	const byKind = new Map<AsiActionKind, AsiNextAction>();
	for (const action of actions) {
		const current = byKind.get(action.kind);
		if (!current || action.priority > current.priority) byKind.set(action.kind, action);
	}
	return [...byKind.values()].sort((a, b) => b.priority - a.priority || b.impact - a.impact);
}

export function isAsiTargetOpportunity(row: Pick<AsiOpportunityRow, 'status' | 'isOpportunity'>): boolean {
	return row.status === 'miss' || row.status === 'compete' || row.isOpportunity;
}
