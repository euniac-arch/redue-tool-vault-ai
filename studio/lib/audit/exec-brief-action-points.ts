/**
 * Per-engine TOP 3 action points for the exec brief.
 * Scans all six AI results individually so the 02 list always renders 3 cards.
 */
import { detectEnginePlatformSignals, type EngineAnalysisResult, type EnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { extractSignalsFromReport } from '@/lib/audit/geo-score';
import { resolveHasLlmsTxt } from '@/lib/audit/llms-txt-check';
import { resolveIsHttps } from '@/lib/audit/scoreCalculator';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import type { AIEngineTestResult } from '@/types/geo-diagnostic';
import type { LiveEngineCheckResult } from '@/types/live-engine-check';

export type ActionTheme =
	| 'schema'
	| 'geo'
	| 'faq'
	| 'bots'
	| 'eeat'
	| 'onpage'
	| 'engine'
	| 'ssl'
	| 'llms'
	| 'generic';

export type ActionPriority = 'P1' | 'P2' | 'P3';

export interface ActionPoint {
	priority: ActionPriority;
	priorityLabel: string;
	targetEngines: string;
	title: string;
	cause: string;
	action: string;
}

export interface ActionPointRecord extends ActionPoint {
	id: string;
	theme: ActionTheme;
	weight: number;
}

export interface ActionPointAnalyzerInput {
	report?: AuditReport | null;
	engines?: readonly AIEngineTestResult[] | null;
	engineResults?: readonly EngineAnalysisResult[] | null;
	liveResults?: readonly LiveEngineCheckResult[] | null;
	platform?: EnginePlatformSignals | null;
	industry?: IndustryConfig | null;
	lang?: AuditLang;
	schemaRaw?: number;
	schemaMax?: number;
	hasLlms?: boolean;
	isHttps?: boolean;
	seoScore?: number;
	siteName?: string;
	category?: string;
}

const ENGINE_LABEL: Record<string, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Clova',
	navercue: 'Clova',
};

const BING_ENGINES = new Set<string>(['chatgpt', 'copilot']);
const GBP_ENGINES = new Set<string>(['gemini']);
const THIRD_PARTY_RE =
	/blog|cafe|beauty|강남언니|바비톡|여신티켓|naver\.blog|tistory|instagram|youtube|모두닥|나만의닥터|굿닥/i;
const NAP_RE = /NAP|Places|플레이스|로컬 인덱스|Bing/i;
const BOT_CHECK_IDS = new Set(['ai-bots-allowed', 'ai_bots_robots']);

const PRIORITY_LABEL: Record<AuditLang, Record<ActionPriority, string>> = {
	ko: { P1: 'P1 최우선', P2: 'P2 핵심', P3: 'P3 고도화' },
	en: { P1: 'P1 blocker', P2: 'P2 core', P3: 'P3 refine' },
};

function langOf(lang?: AuditLang): AuditLang {
	return lang === 'en' ? 'en' : 'ko';
}

function engineLabel(id: string, fallback?: string): string {
	return ENGINE_LABEL[id] || fallback || id;
}

function compact(value: string | null | undefined, fallback: string): string {
	const next = (value || '').replace(/\s+/g, ' ').trim();
	return next || fallback;
}

function engineLevelReasonFallback(
	id: string,
	depth: 1 | 2 | 3 | null,
	score: number,
	lang: AuditLang,
): string {
	if (depth === 3) return lang === 'en' ? 'unbranded recommend' : '비브랜드 추천 진입';
	if (depth === 2) return lang === 'en' ? 'category citation' : '카테고리 인용 수준';
	if (depth == null) return lang === 'en' ? 'not cited' : '미인용';
	if (id === 'clova') return lang === 'en' ? 'weak Place signal' : '플레이스 연동 신호 미흡';
	if (id === 'perplexity') return lang === 'en' ? 'weak local recommend signal' : '로컬 추천 신호 취약';
	if (score >= 36) return lang === 'en' ? 'basic fact citation' : '기초 정보 인용 수준';
	return lang === 'en' ? 'brand-only mention' : '브랜드 한정 단순언급';
}

