/**
 * Per-engine As-Is / To-Be query-reach simulation.
 * Each engine uses its real answer format — never a copied paragraph.
 * Nouns and prompts come from `universalIndustryRegistry` + live services[0..2].
 */

import { withJosa } from '@/lib/korean-josa';
import {
	resolveIndustryConfig,
	type IndustryConfig,
} from '@/lib/registry/universalIndustryRegistry';

export type SimulationEngineId = 'chatgpt' | 'gemini' | 'claude' | 'perplexity' | 'copilot' | 'clova';
export type SimulationLang = 'ko' | 'en';

export interface QuerySimulation {
	engine: SimulationEngineId;
	engineName: string;
	asIsQuery: string;
	asIsResponse: string;
	asIsDefects: string[];
	toBeQueries: string[];
	toBeResponse: string;
	adviceTags: string[];
}

export interface EngineSimulationInput {
	engine: SimulationEngineId;
	/** @deprecated Use `brandName`. Kept so existing call sites stay valid. */
	hospitalName?: string;
	brandName?: string;
	region: string;
	/** Ranked 1–3 on-page services. */
	services?: string[];
	/** @deprecated Alias of `services`. */
	specialties?: string[];
	domain: string;
	url?: string;
	lang?: SimulationLang;
	asIsQuery?: string;
	toBeQuery?: string;
	industryConfig?: IndustryConfig;
}

const ENGINE_NAME: Record<SimulationEngineId, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Naver Clova',
};

const DEFAULT_DEFECTS_KO = ['#카테고리색인누락', '#구조화데이터부재', '#외부신뢰도보강필요'];
const DEFAULT_DEFECTS_EN = ['#category-index-missing', '#structured-data-absent', '#external-trust-thin'];

const ADVICE: Record<SimulationEngineId, { ko: string[]; en: string[] }> = {
	chatgpt: {
		ko: ['Schema.org 마크업', 'Bing Places 등록', 'GPTBot 수집 허용'],
		en: ['Schema.org markup', 'Bing Places registration', 'Allow GPTBot'],
	},
	gemini: {
		ko: ['Schema.org 마크업', 'Google Business Profile 연동', '지역 프로필 NAP 동기화'],
		en: ['Schema.org markup', 'Google Business Profile', 'NAP sync'],
	},
	claude: {
		ko: ['E-E-A-T 약력', 'FAQ JSON-LD 적용', 'ClaudeBot 수집 허용'],
		en: ['E-E-A-T author bio', 'FAQ JSON-LD', 'Allow ClaudeBot'],
	},
	perplexity: {
		ko: ['FAQ JSON-LD 적용', '인용 가능한 공식 URL', 'Schema.org 마크업'],
		en: ['FAQ JSON-LD', 'Citable official URLs', 'Schema.org markup'],
	},
	copilot: {
		ko: ['Bing 인덱싱', '사이트맵/스키마 신호', 'Edge 링크 카드용 메타'],
		en: ['Bing indexing', 'Sitemap/schema signals', 'Edge link-card meta'],
	},
	clova: {
		ko: ['네이버 플레이스 NAP 동기화', '블로그/지식iN Q&A', '지역 프로필 연동'],
		en: ['Naver Place NAP sync', 'Blog/Knowledge-iN Q&A', 'Local profile'],
	},
};

function cleanDomain(domain: string): string {
	return (domain || '').replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

function uniqueServices(values: readonly (string | null | undefined)[] | undefined): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values ?? []) {
		const phrase = (raw || '').replace(/\s+/g, ' ').trim();
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
		if (out.length >= 3) break;
	}
	return out;
}

function resolveSimConfig(input: {
	brand: string;
	region: string;
	services: string[];
	domain: string;
	url?: string;
	lang: SimulationLang;
	industryConfig?: IndustryConfig;
}): IndustryConfig {
	if (input.industryConfig) {
		return {
			...input.industryConfig,
			services: input.industryConfig.services.length ? input.industryConfig.services : input.services,
			brandName: input.industryConfig.brandName || input.brand,
			location: input.industryConfig.location || input.region,
			domain: input.industryConfig.domain || input.domain,
			url: input.industryConfig.url || input.url,
		};
	}
	return resolveIndustryConfig({
		lang: input.lang,
		brandName: input.brand,
		location: input.region,
		services: input.services,
		primaryKeyword: input.services[0],
		domain: input.domain,
		url: input.url,
		keywords: input.services.join(' '),
		extraText: input.services.join(' '),
	});
}

export function buildRegionSpecialtyQueries(
	region: string,
	specialties: string[],
	lang: SimulationLang = 'ko',
	industryConfig?: IndustryConfig,
): string[] {
	const services = uniqueServices(specialties);
	const config = resolveSimConfig({
		brand: industryConfig?.brandName || '',
		region,
		services,
		domain: industryConfig?.domain || '',
		url: industryConfig?.url,
		lang,
		industryConfig,
	});
	const prompts = config.profile.aiPromptGenerator({
		brandName: config.brandName,
		location: region || config.location,
		primaryKeyword: services[0] || config.primaryKeyword,
		services: services.length ? services : config.services,
		domain: config.domain,
		url: config.url,
		lang,
	});
	return prompts.slice(0, 3);
}

