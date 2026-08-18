/**
 * AI Readiness cause mapping + future visibility slots.
 *
 * `score` from the existing engine scorers is an AI Readiness Score
 * (site-analysis estimate). It is not a live ChatGPT/Gemini/… exposure rate.
 * Live visibility / citation / entity-accuracy stay null until a real probe exists.
 *
 * Cause factors are emitted only when crawled diagnostic data confirms a gap.
 * Categories are extensible; unused categories are omitted from the card.
 */

import type { EngineAnalysisId, EngineScoreSignals } from '@/lib/audit/engine-analysis';
import type { AuditLang } from '@/lib/site-auditor';

export type EngineCauseCategory =
	| 'entity'
	| 'structuredData'
	| 'onpage'
	| 'content'
	| 'searchIntent'
	| 'citation'
	| 'externalSignal'
	| 'technical'
	| 'localGeographic'
	| 'eeat'
	| 'brandAuthority'
	| 'businessProfile';

export type EngineCauseSeverity = 'high' | 'medium' | 'low';

export interface EngineCauseFactor {
	id: string;
	category: EngineCauseCategory;
	severity: EngineCauseSeverity;
	title: string;
	detail: string;
}

/** Reserved for live AI-query measurement. Do not invent values. */
export interface AiEngineVisibilityMetrics {
	/** Number of live prompt tests run against this engine. */
	queryTestCount: number | null;
	/** Times the brand / site appeared in AI answers. */
	answerExposureCount: number | null;
	/** Actual mention / exposure rate from live AI queries (0–100). */
	visibilityRate: number | null;
	/** Official URL citations counted in AI answers. */
	officialUrlCitationCount: number | null;
	/** Official URL / brand citation rate in AI answers (0–100). */
	citationRate: number | null;
	/** Accuracy of name / service / address / URL recognition (0–100). */
	entityAccuracy: number | null;
}

export interface EngineCauseAnalysis {
	summary: string;
	factors: EngineCauseFactor[];
}

export function emptyAiEngineVisibilityMetrics(): AiEngineVisibilityMetrics {
	return {
		queryTestCount: null,
		answerExposureCount: null,
		visibilityRate: null,
		officialUrlCitationCount: null,
		citationRate: null,
		entityAccuracy: null,
	};
}

export function hasMeasuredVisibility(metrics: AiEngineVisibilityMetrics | null | undefined): boolean {
	if (!metrics) return false;
	return (
		metrics.queryTestCount != null ||
		metrics.answerExposureCount != null ||
		metrics.visibilityRate != null ||
		metrics.officialUrlCitationCount != null ||
		metrics.citationRate != null ||
		metrics.entityAccuracy != null
	);
}

