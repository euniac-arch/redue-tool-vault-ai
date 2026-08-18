/**
 * Engine-specific Level 3 lift guides.
 *
 * When an AI engine stays at Level 2 (category+location), this module
 * builds the conversational query, keyword combos, and on-page/schema
 * prescription that engine needs to cite the brand on unbranded
 * “please recommend” prompts (Level 3).
 */

import { getEngineKeyActions } from '@/lib/geo/trigger-simulation';
import {
	ENGINE_EXPANDED_PATTERN,
	parseQueryLocation,
	type ToBeQueryPattern,
} from '@/lib/geo/query-location';
import type { AIEngineId } from '@/types/geo-diagnostic';
import type {
	EngineLevel3KeywordCombo,
	EngineOptimizationGuide,
	EngineOptimizationName,
} from '@/types/geo-trigger-simulation';

export type GuideLang = 'ko' | 'en';

export interface BuildEngineOptimizationGuideInput {
	engineId: AIEngineId;
	currentLevel: 1 | 2 | 3;
	lang?: GuideLang;
	location?: string;
	category?: string;
	specialties?: readonly string[];
	needSignals?: readonly string[];
	brandName?: string;
}

const ENGINE_NAME: Record<AIEngineId, EngineOptimizationName> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Naver Clova',
};

const CHARACTERISTICS: Record<AIEngineId, Record<GuideLang, string>> = {
	chatgpt: {
		ko: 'Bing 웹 인덱스·Places·GPTBot 수집 비중이 큽니다(봇 45% + GEO 35% + FAQ 20%). 전국형 대화 질의(“~잘하는 곳 추천해줘”)에서 공식 출처와 최근 웹 언급이 있어야 비브랜드 1순위 추천(Level 3)으로 올라갑니다.',
		en: 'ChatGPT Search weights Bing web index, Places, and GPTBot access (bots 45% + GEO 35% + FAQ 20%). Nationwide conversational prompts (“recommend a place that is good at…”) need official sources and recent web mentions to unlock Level 3.',
	},
	gemini: {
		ko: 'Google 지식그래프·GBP·LocalBusiness JSON-LD 가중치가 높습니다(Organization 45% + 스키마 30% + GEO 25%). 구/동 단위 로컬 질의와 지도 좌표·영업시간·리뷰가 맞아야 카테고리(Level 2)에서 직접 추천(Level 3)으로 전환됩니다.',
		en: 'Gemini Grounding weights the Knowledge Graph, Google Business Profile, and LocalBusiness JSON-LD (Organization 45% + schema 30% + GEO 25%). District-level local prompts plus map coordinates, hours, and reviews convert Level 2 category hits into Level 3 recommendations.',
	},
	claude: {
		ko: 'E-E-A-T 긴 글·저자 엔티티·FAQ 밀도를 봅니다(FAQ 35% + 기술 35% + GEO 30%). 광역 전문형 질의(“서울에서 ~ 전문으로 하는 곳”)에 임상/약력 근거가 있어야 Level 3 인용에 들어갑니다.',
		en: 'Claude weights E-E-A-T long-form, author entities, and FAQ density (FAQ 35% + technical 35% + GEO 30%). Metro specialist prompts (“recommend a place in Seoul that specializes in…”) need cited credentials to reach Level 3.',
	},
	perplexity: {
		ko: '인용 가능한 FAQ/HowTo와 공식 URL 클러스터가 핵심입니다(FAQ 50% + GEO 50%). “공식 후기/상담”형 전국 질의에서 /llms.txt와 출처 URL이 있어야 Level 3 정답 카드에 고정됩니다.',
		en: 'Perplexity weights citable FAQ/HowTo pages and official URL clusters (FAQ 50% + GEO 50%). Nationwide “official review / consultation” prompts need /llms.txt and source URLs to lock a Level 3 answer card.',
	},
	copilot: {
		ko: 'Bing 색인·Places·사이트맵/스키마 신호에 의존합니다(봇 30% + 스키마 30% + GEO 40%). 광역 “~ 추천” 질의에서 Bing 링크 카드가 열려야 Level 3로 올라갑니다.',
		en: 'Copilot depends on Bing index, Places, and sitemap/schema signals (bots 30% + schema 30% + GEO 40%). Metro “recommend …” prompts need an open Bing link card to reach Level 3.',
	},
	clova: {
		ko: '네이버 스마트플레이스 NAP·블로그·지식iN 최신성이 좌우합니다(GEO 45% + FAQ 30% + 키워드 25%). 구 단위 구어체(“어디야/알려줘”)와 플레이스 리뷰가 쌓여야 Level 3 직접 추천이 됩니다.',
		en: 'Naver Clova is driven by Smart Place NAP, blog, and Knowledge-iN freshness (GEO 45% + FAQ 30% + keywords 25%). District-level spoken prompts (“where is a good… / tell me”) plus Place reviews unlock Level 3.',
	},
};