function isUnexposed(engine: AIEngineTestResult, live?: LiveEngineCheckResult): boolean {
	if (live) {
		if (live.mentionType === 'none' || live.tier === 'NOT_FOUND') return true;
		if (live.isCited === false && live.fallbackToRuleScore !== true) return true;
	}
	return engine.statusBadge === 'not_indexed' || engine.depthLevel == null;
}

function isOfficialCite(engine: AIEngineTestResult, live?: LiveEngineCheckResult): boolean {
	if (live?.mentionType === 'recommended' || live?.isCited === true) return true;
	return engine.statusBadge === 'moderate' || engine.statusBadge === 'optimal' || engine.depthLevel === 2 || engine.depthLevel === 3;
}

function isIndirectCite(
	engine: AIEngineTestResult,
	live?: LiveEngineCheckResult,
	platform?: EnginePlatformSignals | null,
): boolean {
	if (live?.citations?.length) {
		const third = live.citations.filter((row) => !row.isTargetMention);
		const official = live.citations.filter((row) => row.isTargetMention);
		if (third.length > 0 && official.length === 0) return true;
	}
	const sources = live?.citedSources?.join(' ') || '';
	if (sources && THIRD_PARTY_RE.test(sources)) return true;
	if (platform?.naverBlogLinked && !platform.hasLocalBusiness && engine.depthLevel != null && engine.depthLevel <= 2) {
		return true;
	}
	return engine.analysisTags?.some((tag) => tag.polarity === 'negative' && /blog|mention|source/i.test(tag.id)) === true;
}

function localIndexMissing(engineId: string, platform?: EnginePlatformSignals | null): boolean {
	if (!platform) return false;
	if (BING_ENGINES.has(engineId)) return !platform.bingPlacesLinked;
	if (GBP_ENGINES.has(engineId)) return !platform.googleMapsLinked && !platform.hasGeoCoordinates;
	if (engineId === 'clova') return !platform.naverPlaceLinked;
	return false;
}

function crawlBlocked(report: AuditReport | null | undefined): { blocked: boolean; reason: string } {
	if (!report) return { blocked: false, reason: '' };
	const index = report.indexStatus;
	if (index && index.allowed === false) {
		return { blocked: true, reason: index.evidence || 'noindex / robots 차단' };
	}
	if (index && index.robotsTxtOk === false) {
		return { blocked: true, reason: index.evidence || 'robots.txt Disallow' };
	}
	if (index && index.metaRobotsOk === false) {
		return { blocked: true, reason: index.evidence || 'meta/X-Robots noindex' };
	}
	const botFail = report.findings?.find((finding) => BOT_CHECK_IDS.has(finding.checkId || ''));
	if (botFail) return { blocked: true, reason: botFail.detail || botFail.title };
	const checklistFail = report.checklist?.find((item) => BOT_CHECK_IDS.has(item.id) && item.status === 'fail');
	if (checklistFail) return { blocked: true, reason: checklistFail.label };
	return { blocked: false, reason: '' };
}

function liveCause(engine: AIEngineTestResult, live?: LiveEngineCheckResult, lang: AuditLang = 'ko'): string {
	const weakness = live?.weaknessReasons?.filter(Boolean)[0];
	if (weakness) return weakness;
	if (engine.improvementTip?.trim()) return engine.improvementTip.trim();
	return engineLevelReasonFallback(engine.engine.id, engine.depthLevel, engine.score, lang);
}

function liveAction(engine: AIEngineTestResult): string {
	const advice = engine.optimizationAdvice?.actionItems?.find((item) => item.trim());
	if (advice) return advice.trim();
	if (engine.optimizationGuide?.prescriptionTips?.length) {
		return engine.optimizationGuide.prescriptionTips[0]!.trim();
	}
	return engine.improvementTip?.trim() || '';
}