function onpageCount(signals: EngineScoreSignals): number {
	const n = signals.schemaDefectCount ?? signals.defectCount ?? 0;
	return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function schemaPct(signals: EngineScoreSignals): number {
	return Math.round(Number.isFinite(signals.schemaPct) ? signals.schemaPct : 0);
}

function geoPct(signals: EngineScoreSignals): number {
	return Math.round(Number.isFinite(signals.geoPct) ? signals.geoPct : 0);
}

function technicalPct(signals: EngineScoreSignals): number {
	return Math.round(Number.isFinite(signals.technicalPct) ? signals.technicalPct : 0);
}

function orgFieldList(signals: EngineScoreSignals): string {
	const missing = (signals.organizationMissing ?? []).filter(Boolean).slice(0, 4);
	return missing.length > 0 ? missing.join(', ') : 'name, url, logo, sameAs';
}

function gptBotOk(signals: EngineScoreSignals): boolean {
	if (typeof signals.aiBotAccess?.gptbot === 'boolean') return signals.aiBotAccess.gptbot;
	return signals.aiBotsOk;
}

function claudeBotOk(signals: EngineScoreSignals): boolean {
	if (typeof signals.aiBotAccess?.claudebot === 'boolean') return signals.aiBotAccess.claudebot;
	return signals.aiBotsOk;
}

function faqOk(signals: EngineScoreSignals): boolean {
	return signals.faqPresent || signals.platform.hasFaq || signals.platform.hasHowTo;
}

function longFormMissing(signals: EngineScoreSignals): boolean {
	if (signals.platform.hasArticle || signals.platform.hasNewsArticle) return false;
	if (typeof signals.bodyLength === 'number') return signals.bodyLength < 1000;
	return false;
}

function eeatWeak(signals: EngineScoreSignals): boolean {
	if (signals.eeatOk === true) return false;
	if (signals.eeatOk === false) return true;
	return !signals.platform.hasPerson;
}

function factor(input: EngineCauseFactor): EngineCauseFactor {
	return input;
}

function joinSentences(parts: string[]): string {
	return parts.filter(Boolean).join(' ');
}

function withFallbackSummary(summary: string, factors: EngineCauseFactor[]): EngineCauseAnalysis {
	return {
		summary: summary || factors.map((item) => item.detail).join(' '),
		factors,
	};
}

function schemaFactor(
	signals: EngineScoreSignals,
	lang: AuditLang,
	severity: EngineCauseSeverity,
): EngineCauseFactor {
	const schema = schemaPct(signals);
	const en = lang === 'en';
	return factor({
		id: 'structured-data',
		category: 'structuredData',
		severity,
		title: en ? 'Thin structured data' : 'Structured Data 부족',
		detail: en
			? `Schema coverage of ${schema}% was confirmed.`
			: `Schema 커버리지 ${schema}%가 확인되었습니다.`,
	});
}

function onpageFactor(signals: EngineScoreSignals, lang: AuditLang): EngineCauseFactor {
	const n = onpageCount(signals);
	const en = lang === 'en';
	return factor({
		id: 'onpage',
		category: 'onpage',
		severity: 'medium',
		title: en ? 'On-page improvements' : 'On-page 개선',
		detail: en ? `${n} on-page improvement items were found.` : `${n}건의 개선 항목이 확인되었습니다.`,
	});
}

function analyzeGemini(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const p = signals.platform;
	const factors: EngineCauseFactor[] = [];
	const fields = orgFieldList(signals);
	const localThin = !p.hasLocalBusiness || (!p.googleMapsLinked && !p.hasGeoCoordinates && !p.hasAddress);

	if (!signals.orgComplete) {
		factors.push(
			factor({
				id: 'organization-entity',
				category: 'entity',
				severity: 'high',
				title: en ? 'Weak Organization entity' : 'Organization Entity 부족',
				detail: en
					? `Core attributes such as ${fields} are missing.`
					: `${fields} 등 핵심 속성이 부족합니다.`,
			}),
		);
	}
	if (localThin) {
		factors.push(
			factor({
				id: 'local-geographic',
				category: 'localGeographic',
				severity: 'high',
				title: en ? 'Weak local / geographic signal' : 'Local / Geographic Signal 부족',
				detail: en
					? 'Signals that clearly convey local business information are thin.'
					: '지역 기반 비즈니스 정보를 명확하게 전달할 수 있는 신호가 부족합니다.',
			}),
		);
	}
	if (signals.napOk === false) {
		factors.push(
			factor({
				id: 'nap-entity',
				category: 'entity',
				severity: 'medium',
				title: en ? 'Incomplete NAP entity' : 'NAP Entity 부족',
				detail:
					signals.napIssue ||
					(en
						? 'Name, address, and telephone (NAP) signals are incomplete.'
						: 'NAP(상호·주소·전화) 신호가 완결되지 않았습니다.'),
			}),
		);
	}
	if (schemaPct(signals) < 55) {
		factors.push(schemaFactor(signals, lang, 'high'));
	}
	if (onpageCount(signals) > 0) {
		factors.push(onpageFactor(signals, lang));
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'Organization, LocalBusiness, and local-entity signals are in place, so the Gemini AI-search readiness baseline looks solid.'
				: 'Organization·LocalBusiness 및 지역 엔티티 신호가 확인되어 Gemini AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					!signals.orgComplete
						? `Organization structured data is missing core attributes such as ${fields}.`
						: '',
					localThin
						? 'LocalBusiness / local-entity signals that can convey geographic business facts are thin.'
						: '',
					signals.napOk === false
						? signals.napIssue || 'Name, address, and telephone (NAP) signals are incomplete.'
						: '',
				])
			: joinSentences([
					!signals.orgComplete
						? `Organization 구조화 데이터에서 ${fields} 등 핵심 속성이 부족합니다.`
						: '',
					localThin
						? 'LocalBusiness 정보 및 지역 기반 엔티티 신호가 충분하지 않습니다.'
						: '',
					signals.napOk === false
						? signals.napIssue || 'NAP(상호·주소·전화) 신호가 완결되지 않았습니다.'
						: '',
				]),
		factors,
	);
}

