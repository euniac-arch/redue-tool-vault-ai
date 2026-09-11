export type GuideAiEngineId =
	| 'chatgpt'
	| 'gemini'
	| 'perplexity'
	| 'claude'
	| 'copilot'
	| 'navercue';

export type GuideAiEngineStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

export type ChannelBadgeType = 'amber' | 'green' | 'blue';

export interface SubScores {
	/** 전문성 (0~100) */
	specialty: number;
	/** 지역성 (0~100) */
	localPresence: number;
	/** 신뢰도 (0~100) */
	authority: number;
	/** 차별성 (0~100) */
	uniqueness: number;
	/** 인지도 (0~100) */
	awareness: number;
}

export interface ChannelStatusItem {
	statusBadge: string;
	badgeType: ChannelBadgeType;
	description: string;
}

export interface ChannelStatusBriefing {
	/** 생성형 AI 검색 (GEO) */
	aiSearch: ChannelStatusItem;
	/** 구글 검색 & GBP */
	googleSearch: ChannelStatusItem;
	/** 네이버 스마트플레이스 */
	naverPlace: ChannelStatusItem;
}

export interface AiEngineDiagnosis {
	engine: GuideAiEngineId;
	engineName: string;
	/** 예: "웹 인덱싱 & 지식 베이스 검색" */
	category: string;
	status: GuideAiEngineStatus;
	/** 예: "신호 약화 주의", "응답 누락 주의" */
	statusText: string;
	/** 실측 기반 감지된 원인 */
	detectedCause: string;
	/** 실행 조치 항목 리스트 */
	actionItems: string[];
}

export interface GuideSocialLinks {
	youtube?: string;
	instagram?: string;
	facebook?: string;
	blog?: string;
	website?: string;
}

export interface GuideFaq {
	question: string;
	answer: string;
}

/** Channel NAP consistency vs the official homepage baseline. */
export type NapConsistencyStatus = 'MATCH' | 'WARNING' | 'MISMATCH' | 'NOT_FOUND' | 'UNAVAILABLE';

export type NapChannelId =
	| 'homepage'
	| 'naver_place'
	| 'google_business'
	| 'youtube'
	| 'sns'
	| 'bing_places'
	| 'kakao_tmap';

export interface NapChannelCollected {
	name?: string;
	address?: string;
	phone?: string;
	/** True when the channel exists (or is expected) but live NAP could not be scraped/API-fetched. */
	blocked?: boolean;
	blockReason?: string;
}

export interface NapChannelRow {
	channelId: NapChannelId;
	channelLabel: string;
	collectedName: string;
	collectedAddress: string;
	collectedPhone: string;
	status: NapConsistencyStatus;
	/** Human-readable gap note (spacing, unit number, missing listing, …). */
	discrepancyNote?: string;
	/** Official homepage — sort first and highlight. */
	isCanonical?: boolean;
}

export interface NapRecommendation {
	channelId: NapChannelId;
	channelLabel: string;
	prescription: string;
}

export interface NapStandard {
	name: string;
	address: string;
	phone: string;
}

/** Wire format returned by Gemini/OpenAI diagnosis JSON. */
export interface LlmNapChannel {
	channelName: string;
	targetName: string;
	targetAddress: string;
	targetPhone: string;
	status: NapConsistencyStatus | string;
	discrepancyNote?: string;
}

export interface LlmNapMatrix {
	standard: NapStandard;
	channels: LlmNapChannel[];
	consistencyScore?: number;
}

export interface NapMatrix {
	/** Official homepage NAP used as the comparison baseline. */
	canonical: NapStandard;
	/** Alias kept so LLM `standard` payloads round-trip. */
	standard?: NapStandard;
	rows: NapChannelRow[];
	recommendations: NapRecommendation[];
	consistencyScore?: number;
	/** Optional LLM channel list (normalized after parse). */
	channels?: LlmNapChannel[];
}

export interface GuideData {
	id: string;
	/** URL용 영문 식별자 (예: nineone) */
	slug: string;
	brandName: string;
	brandNameEng: string;
	industry: string;
	region: string;
	address: string;
	/** 대표 전화번호. 진단 사이트에 없으면 빈 문자열 */
	telephone?: string;
	/** 주력 장비 및 특장점 */
	coreFeatures: string[];
	/** 대표 타깃 키워드 5종 */
	keywords: string[];

	/** 진단 실측 SEO 점수 (예: 125, 만점 125) */
	observedSeoScore: number;
	/** 실측 SEO 만점. 미지정 시 125 */
	seoMaxScore?: number;
	/** AI TRUST (만점 100) */
	aiTrustScore: number;
	/** AI 추천 잠재력 (만점 100) */
	aiPotentialScore: number;
	subScores: SubScores;
	channelBriefing: ChannelStatusBriefing;

	socialLinks: GuideSocialLinks;
	faq: GuideFaq;
	/** 6대 AI 엔진별 분석 결과 */
	aiEngineDiagnoses: AiEngineDiagnosis[];
	/** Channel NAP matrix from the latest diagnosis. Absent on legacy guides. */
	napMatrix?: NapMatrix;
	createdAt: string;
}