function defaultTitle(engineId: string, priority: ActionPriority, lang: AuditLang): string {
	if (priority === 'P1') {
		if (BING_ENGINES.has(engineId)) {
			return lang === 'en' ? 'Missing Bing local index (NAP)' : '검색 포털 로컬 인덱스(NAP) 연동 부재';
		}
		if (GBP_ENGINES.has(engineId)) {
			return lang === 'en' ? 'Missing Google Business Profile signal' : 'Google 비즈니스 프로필(GBP) 신호 부재';
		}
		if (engineId === 'clova') {
			return lang === 'en' ? 'Missing Naver Place index' : '네이버 플레이스 로컬 인덱스 부재';
		}
		return lang === 'en' ? 'Unblock crawl / restore local index' : '크롤링 차단 또는 로컬 인덱스 부재';
	}
	if (priority === 'P2') {
		return lang === 'en'
			? 'Official entity / third-party reputation gap'
			: '공식 엔티티·제3자 평판 신호 부족';
	}
	return lang === 'en'
		? 'Strengthen official-site schema for direct citation'
		: '공식 사이트 직답 인용을 위한 스키마 강화';
}

function defaultCause(name: string, priority: ActionPriority, lang: AuditLang): string {
	if (priority === 'P1') {
		return lang === 'en'
			? `${name} is missing an official business profile in its local search index, so area recommendations drop the brand.`
			: `${name}의 검색 인덱스에 공식 비즈니스 프로필이 누락되어 지역 추천에서 제외되었습니다.`;
	}
	if (priority === 'P2') {
		return lang === 'en'
			? `Technical indexing is in place, but ${name} still lacks knowledge-graph and third-party verification signals.`
			: `기술 색인은 완료되었으나 ${name} 실시간 답변 채택에 필요한 지식 그래프 및 3자 검증 신호가 부족합니다.`;
	}
	return lang === 'en'
		? `${name} currently cites via third-party channels; official-site direct-link adoption stays low.`
		: `${name}이 제3자 플랫폼을 우회하여 인용 중이며 공식 웹사이트 직접 링크 채택률이 낮습니다.`;
}

function defaultAction(engineId: string, priority: ActionPriority, lang: AuditLang): string {
	if (priority === 'P1') {
		if (BING_ENGINES.has(engineId)) {
			return lang === 'en'
				? 'Register Bing Places and sync the official NAP.'
				: 'Bing Places 비즈니스 프로필을 정식 등록하고 NAP를 동기화하세요.';
		}
		if (GBP_ENGINES.has(engineId)) {
			return lang === 'en'
				? 'Complete Google Business Profile categories and map coordinates.'
				: 'Google 비즈니스 프로필 세부 항목과 지도 좌표를 확충하세요.';
		}
		if (engineId === 'clova') {
			return lang === 'en'
				? 'Register Naver Place and connect the official site URL.'
				: '네이버 스마트플레이스를 등록하고 공식 사이트 URL을 연결하세요.';
		}
		return lang === 'en'
			? 'Allow AI crawlers and restore the portal business profile.'
			: 'AI 크롤러를 허용하고 포털 비즈니스 프로필을 복구하세요.';
	}
	if (priority === 'P2') {
		return lang === 'en'
			? 'Expand the official entity profile and refresh certified third-party listings.'
			: '공식 엔티티 프로필을 확충하고 주요 공인 플랫폼 프로필을 갱신하세요.';
	}
	return lang === 'en'
		? 'Add FAQPage / HowTo / service JSON-LD so the official site can be cited directly.'
		: '공식 사이트에 FAQPage·HowTo·서비스 JSON-LD를 보강해 직접 인용이 되게 하세요.';
}

function point(
	partial: Omit<ActionPointRecord, 'priorityLabel'> & { lang: AuditLang },
): ActionPointRecord {
	const { lang, ...rest } = partial;
	return {
		...rest,
		priorityLabel: PRIORITY_LABEL[lang][rest.priority],
	};
}