function analyzeChatGpt(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const p = signals.platform;
	const factors: EngineCauseFactor[] = [];
	const n = onpageCount(signals);
	const schema = schemaPct(signals);
	const externalThin = p.sameAsCount === 0 || !signals.orgComplete;

	if (externalThin) {
		factors.push(
			factor({
				id: 'external-entity',
				category: 'externalSignal',
				severity: 'high',
				title: en ? 'Weak external entity signal' : 'External Entity Signal 부족',
				detail: en
					? 'External business data and brand-to-URL connection signals are thin.'
					: '외부 비즈니스 데이터와 브랜드·URL 연결 신호가 부족합니다.',
			}),
		);
	}
	if (!p.bingPlacesLinked) {
		factors.push(
			factor({
				id: 'bing-places-profile',
				category: 'businessProfile',
				severity: 'low',
				title: en ? 'Business profile signal' : 'Business Profile Signal',
				detail: en
					? 'A Bing Places connection signal was not confirmed.'
					: 'Bing Places 연결 신호가 확인되지 않습니다.',
			}),
		);
	}
	if (schema < 55) {
		factors.push(schemaFactor(signals, lang, 'high'));
	}
	if (n > 0) {
		factors.push(onpageFactor(signals, lang));
	}
	if (!gptBotOk(signals)) {
		factors.push(
			factor({
				id: 'gptbot',
				category: 'technical',
				severity: 'high',
				title: en ? 'GPTBot crawl access' : 'Technical Readiness',
				detail: en
					? 'A GPTBot crawl-allow signal was not confirmed in robots.txt.'
					: 'robots.txt에서 GPTBot 수집 허용 신호가 확인되지 않습니다.',
			}),
		);
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'External business-entity and schema signals are in place, so the ChatGPT AI-search readiness baseline looks solid.'
				: '외부 비즈니스 엔티티와 스키마 신호가 확인되어 ChatGPT AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					externalThin ? 'External business-entity signals are thin.' : '',
					schema < 55 ? `Schema coverage of ${schema}% was confirmed.` : '',
					n > 0 ? `${n} on-page improvement items were found.` : '',
				])
			: joinSentences([
					externalThin ? '외부 비즈니스 엔티티 신호가 부족합니다.' : '',
					schema < 55 ? `Schema 커버리지 ${schema}%가 확인되었습니다.` : '',
					n > 0 ? `${n}건의 온페이지 개선 항목이 확인되었습니다.` : '',
				]),
		factors,
	);
}