function asIsResponses(
	engine: SimulationEngineId,
	input: {
		brand: string;
		region: string;
		domain: string;
		url: string;
		asIsQuery: string;
		targetQuery: string;
		entity: string;
		lang: SimulationLang;
	},
): string {
	const { brand, region, domain, url, asIsQuery, targetQuery, entity, lang } = input;
	const place = region || (lang === 'en' ? 'the area' : '해당 지역');

	if (lang === 'en') {
		switch (engine) {
			case 'chatgpt':
				return `${brand} is a local ${entity} in ${place}. Official details are published at ${url}. Brand-name search surfaces the site, but unbranded category prompts such as “${targetQuery}” still lack a citable recommendation signal. [1] ${domain}`;
			case 'perplexity':
				return `Sources for “${asIsQuery}” confirm the official listing, but do not yet rank ${brand} for “${targetQuery}”.\n\n* Brand page: [1] ${domain}\n* Category citations: insufficient FAQ / review documents`;
			case 'gemini':
				return `Google Maps / Knowledge Panel can pin ${brand} in ${place} on a brand query. Category lists for “${targetQuery}” still prefer better-structured local results. Hours and directions: ${url}`;
			case 'clova':
				return `A brand-name search shows official info for ${brand}. For “${targetQuery}” the Place / blog signals are still too thin to recommend.`;
			case 'claude':
				return `On an exact-name query, ${brand} is identifiable as a ${place} ${entity}. E-E-A-T signals (author credentials, structured service history) are too thin for me to recommend it on “${targetQuery}”.`;
			case 'copilot':
				return `Bing has an indexed brand page for ${brand} (${domain}). Category query “${targetQuery}” currently returns other Edge-cited locals. Official site: ${url}`;
		}
	}

	switch (engine) {
		case 'chatgpt':
			return `${withJosa(brand, '은/는')} ${place}에 위치한 ${entity}로 확인됩니다. 브랜드명 검색 시 공식 웹사이트가 노출되나, 비브랜드 카테고리 질의(‘${targetQuery}’)에서는 AI 추천 인용 신호가 부족해 누락되고 있습니다.\n\n[1] ${domain}`;
		case 'perplexity':
			return `‘${asIsQuery}’ 출처에서는 ${brand} 공식 페이지가 확인됩니다. 다만 ‘${targetQuery}’ 질의의 인용 카드에는 아직 오르지 않습니다.\n\n* 브랜드 출처: [1] ${domain}\n* 카테고리 인용: FAQ·후기형 문서 부족`;
		case 'gemini':
			return `브랜드 검색 시 Google 지도/지식패널에서 ${brand}(${place}) 위치 핀은 확인됩니다. ‘${targetQuery}’ 카테고리 리스트에서는 구조화 신호가 더 뚜렷한 ${entity}가 우선합니다. 영업시간·길찾기: ${url}`;
		case 'clova':
			return `${withJosa(brand, '은/는')} 상호 검색하면 공식 정보가 나와요. 그런데 ‘${targetQuery}’처럼 지역+핵심 서비스로 물어보면 네이버 플레이스 리뷰나 블로그 신호가 아직 약해서 추천 목록에는 잘 안 올라옵니다. 홈페이지(${domain})에서 위치는 확인할 수 있어요.`;
		case 'claude':
			return `${withJosa(brand, '은/는')} ${place} 소재 ${entity}로 상호 검색에서 식별됩니다. 다만 E-E-A-T 구조화 근거가 부족해, ‘${targetQuery}’와 같은 비브랜드 질의에서는 객관적 추천 후보로 올리지 않습니다.`;
		case 'copilot':
			return `Bing 인덱스에 ${brand} 공식 페이지(${domain})가 있습니다. ‘${targetQuery}’ 카테고리 질의에서는 다른 지역 ${entity} 링크 카드가 우선합니다.\n\n🔗 ${url}`;
	}
}