function fallbacks(opts: { lang: AuditLang; siteName: string; category: string }): ActionPointRecord[] {
	const { lang, siteName, category } = opts;
	if (lang === 'en') {
		return [
			point({
				lang,
				id: 'fallback-faq',
				theme: 'faq',
				priority: 'P2',
				weight: 20,
				targetEngines: 'All AI engines',
				title: 'Refresh answer-style FAQ content',
				cause: `Queries around ${siteName} are getting more specific, so ${category} Q&A needs ongoing updates.`,
				action: `Keep detailed Q&A and usage guides for ${category} current on the official site.`,
			}),
			point({
				lang,
				id: 'fallback-footprint',
				theme: 'geo',
				priority: 'P3',
				weight: 18,
				targetEngines: 'All AI engines',
				title: 'Strengthen digital footprint and channel backlinks',
				cause: `If ${siteName} loses consistent links between the official site, social profiles, and news, AI brand trust can drop.`,
				action: 'Keep the official website URL consistent on YouTube, blogs, and portal news profiles.',
			}),
			point({
				lang,
				id: 'fallback-maintain',
				theme: 'generic',
				priority: 'P3',
				weight: 16,
				targetEngines: 'All AI engines',
				title: 'Maintain NAP and entity consistency',
				cause: `${siteName} citations stay stable only when name, address, and ${category} descriptors match across channels.`,
				action: 'Audit NAP strings and sameAs links on every official profile each quarter.',
			}),
		];
	}
	return [
		point({
			lang,
			id: 'fallback-faq',
			theme: 'faq',
			priority: 'P2',
			weight: 20,
			targetEngines: 'AI 공통',
			title: '정답형 FAQ 콘텐츠 최신화',
			cause: `${siteName} 관련 사용자 질의가 점차 구체화되고 있으므로 ${category} 중심의 정답형 Q&A를 지속 보완해야 합니다.`,
			action: `공식 사이트 내 ${category} 상세 문답 및 이용 가이드를 주기적으로 업데이트하세요.`,
		}),
		point({
			lang,
			id: 'fallback-footprint',
			theme: 'geo',
			priority: 'P3',
			weight: 18,
			targetEngines: 'AI 공통',
			title: '디지털 풋프린트 및 채널 백링크 강화',
			cause: `${siteName}의 공식 사이트와 SNS, 뉴스 기사 간 상호 연결이 끊기면 AI의 브랜드 신뢰도가 하락할 수 있습니다.`,
			action: '유튜브, 블로그, 포털 뉴스 프로필에 공식 웹사이트 URL을 일관되게 연결하세요.',
		}),
		point({
			lang,
			id: 'fallback-maintain',
			theme: 'generic',
			priority: 'P3',
			weight: 16,
			targetEngines: 'AI 공통',
			title: 'NAP·엔티티 표기 일관성 유지',
			cause: `${siteName} 인용은 채널마다 상호·주소·${category} 표기가 같을 때 안정적으로 유지됩니다.`,
			action: '공식 프로필의 NAP 문자열과 sameAs 링크를 분기별로 대조하세요.',
		}),
	];
}

function normalizeEngineList(input: ActionPointAnalyzerInput): AIEngineTestResult[] {
	if (input.engines?.length) return [...input.engines];
	if (input.engineResults?.length) {
		return input.engineResults.map((row) => ({
			engine: { id: row.engine, name: row.engineName, provider: row.engineName },
			triggerQuery: '',
			simulatedResponse: '',
			improvementTip: row.analysisReason,
			score: row.score,
			statusBadge: row.score < 40 ? 'not_indexed' : row.score < 60 ? 'exact_only' : row.score < 80 ? 'moderate' : 'optimal',
			depthLevel: row.score < 40 ? null : row.score < 60 ? 1 : row.score < 80 ? 2 : 3,
		})) as AIEngineTestResult[];
	}
	return [];
}

/**
 * Scan every engine row, rank defects, and always return exactly 3 action cards.
 */