function analyzePerplexity(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const p = signals.platform;
	const factors: EngineCauseFactor[] = [];
	const geo = geoPct(signals);
	const docs = p.officialDocCount;

	if (docs < 2) {
		factors.push(
			factor({
				id: 'citation-docs',
				category: 'citation',
				severity: 'high',
				title: en ? 'Weak citation signal' : 'Citation Signal 부족',
				detail: en
					? `${docs} citable official documents were confirmed.`
					: `인용 가능한 공식 문서가 ${docs}건으로 확인되었습니다.`,
			}),
		);
	}
	if (!faqOk(signals)) {
		factors.push(
			factor({
				id: 'content-search-intent',
				category: 'searchIntent',
				severity: 'high',
				title: en ? 'Thin content / search-intent structure' : 'Content / Search Intent 부족',
				detail: en
					? 'FAQ/HowTo and other question-intent content structures are not sufficient.'
					: 'FAQ/HowTo 등 질문 의도에 대응할 수 있는 콘텐츠 구조가 부족합니다.',
			}),
		);
	}
	if (geo < 55) {
		factors.push(
			factor({
				id: 'geo-citation',
				category: 'citation',
				severity: 'low',
				title: 'GEO Citation',
				detail: en
					? `The current GEO citation signal is ${geo}, so there is room to improve.`
					: `현재 GEO 인용 신호가 ${geo}점으로 개선 여지가 있습니다.`,
			}),
		);
	}
	if (onpageCount(signals) > 0) {
		factors.push(onpageFactor(signals, lang));
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'Citable official content and FAQ/HowTo structure are in place, so the Perplexity AI-search readiness baseline looks solid.'
				: '인용 가능한 공식 콘텐츠와 FAQ/HowTo 구조가 확인되어 Perplexity AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					docs < 2 ? 'Citable official content is thin.' : '',
					!faqOk(signals)
						? 'FAQ/HowTo structures that can answer question intent are not sufficient.'
						: '',
					geo < 55 ? `The current GEO citation signal is ${geo}, so there is room to improve.` : '',
				])
			: joinSentences([
					docs < 2 ? '인용 가능한 공식 콘텐츠와 구조화된 정보가 부족합니다.' : '',
					!faqOk(signals)
						? 'FAQ/HowTo 등 질문 의도에 대응할 수 있는 콘텐츠 구조가 충분하지 않습니다.'
						: '',
					geo < 55 ? `현재 GEO 인용 신호도 ${geo}점으로 개선 여지가 있습니다.` : '',
				]),
		factors,
	);
}

function analyzeClaude(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const factors: EngineCauseFactor[] = [];
	const tech = technicalPct(signals);
	const n = onpageCount(signals);
	const faqMissing = !faqOk(signals);
	const longFormGap = longFormMissing(signals);

	if (faqMissing || longFormGap) {
		const detail = en
			? faqMissing && longFormGap
				? 'FAQ pages and long-form expert content are thin.'
				: faqMissing
					? 'FAQ content that can answer expert questions is thin.'
					: 'Long-form expert content is thin.'
			: faqMissing && longFormGap
				? 'FAQ 및 장문형 전문 콘텐츠가 부족합니다.'
				: faqMissing
					? 'FAQ 콘텐츠가 부족합니다.'
					: '장문형 전문 콘텐츠가 부족합니다.';
		factors.push(
			factor({
				id: 'expert-content',
				category: 'content',
				severity: 'medium',
				title: en ? 'Thin expert content' : '전문 콘텐츠 부족',
				detail,
			}),
		);
	}
	if (eeatWeak(signals)) {
		factors.push(
			factor({
				id: 'eeat',
				category: 'eeat',
				severity: 'medium',
				title: en ? 'Weak E-E-A-T signals' : 'E-E-A-T 신호 부족',
				detail: en
					? 'Content and external signals that support expertise, experience, and trust are thin.'
					: '전문성·경험·신뢰성을 뒷받침하는 콘텐츠와 외부 신호가 부족합니다.',
			}),
		);
	}
	if (tech < 55) {
		factors.push(
			factor({
				id: 'technical-readiness',
				category: 'technical',
				severity: 'medium',
				title: 'Technical Readiness',
				detail: en
					? `Technical completeness is ${tech}%, so more work is needed.`
					: `기술 완성도가 ${tech}%로 추가 개선이 필요합니다.`,
			}),
		);
	}
	if (n > 0) {
		factors.push(onpageFactor(signals, lang));
	}
	if (schemaPct(signals) < 55) {
		factors.push(schemaFactor(signals, lang, 'low'));
	}
	if (!claudeBotOk(signals)) {
		factors.push(
			factor({
				id: 'claudebot',
				category: 'technical',
				severity: 'high',
				title: en ? 'ClaudeBot crawl access' : 'ClaudeBot 수집 신호',
				detail: en
					? 'A ClaudeBot crawl-allow signal was not confirmed in robots.txt.'
					: 'robots.txt에서 ClaudeBot 수집 허용 신호가 확인되지 않습니다.',
			}),
		);
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'Technical, FAQ, and E-E-A-T signals are in place, so the Claude AI-search readiness baseline looks solid.'
				: '기술·FAQ·E-E-A-T 신호가 확인되어 Claude AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					faqMissing || longFormGap
						? 'FAQ pages, long-form expert content, and E-E-A-T signals are still thin.'
						: '',
					tech < 55 ? `Technical completeness of ${tech}% also needs more work.` : '',
				])
			: joinSentences([
					faqMissing || longFormGap
						? 'FAQ 및 장문형 전문 콘텐츠와 E-E-A-T 신호가 부족합니다.'
						: '',
					tech < 55 ? `기술 완성도 ${tech}%도 추가 개선이 필요합니다.` : '',
				]),
		factors,
	);
}