const EXTRA_TIPS: Record<AIEngineId, Record<GuideLang, string[]>> = {
	chatgpt: {
		ko: [
			'비브랜드 “추천해줘” FAQ를 공식 URL에 배포하고 Bing이 크롤할 수 있게 사이트맵에 넣으세요.',
			'최근 30일 웹 언급(보도/후기)을 늘려 ChatGPT Search가 전국형 질의에서 1순위로 고정하게 하세요.',
		],
		en: [
			'Publish unbranded “please recommend” FAQs on official URLs and submit them in the Bing sitemap.',
			'Grow last-30-day web mentions so ChatGPT Search can lock rank-1 on nationwide prompts.',
		],
	},
	gemini: {
		ko: [
			'GBP 카테고리·좌표·영업시간을 LocalBusiness JSON-LD와 1:1로 맞추세요. Gemini는 지도 핀이 없는 업체를 Level 3에서 제외합니다.',
			'“지금 예약/후기 좋은 곳”형 로컬 FAQ를 페이지에 두고 FAQPage 스키마로 감싸세요.',
		],
		en: [
			'Keep GBP category, coordinates, and hours 1:1 with LocalBusiness JSON-LD. Gemini drops map-less businesses from Level 3.',
			'Add local FAQs such as “book now / highly reviewed nearby” and wrap them in FAQPage.',
		],
	},
	claude: {
		ko: [
			'시술/서비스 적응증·주의사항·담당자 약력을 긴 글로 공개하고 Person/Physician 엔티티를 연결하세요.',
			'학술·공공 출처 백링크와 FAQ JSON-LD를 보강해 광역 전문 질의에서 인용 자격을 만드세요.',
		],
		en: [
			'Publish long-form indications, cautions, and specialist bios, then link Person/Physician entities.',
			'Add academic/public citation backlinks and FAQ JSON-LD so metro specialist prompts can cite you.',
		],
	},
	perplexity: {
		ko: [
			'사이트 루트 /llms.txt에 공식 사실·FAQ URL을 나열하세요. Perplexity는 출처 클러스터가 없으면 Level 3 카드를 열지 않습니다.',
			'HowTo/FAQPage를 “상담/공식 후기” 질의에 맞춰 쓰고 각 답변에 자체 출처 URL을 넣으세요.',
		],
		en: [
			'List official facts and FAQ URLs in root /llms.txt. Perplexity will not open a Level 3 card without a source cluster.',
			'Write HowTo/FAQPage copy for “consultation / official review” prompts and attach first-party source URLs.',
		],
	},
	copilot: {
		ko: [
			'Bing Webmaster Tools에 사이트맵을 제출하고 Places 프로필의 NAP를 온페이지와 일치시키세요.',
			'광역 “추천” 질의용 메타·스키마를 배포해 Edge/Copilot 링크 카드가 열리게 하세요.',
		],
		en: [
			'Submit the sitemap in Bing Webmaster Tools and match Places NAP to the on-page entity.',
			'Ship metro “recommend” meta/schema so Edge/Copilot can open a link card.',
		],
	},
	clova: {
		ko: [
			'네이버 스마트플레이스 업종/키워드를 온페이지 카테고리와 일치시키고 최근 리뷰를 쌓으세요.',
			'지식iN·공식 블로그에 브랜드명 없는 “어디야/알려줘” Q&A를 발행해 클로바 대화형 추천을 여세요.',
		],
		en: [
			'Align Naver Smart Place category/keywords with the on-page category and grow recent reviews.',
			'Publish unbranded “where / tell me” Q&A on Knowledge-iN and the official blog to open Clova conversational recommend.',
		],
	},
};