function toBeResponses(
	engine: SimulationEngineId,
	input: {
		brand: string;
		region: string;
		domain: string;
		url: string;
		targetQuery: string;
		services: string[];
		entity: string;
		representativeTitle: string;
		lang: SimulationLang;
	},
): string {
	const { brand, region, domain, url, targetQuery, services, entity, representativeTitle, lang } = input;
	const place = region || (lang === 'en' ? 'the area' : '해당 지역');
	const joined = services.filter(Boolean).join(', ') || (lang === 'en' ? 'core services' : '핵심 서비스');
	const secondary = services[1] || '';
	const primary = services[0] || joined;

	if (lang === 'en') {
		switch (engine) {
			case 'chatgpt':
				return `For “${targetQuery}”, ${brand} is a reliable local ${entity} in ${place}. Structured pages on ${domain} identify ${joined}. Start with the official site for hours and booking.\n\n[1] ${domain}`;
			case 'perplexity':
				return `“${targetQuery}” — ${brand} is cited as a primary local option.\n\n* Specialties: ${joined}\n* Location: ${place}\n* Source: [1] ${domain} — official services and ${representativeTitle} bio`;
			case 'gemini':
				return `Maps + Knowledge Panel now surface ${brand} (${place}) near the top of “${targetQuery}”. Hours and directions sync from Google Business Profile; details remain on ${url}.`;
			case 'clova':
				return `For “${targetQuery}” I recommend ${brand} in ${place} for ${joined}. Naver Place reviews and blog posts now match the official site (${domain}).`;
			case 'claude':
				return `Based on structured credentials and on-site service history, ${brand} is an evidence-backed option for “${targetQuery}”. Documented focus areas: ${joined}. Official reference: ${url}.`;
			case 'copilot':
				return `Quick Bing summary: ${brand} matches “${targetQuery}” in ${place}. Indexed services: ${joined}.\n\n🔗 ${brand} official site — ${url}`;
		}
	}

	switch (engine) {
		case 'chatgpt':
			return `‘${targetQuery}’ 질의에 대해 ${withJosa(brand, '을/를')} ${place}에서 신뢰할 수 있는 지역 ${withJosa(entity, '으로/로')} 추천합니다. ${joined} 관련 안내가 공식 웹사이트에 정리되어 있습니다.\n\n[1] ${domain}`;
		case 'perplexity':
			return `‘${targetQuery}’ 질의에 대해 **${withJosa(brand, '이/가')}** 주요 ${entity}로 인용됩니다.\n\n* **전문 분야:** ${joined}\n* **위치:** ${place}\n* **출처:** [1] ${domain} - 공식 서비스 및 ${representativeTitle} 약력 안내`;
		case 'gemini':
			return `‘${targetQuery}’ 검색 시 Google 지식패널 및 지도 신호와 연동되어 ${brand} (${place} 소재)가 상위 추천 리스트에 노출됩니다. 영업시간·길찾기는 Google 지도, 상세 안내는 공식 웹사이트(${domain})에서 제공됩니다.`;
		case 'clova':
			return `‘${targetQuery}’ 관련하여 ${place}에서 ${primary}${secondary ? ` 및 ${secondary}` : ''}를 제공하는 ${withJosa(brand, '을/를')} 추천해요. 네이버 플레이스 리뷰·블로그 소개와 공식 웹사이트(${domain})에서 이용 시간을 함께 확인할 수 있어요.`;
		case 'claude':
			return `공개된 E-E-A-T 이력과 구조화된 엔티티를 기준으로 보면, ‘${targetQuery}’에 대해 ${withJosa(brand, '을/를')} 근거 있는 지역 후보로 제시할 수 있습니다. 확인된 전문 영역은 ${joined}이며, ${representativeTitle} 정보는 ${url}에서 검증할 수 있습니다.`;
		case 'copilot':
			return `Bing 요약: ‘${targetQuery}’에 ${place} ${withJosa(brand, '이/가')} 매칭됩니다. 인덱스된 서비스: ${joined}.\n\n🔗 ${brand} 공식 사이트 — ${url}`;
	}
}

export const generateEngineSimulation = (
	engine: SimulationEngineId | string,
	hospitalName: string,
	region: string,
	specialties: string[],
	domain: string,
	extra?: Partial<EngineSimulationInput>,
): QuerySimulation => {
	const id = (['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const).includes(
		engine as SimulationEngineId,
	)
		? (engine as SimulationEngineId)
		: 'chatgpt';
	const lang: SimulationLang = extra?.lang === 'en' ? 'en' : 'ko';
	const host = cleanDomain(extra?.domain || domain);
	const url = extra?.url || `https://${host}`;
	const brand = extra?.brandName || extra?.hospitalName || hospitalName;
	const services = uniqueServices(extra?.services ?? extra?.specialties ?? specialties);
	const config = resolveSimConfig({
		brand,
		region,
		services,
		domain: host,
		url,
		lang,
		industryConfig: extra?.industryConfig,
	});
	const rankedServices = (config.services.length ? config.services : services).slice(0, 3);
	const toBeQueries = buildRegionSpecialtyQueries(region, rankedServices, lang, config);
	const targetQuery = extra?.toBeQuery || toBeQueries[0];
	const asIsQuery = extra?.asIsQuery || (lang === 'en' ? `${brand} official site` : `${brand} 위치`);

	return {
		engine: id,
		engineName: ENGINE_NAME[id],
		asIsQuery,
		asIsResponse: asIsResponses(id, {
			brand,
			region,
			domain: host,
			url,
			asIsQuery,
			targetQuery,
			entity: config.defaultCategory,
			lang,
		}),
		asIsDefects: lang === 'en' ? DEFAULT_DEFECTS_EN : DEFAULT_DEFECTS_KO,
		toBeQueries,
		toBeResponse: toBeResponses(id, {
			brand,
			region,
			domain: host,
			url,
			targetQuery,
			services: rankedServices,
			entity: config.defaultCategory,
			representativeTitle: config.representativeTitle,
			lang,
		}),
		adviceTags: ADVICE[id][lang],
	};
};