function analyzeCopilot(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const p = signals.platform;
	const factors: EngineCauseFactor[] = [];
	const schema = schemaPct(signals);
	const n = onpageCount(signals);
	const bingEntityThin = !p.bingPlacesLinked || p.sameAsCount === 0;

	if (bingEntityThin) {
		factors.push(
			factor({
				id: 'bing-entity',
				category: 'entity',
				severity: 'high',
				title: en ? 'Weak Bing entity signal' : 'Bing Entity Signal 부족',
				detail: en
					? 'Business and entity signals that Bing-family search systems can use are thin.'
					: 'Bing 검색 생태계에서 활용될 수 있는 비즈니스·엔티티 신호가 부족합니다.',
			}),
		);
	}
	if (!p.bingPlacesLinked) {
		factors.push(
			factor({
				id: 'bing-places-profile',
				category: 'businessProfile',
				severity: 'low',
				title: en ? 'Business profile signal' : 'Business Profile Signal',
				detail: en
					? 'A Bing Places connection signal was not confirmed.'
					: 'Bing Places 연결 신호가 확인되지 않습니다.',
			}),
		);
	}
	if (schema < 55) {
		factors.push(schemaFactor(signals, lang, 'high'));
	}
	if (n > 0) {
		factors.push(onpageFactor(signals, lang));
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'Bing-family business-entity and schema signals are in place, so the Copilot AI-search readiness baseline looks solid.'
				: 'Bing 계열 비즈니스 엔티티와 스키마 신호가 확인되어 Copilot AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					bingEntityThin
						? 'Business and entity signals that Bing-family search systems can use are thin.'
						: '',
					schema < 55 ? `Schema coverage of ${schema}% was confirmed.` : '',
					n > 0 ? `${n} on-page improvement items were found.` : '',
				])
			: joinSentences([
					bingEntityThin
						? 'Bing 검색 생태계에서 활용될 수 있는 비즈니스·엔티티 신호가 부족합니다.'
						: '',
					schema < 55 ? `Schema 커버리지 ${schema}%가 확인되었습니다.` : '',
					n > 0 ? `${n}건의 온페이지 개선 항목이 확인됩니다.` : '',
				]),
		factors,
	);
}