function normalize(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function containsBrand(text: string, brandName: string): boolean {
	const brand = normalize(brandName);
	const hay = normalize(text);
	if (!brand || brand.length < 2 || !hay) return false;
	return hay.toLowerCase().includes(brand.toLowerCase());
}

function stripBrand(text: string, brandName: string): string {
	const brand = normalize(brandName);
	if (!brand) return normalize(text);
	return normalize(text.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ''));
}

function resolveEntity(input: BuildEngineOptimizationGuideInput): string {
	const specialty = normalize(input.specialties?.[0]);
	const category = normalize(input.category);
	const entity = specialty || category;
	const cleaned = stripBrand(entity, input.brandName || '');
	if (cleaned) return cleaned;
	return input.lang === 'en' ? 'clinic' : '클리닉';
}

function queryPatternFor(engineId: AIEngineId): ToBeQueryPattern {
	return ENGINE_EXPANDED_PATTERN[engineId]?.pattern ?? 'nationwide';
}

function buildLevel3OptimizedQuery(
	engineId: AIEngineId,
	lang: GuideLang,
	location: string,
	entity: string,
	needSignals: readonly string[],
): string {
	const loc = parseQueryLocation(location);
	const hasConsult = needSignals.some((n) => /상담|consult/i.test(n));
	const hasEvening = needSignals.some((n) => /야간|evening/i.test(n));

	if (lang === 'en') {
		const local = loc.colloquial || loc.localFocus;
		const metro = loc.metro || local;
		switch (engineId) {
			case 'gemini':
				return local
					? `Can you recommend a place in ${local} for ${entity} that I can book now?`
					: `Can you recommend a nearby ${entity} I can book now?`;
			case 'clova':
				return local
					? `Where is a highly reviewed ${entity} in ${local}?`
					: `Tell me a highly reviewed ${entity} nearby.`;
			case 'claude':
				return metro
					? `Recommend a place in ${metro} that specializes in ${entity}.`
					: `Recommend a specialist for ${entity}.`;
			case 'copilot':
				return metro ? `recommend ${entity} in ${metro}` : `recommend ${entity}`;
			case 'perplexity':
				return hasConsult
					? `official reviews for a trusted ${entity} consultation`
					: `official reviews for a trusted ${entity}`;
			case 'chatgpt':
			default:
				return hasEvening
					? `recommend a highly rated ${entity} that is open in the evening`
					: `recommend a highly rated place for ${entity}`;
		}
	}

	const local = loc.colloquial || loc.localFocus;
	const district = loc.district || loc.localFocus;
	const metro = loc.metro || local;

	switch (engineId) {
		case 'gemini':
			return local
				? `${local}에서 ${entity} 지금 예약할 수 있는 곳 추천해줘`
				: `${entity} 지금 예약할 수 있는 곳 추천해줘`;
		case 'clova':
			return district
				? `${district} ${entity} 잘하는 곳 어디야`
				: `${entity} 잘하는 곳 알려줘`;
		case 'claude':
			return metro
				? `${metro}에서 ${entity} 전문으로 하는 곳 추천해줘`
				: `${entity} 전문으로 하는 곳 추천해줘`;
		case 'copilot':
			return metro ? `${metro} ${entity} 추천` : `${entity} 추천`;
		case 'perplexity':
			return hasConsult
				? `${entity} 상담 잘하는 곳 공식 후기 알려줘`
				: `${entity} 잘하는 곳 공식 후기 알려줘`;
		case 'chatgpt':
		default:
			return hasEvening
				? `${entity} 잘하고 야간에도 이용 가능한 곳 추천해줘`
				: `${entity} 잘하는 곳 추천해줘`;
	}
}