export function generateTop3ActionPoints(data: ActionPointAnalyzerInput | AuditReport): ActionPointRecord[] {
	const input: ActionPointAnalyzerInput =
		data && typeof data === 'object' && 'url' in data && 'checklist' in data
			? { report: data as AuditReport }
			: (data as ActionPointAnalyzerInput);

	const lang = langOf(input.lang);
	const report = input.report ?? null;
	const engines = normalizeEngineList(input);
	const liveById = new Map((input.liveResults ?? []).map((row) => [row.engine, row]));
	const platform =
		input.platform ??
		(report
			? extractSignalsFromReport(report).platform ??
				detectEnginePlatformSignals({
					schemaTypes: report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes,
				})
			: null);
	const isHttps = input.isHttps ?? (report ? resolveIsHttps({ url: report.url, hasSsl: report.hasSsl }) : true);
	const hasLlms = input.hasLlms ?? (report ? resolveHasLlmsTxt(report) : true);
	const schemaRaw = input.schemaRaw ?? report?.schemaCoverage ?? 0;
	const schemaMax = input.schemaMax && input.schemaMax > 0 ? input.schemaMax : 100;
	const schemaRatio = schemaMax > 0 ? schemaRaw / schemaMax : 1;
	const crawl = crawlBlocked(report);
	const siteName = compact(
		input.siteName || report?.siteMeta?.brandName,
		lang === 'en' ? 'This brand' : '해당 브랜드',
	);
	const category = compact(
		input.category || input.industry?.defaultCategory || report?.siteMeta?.category || report?.siteMeta?.primaryKeyword,
		lang === 'en' ? 'core service' : '핵심 서비스',
	);
	const issues: ActionPointRecord[] = [];

	if (crawl.blocked) {
		issues.push(
			point({
				lang,
				id: 'crawl-block',
				theme: 'bots',
				priority: 'P1',
				weight: 110,
				targetEngines: engines.length
					? engines.map((engine) => engineLabel(engine.engine.id, engine.engine.name)).join(' · ')
					: 'ChatGPT · Perplexity · Claude',
				title: lang === 'en' ? 'Unblock AI crawlers / index directives' : '검색 봇 크롤링 차단 해제',
				cause:
					lang === 'en'
						? `Live crawl is blocked: ${crawl.reason}`
						: `실시간 수집이 차단됨 — ${crawl.reason}`,
				action:
					lang === 'en'
						? 'Allow GPTBot / PerplexityBot / ClaudeBot in robots.txt and remove noindex.'
						: 'robots.txt에서 GPTBot·PerplexityBot·ClaudeBot을 허용하고 noindex를 제거하세요.',
			}),
		);
	}

	if (!isHttps) {
		issues.push(
			point({
				lang,
				id: 'ssl-https',
				theme: 'ssl',
				priority: 'P1',
				weight: 108,
				targetEngines: engines.length
					? engines.map((engine) => engineLabel(engine.engine.id, engine.engine.name)).join(' · ')
					: 'AI 공통',
				title:
					lang === 'en'
						? 'Switch insecure HTTP to HTTPS now'
						: '비보안 HTTP → HTTPS 보안 프로토콜 즉시 전환',
				cause:
					lang === 'en'
						? 'Insecure origin locks every engine at Level 1 and caps AI trust scoring.'
						: '비보안 프로토콜은 전 엔진을 Level 1로 잠그고 AI 신뢰 점수를 상한 제한합니다.',
				action:
					lang === 'en'
						? 'Install a valid SSL certificate and redirect all traffic to HTTPS.'
						: '유효한 SSL 인증서를 적용하고 전 트래픽을 HTTPS로 리다이렉트하세요.',
			}),
		);
	}

	for (const engine of engines) {
		const id = engine.engine.id;
		const name = engineLabel(id, engine.engine.name);
		const live = liveById.get(id);
		const score = Number.isFinite(engine.score) ? engine.score : 0;
		const reason = liveCause(engine, live, lang);
		const action = liveAction(engine);
		const unexposed = isUnexposed(engine, live);
		const napGap = NAP_RE.test(reason) || localIndexMissing(id, platform);
		const official = isOfficialCite(engine, live);
		const indirect = isIndirectCite(engine, live, platform);

		if (unexposed && (score <= 75 || napGap || crawl.blocked)) {
			issues.push(
				point({
					lang,
					id: `engine-${id}-p1`,
					theme: napGap ? 'geo' : 'engine',
					priority: 'P1',
					weight: 100 - score,
					targetEngines: name,
					title: defaultTitle(id, 'P1', lang),
					cause: reason || defaultCause(name, 'P1', lang),
					action: action || defaultAction(id, 'P1', lang),
				}),
			);
			continue;
		}

		if (unexposed && score > 75) {
			issues.push(
				point({
					lang,
					id: `engine-${id}-p2`,
					theme: 'eeat',
					priority: 'P2',
					weight: 80 - Math.min(score, 79),
					targetEngines: name,
					title: defaultTitle(id, 'P2', lang),
					cause: reason || defaultCause(name, 'P2', lang),
					action: action || defaultAction(id, 'P2', lang),
				}),
			);
			continue;
		}

		if (official && indirect) {
			issues.push(
				point({
					lang,
					id: `engine-${id}-p3`,
					theme: 'schema',
					priority: 'P3',
					weight: 60 - Math.min(score, 59),
					targetEngines: name,
					title: defaultTitle(id, 'P3', lang),
					cause: reason || defaultCause(name, 'P3', lang),
					action: action || defaultAction(id, 'P3', lang),
				}),
			);
		}
	}

	if (schemaRatio < 0.7) {
		const schemaType = input.industry?.schemaType || 'LocalBusiness';
		issues.push(
			point({
				lang,
				id: 'schema-eeat',
				theme: 'schema',
				priority: 'P3',
				weight: 44 + (schemaRatio < 0.4 ? 6 : 0),
				targetEngines: engines
					.filter((engine) => engine.score < 80 || engine.depthLevel !== 3)
					.map((engine) => engineLabel(engine.engine.id, engine.engine.name))
					.join(' · ') || 'AI 공통',
				title:
					lang === 'en'
						? 'Repair on-page JSON-LD / domain entity match'
						: '온페이지 스키마(JSON-LD) · 도메인 엔티티 매칭 보완',
				cause:
					lang === 'en'
						? `Measured ${Math.round(schemaRaw)}/${Math.round(schemaMax)}. ${siteName} is missing enough ${schemaType} structure for ${category} entity matching.`
						: `실측 ${Math.round(schemaRaw)}/${Math.round(schemaMax)}점. ${siteName}의 ${schemaType} 구조가 ${category} 엔티티 매칭에 부족합니다.`,
				action:
					lang === 'en'
						? `Publish a complete ${schemaType} JSON-LD graph with NAP, geo, and sameAs.`
						: `${schemaType} JSON-LD에 NAP·좌표·sameAs를 완결 배포하세요.`,
			}),
		);
	}

	if (!hasLlms) {
		issues.push(
			point({
				lang,
				id: 'llms-txt',
				theme: 'llms',
				priority: 'P2',
				weight: 36,
				targetEngines: 'ChatGPT · Perplexity · Claude',
				title: lang === 'en' ? 'Publish /llms.txt AI index' : '/llms.txt AI 전용 인덱스 배포',
				cause:
					lang === 'en'
						? `AI crawlers have no standard index path to parse ${siteName} official facts.`
						: `주요 AI 크롤러가 ${siteName}의 핵심 서비스와 공식 팩트를 즉시 파싱할 표준 인덱스 통로가 없습니다.`,
				action:
					lang === 'en'
						? `Deploy /llms.txt with ${siteName}, location, and ${category} facts.`
						: `/llms.txt에 ${siteName} 상호·위치·${category}를 고정 배포하세요.`,
			}),
		);
	}

	const seen = new Set<string>();
	const ranked = issues
		.sort((a, b) => {
			const rank = { P1: 0, P2: 1, P3: 2 } as const;
			if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
			return b.weight - a.weight;
		})
		.filter((item) => {
			if (seen.has(item.id) || !item.title || !item.cause) return false;
			seen.add(item.id);
			return true;
		});

	const top3 = ranked.slice(0, 3);
	for (const extra of fallbacks({ lang, siteName, category })) {
		if (top3.length >= 3) break;
		if (seen.has(extra.id)) continue;
		seen.add(extra.id);
		top3.push(extra);
	}
	return top3.slice(0, 3);
}

/** @deprecated Use generateTop3ActionPoints — kept so existing imports keep working. */
export function getTop3ActionPoints(data: ActionPointAnalyzerInput | AuditReport): ActionPointRecord[] {
	return generateTop3ActionPoints(data);
}