function analyzeClova(signals: EngineScoreSignals, lang: AuditLang): EngineCauseAnalysis {
	const en = lang === 'en';
	const p = signals.platform;
	const factors: EngineCauseFactor[] = [];
	const n = onpageCount(signals);
	const naverEntityThin = !p.naverPlaceLinked || !p.naverBlogLinked || signals.keywords.length < 3;

	if (naverEntityThin) {
		factors.push(
			factor({
				id: 'naver-entity',
				category: 'entity',
				severity: 'high',
				title: en ? 'Weak Naver entity signal' : 'Naver Entity Signal 부족',
				detail: en
					? 'Official business and content signals that the Naver ecosystem can use are thin.'
					: '네이버 생태계에서 활용될 수 있는 공식 비즈니스·콘텐츠 신호가 부족합니다.',
			}),
		);
	}
	if (!p.naverPlaceLinked) {
		factors.push(
			factor({
				id: 'naver-place-profile',
				category: 'businessProfile',
				severity: 'low',
				title: en ? 'Business profile signal' : 'Business Profile Signal',
				detail: en
					? 'A Naver Place connection signal was not confirmed.'
					: '네이버 플레이스 연결 신호가 확인되지 않습니다.',
			}),
		);
	}
	if (!p.naverBlogLinked) {
		factors.push(
			factor({
				id: 'external-content',
				category: 'externalSignal',
				severity: 'low',
				title: en ? 'External content signal' : 'External Content Signal',
				detail: en
					? 'External content and brand-connection signals still need reinforcement.'
					: '외부 콘텐츠와 브랜드 연결 신호를 보강할 필요가 있습니다.',
			}),
		);
	}
	if (schemaPct(signals) < 55) {
		factors.push(schemaFactor(signals, lang, 'high'));
	}
	if (n > 0) {
		factors.push(onpageFactor(signals, lang));
	}

	if (factors.length === 0) {
		return {
			summary: en
				? 'Naver Place and official content signals are in place, so the Clova AI-search readiness baseline looks solid.'
				: '네이버 플레이스와 공식 콘텐츠 신호가 확인되어 Clova AI 검색 준비 기반이 갖춰져 있습니다.',
			factors,
		};
	}

	return withFallbackSummary(
		en
			? joinSentences([
					naverEntityThin
						? 'Official business and content signals that the Naver ecosystem can use are thin.'
						: '',
					n > 0 ? `Also, ${n} on-page improvement items were found.` : '',
				])
			: joinSentences([
					naverEntityThin
						? '네이버 생태계에서 활용될 수 있는 공식 비즈니스·콘텐츠 신호가 부족합니다.'
						: '',
					n > 0 ? `또한 ${n}건의 온페이지 개선 항목이 확인됩니다.` : '',
				]),
		factors,
	);
}

const ANALYZERS: Record<EngineAnalysisId, (signals: EngineScoreSignals, lang: AuditLang) => EngineCauseAnalysis> = {
	gemini: analyzeGemini,
	chatgpt: analyzeChatGpt,
	perplexity: analyzePerplexity,
	claude: analyzeClaude,
	copilot: analyzeCopilot,
	clova: analyzeClova,
};

export function buildEngineCauseAnalysis(
	engine: EngineAnalysisId,
	signals: EngineScoreSignals,
	lang: AuditLang = 'ko',
): EngineCauseAnalysis {
	return ANALYZERS[engine](signals, lang);
}

export function httpsEngineCriticalAnalysis(failCount: number, lang: AuditLang = 'ko'): EngineCauseAnalysis {
	const n = Number.isFinite(failCount) ? Math.max(0, Math.round(failCount)) : 0;
	const en = lang === 'en';
	return {
		summary: en
			? `[Critical] HTTPS is not applied, so the site's trust and crawl foundation is weak, and ${n} on-page improvement items were found.`
			: `[치명적] HTTPS가 적용되지 않아 사이트의 신뢰·수집 기반이 취약하고, 온페이지 개선 항목 ${n}건이 확인됩니다.`,
		factors: [
			factor({
				id: 'https',
				category: 'technical',
				severity: 'high',
				title: en ? 'HTTPS / trust foundation' : 'Technical Readiness',
				detail: en
					? 'The origin is not served over HTTPS, so trust and crawl-foundation signals are weak.'
					: '사이트가 HTTPS로 제공되지 않아 신뢰·수집 기반 신호가 취약합니다.',
			}),
			...(n > 0
				? [
						factor({
							id: 'onpage',
							category: 'onpage',
							severity: 'medium',
							title: en ? 'On-page improvements' : 'On-page 개선',
							detail: en
								? `${n} on-page improvement items were found.`
								: `${n}건의 온페이지 개선 항목이 확인되었습니다.`,
						}),
					]
				: []),
		],
	};
}