function combo(
	id: string,
	tokens: string[],
	query: string,
	intent: string,
): EngineLevel3KeywordCombo {
	return {
		id,
		tokens: tokens.map(normalize).filter(Boolean),
		query: normalize(query),
		intent,
	};
}

function buildKeywordCombos(
	engineId: AIEngineId,
	lang: GuideLang,
	location: string,
	entity: string,
	optimizedQuery: string,
	needSignals: readonly string[],
): EngineLevel3KeywordCombo[] {
	const loc = parseQueryLocation(location);
	const local = loc.colloquial || loc.localFocus;
	const district = loc.district || loc.localFocus;
	const metro = loc.metro || local;
	const consult = needSignals.find((n) => /상담|consult/i.test(n));
	const evening = needSignals.find((n) => /야간|evening/i.test(n));

	if (lang === 'en') {
		switch (engineId) {
			case 'gemini':
				return [
					combo('gemini-book', [local || 'nearby', entity, 'book now'], optimizedQuery, 'Maps booking intent'),
					combo(
						'gemini-review',
						[district || local || 'local', entity, 'reviews'],
						local ? `highly reviewed ${entity} in ${local}` : `highly reviewed ${entity}`,
						'Local review intent',
					),
				];
			case 'clova':
				return [
					combo('clova-where', [district || local || 'nearby', entity, 'where'], optimizedQuery, 'Spoken local ask'),
					combo(
						'clova-tell',
						[local || district || 'nearby', entity, 'tell me'],
						local ? `tell me a good ${entity} in ${local}` : `tell me a good ${entity}`,
						'Conversational Place ask',
					),
				];
			case 'claude':
				return [
					combo('claude-specialist', [metro || 'metro', entity, 'specializes'], optimizedQuery, 'Metro specialist intent'),
					combo(
						'claude-evidence',
						[metro || 'metro', entity, 'credentials'],
						metro ? `${entity} specialist in ${metro} with published credentials` : `${entity} specialist credentials`,
						'E-E-A-T evidence intent',
					),
				];
			case 'copilot':
				return [
					combo('copilot-recommend', [metro || 'metro', entity, 'recommend'], optimizedQuery, 'Bing recommend card'),
					combo(
						'copilot-places',
						[metro || 'metro', entity, 'Places'],
						metro ? `${metro} ${entity} Bing Places` : `${entity} Bing Places`,
						'Places link-card intent',
					),
				];
			case 'perplexity':
				return [
					combo(
						'pplx-official',
						[entity, consult || 'consultation', 'official reviews'],
						optimizedQuery,
						'Citable source intent',
					),
					combo(
						'pplx-howto',
						[entity, 'FAQ', 'official URL'],
						`official FAQ for ${entity}`,
						'FAQ/HowTo citation',
					),
				];
			case 'chatgpt':
			default:
				return [
					combo(
						'gpt-nationwide',
						[entity, 'highly rated', 'recommend'],
						optimizedQuery,
						'Nationwide conversational',
					),
					combo(
						'gpt-evening',
						[entity, evening || 'reviews', 'recommend'],
						evening ? `recommend ${entity} open in the evening` : `recommend ${entity} with recent reviews`,
						'Recency / hours intent',
					),
				];
		}
	}

	switch (engineId) {
		case 'gemini':
			return [
				combo('gemini-book', [local || '근처', entity, '지금 예약'], optimizedQuery, '지도 예약 의도'),
				combo(
					'gemini-review',
					[district || local || '지역', entity, '후기'],
					local ? `${local} ${entity} 후기 좋은 곳` : `${entity} 후기 좋은 곳`,
					'로컬 후기 의도',
				),
			];
		case 'clova':
			return [
				combo('clova-where', [district || local || '근처', entity, '어디야'], optimizedQuery, '구어체 로컬 질문'),
				combo(
					'clova-tell',
					[local || district || '근처', entity, '알려줘'],
					local ? `${local} ${entity} 잘하는 곳 알려줘` : `${entity} 잘하는 곳 알려줘`,
					'플레이스 대화형',
				),
			];
		case 'claude':
			return [
				combo('claude-specialist', [metro || '광역', entity, '전문'], optimizedQuery, '광역 전문 의도'),
				combo(
					'claude-evidence',
					[metro || '광역', entity, '약력'],
					metro ? `${metro} ${entity} 전문 기관 약력` : `${entity} 전문 기관 약력`,
					'E-E-A-T 근거 의도',
				),
			];
		case 'copilot':
			return [
				combo('copilot-recommend', [metro || '광역', entity, '추천'], optimizedQuery, 'Bing 추천 카드'),
				combo(
					'copilot-places',
					[metro || '광역', entity, 'Places'],
					metro ? `${metro} ${entity} Bing Places` : `${entity} Bing Places`,
					'링크 카드 의도',
				),
			];
		case 'perplexity':
			return [
				combo(
					'pplx-official',
					[entity, consult || '상담', '공식 후기'],
					optimizedQuery,
					'인용 출처 의도',
				),
				combo(
					'pplx-howto',
					[entity, 'FAQ', '공식 URL'],
					`${entity} 공식 FAQ`,
					'FAQ/HowTo 인용',
				),
			];
		case 'chatgpt':
		default:
			return [
				combo('gpt-nationwide', [entity, '잘하는 곳', '추천해줘'], optimizedQuery, '전국형 대화'),
				combo(
					'gpt-evening',
					[entity, evening || '후기', '추천해줘'],
					evening ? `${entity} 야간에도 이용 가능한 곳 추천해줘` : `${entity} 후기 좋은 곳 추천해줘`,
					'최신성/시간 의도',
				),
			];
	}
}

function buildPrescriptionTips(engineId: AIEngineId, lang: GuideLang): string[] {
	const ranked = getEngineKeyActions(engineId, lang).map((action) => action.text);
	const extras = EXTRA_TIPS[engineId][lang];
	const out: string[] = [];
	for (const tip of [...ranked, ...extras]) {
		if (!out.includes(tip)) out.push(tip);
	}
	return out.slice(0, 5);
}

export function buildEngineOptimizationGuide(
	input: BuildEngineOptimizationGuideInput,
): EngineOptimizationGuide {
	const lang: GuideLang = input.lang === 'en' ? 'en' : 'ko';
	const engineId = input.engineId;
	const entity = resolveEntity(input);
	const location = normalize(input.location);
	const needs = (input.needSignals || []).map(normalize).filter(Boolean);
	const level3OptimizedQuery = buildLevel3OptimizedQuery(engineId, lang, location, entity, needs);
	const combos = buildKeywordCombos(engineId, lang, location, entity, level3OptimizedQuery, needs).filter(
		(row) => !containsBrand(row.query, input.brandName || ''),
	);

	return {
		engineName: ENGINE_NAME[engineId],
		engineId,
		currentLevel: input.currentLevel,
		targetLevel: 3,
		level3OptimizedQuery,
		level3KeywordCombos: combos,
		prescriptionTips: buildPrescriptionTips(engineId, lang),
		engineCharacteristics: CHARACTERISTICS[engineId][lang],
		queryPattern: queryPatternFor(engineId),
	};
}
