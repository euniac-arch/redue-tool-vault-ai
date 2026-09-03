/**
 * 6대 AI 엔진 병목 원인 동적 분석기.
 * 크롤링 실측(robots, 스키마, 좌표, 본문, sameAs) + 선택적 LLM 질의 결과를
 * 엔진별 상태 / 원인 / 조치로 변환한다.
 */
import { detectEnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { joinKoreanAnd, withJosa } from '@/lib/utils/korean';
import { extractSignalsFromReport } from '@/lib/audit/geo-score';
import { BOT_ALIASES, isRootDisallowed, parseRobotsGroups } from '@/lib/audit/robots-ai-bots';
import type { AuditReport } from '@/lib/site-auditor';
import type { AiCrawlerBotId } from '@/types/geo-diagnostic';
import type {
	AiEngineDiagnosis,
	ChannelStatusBriefing,
	ChannelStatusItem,
	GuideAiEngineId,
	GuideAiEngineStatus,
	SubScores,
} from '@/types/guide';
import type { LiveEngineCheckResult, MentionType } from '@/types/live-engine-check';

export interface SiteAuditResult {
	url?: string;
	brandName?: string;
	brandNameEng?: string;
	address?: string;
	industry?: string;
	coreFeatures?: string[];
	robotsTxt?: string;
	aiBotAccess?: Partial<Record<'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended', boolean>>;
	hasLlmsTxt?: boolean;
	hasSitemap?: boolean;
	schemaTypes?: string[];
	jsonLdCorpus?: string;
	sameAs?: string[];
	collectedUrls?: string[];
	footerText?: string;
	schemaGeo?: { latitude: number; longitude: number };
	mapGeo?: { latitude: number; longitude: number };
	hasYoutubeCaptions?: boolean;
	youtubeUrl?: string;
	bodyLength?: number;
	hasFaq?: boolean;
	hasHowTo?: boolean;
	hasArticle?: boolean;
	hasMedicalCausalText?: boolean;
	bingPlacesLinked?: boolean;
	googleMapsLinked?: boolean;
	hasGeoCoordinates?: boolean;
	hasLocalBusiness?: boolean;
	napNameKo?: string;
	napNameEn?: string;
	napAddress?: string;
	schemaCoverage?: number;
	geoCitationScore?: number;
	isHttps?: boolean;
	naverPlaceLinked?: boolean;
	naverBlogLinked?: boolean;
	naverPlaceMenuCount?: number;
	naverKinExpertSignal?: boolean;
	lastIndexedAt?: string;
	coreFeatureCount?: number;
	/** 실측 SEO 원점수 (예: 125) */
	seoScore?: number;
	seoMaxScore?: number;
	aiTrustScore?: number;
	aiPotentialScore?: number;
	subScores?: Partial<SubScores>;
	indexAllowed?: boolean;
}

export interface AiRecognitionResult {
	engine: GuideAiEngineId | 'clova' | string;
	isCited?: boolean;
	mentionType?: MentionType;
	evidenceSnippet?: string;
	citedSources?: string[];
	liveScore?: number;
	weaknessReasons?: string[];
}

type EngineMeta = {
	engine: GuideAiEngineId;
	engineName: string;
	category: string;
};

export const GUIDE_AI_ENGINE_META: readonly EngineMeta[] = [
	{ engine: 'chatgpt', engineName: 'ChatGPT / SearchGPT', category: '웹 인덱싱 & 지식 베이스 검색' },
	{ engine: 'gemini', engineName: 'Google Gemini', category: '멀티모달 · Knowledge Graph · 유튜브' },
	{ engine: 'perplexity', engineName: 'Perplexity', category: '실시간 웹 크롤 · 인용 기반 답변' },
	{ engine: 'claude', engineName: 'Claude', category: '장문 추론 · 의학적 인과관계 텍스트' },
	{ engine: 'copilot', engineName: 'Microsoft Copilot', category: 'Bing Places · 영문/국문 NAP 동기화' },
	{ engine: 'navercue', engineName: 'Naver Cue', category: '스마트플레이스 · 지식iN 전문가 시그널' },
] as const;

const CAUSAL_RE =
	/때문에|원리|기전|메커니즘|적응증|인과|효과적으로|치료 원리|작용 기전|because|mechanism|indication|how it works/i;
const KIN_RE = /kin\.naver\.com|지식in|지식iN|지식인/i;
const YOUTUBE_CAPTION_RE = /caption|transcript|자막|\.srt|closed.?caption/i;

function recognitionFor(
	rows: AiRecognitionResult[] | undefined,
	engine: GuideAiEngineId,
): AiRecognitionResult | undefined {
	if (!rows?.length) return undefined;
	const aliases = engine === 'navercue' ? ['navercue', 'clova'] : [engine];
	return rows.find((row) => aliases.includes(String(row.engine || '').toLowerCase()));
}

function parseCoord(raw: string | number | undefined | null): number | null {
	if (raw == null || raw === '') return null;
	const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
	return Number.isFinite(n) ? n : null;
}

function parseJsonLdCoords(corpus: string): { latitude: number; longitude: number } | null {
	const lat = corpus.match(/"latitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i);
	const lng = corpus.match(/"longitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i);
	if (!lat || !lng) return null;
	const latitude = Number(lat[1]);
	const longitude = Number(lng[1]);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	return { latitude, longitude };
}

function haversineMeters(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number },
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const r = 6371000;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const lat1 = toRad(a.latitude);
	const lat2 = toRad(b.latitude);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

const OPTIMAL_CAUSE =
	'해당 엔진에 필요한 모든 필수 온/오프페이지 신호가 정상적으로 식별되고 있습니다.';
const OPTIMAL_ACTION = '현재의 일관된 데이터 상태를 유지하세요.';

const CITATION_SOURCE_RE =
	/news|보도|press[-_]?release|newswire|yonhap|yna\.co|news1|mk\.co\.kr|chosun|joongang|hani\.co|hankyung|sedaily|edaily|heraldcorp|fnnews|mt\.co\.kr|donga\.com/i;

type BottleneckPair = { cause: string; action: string };

function decideStatus(defectCount: number): GuideAiEngineStatus {
	if (defectCount <= 0) return 'OPTIMAL';
	if (defectCount >= 2) return 'CRITICAL';
	return 'WARNING';
}

function statusTextFor(engine: GuideAiEngineId, status: GuideAiEngineStatus): string {
	if (status === 'OPTIMAL') return '신호 최적화 완료';
	if (status === 'CRITICAL') {
		if (engine === 'chatgpt' || engine === 'perplexity') return '응답 누락 주의';
		if (engine === 'navercue') return '로컬 엔티티 미연결';
		return '핵심 신호 누락';
	}
	if (engine === 'gemini') return '멀티모달 신호 약화 주의';
	if (engine === 'copilot') return 'Bing 엔티티 동기화 주의';
	return '신호 약화 주의';
}

function finalizeEngineDiagnosis(meta: EngineMeta, bottlenecks: BottleneckPair[]): AiEngineDiagnosis {
	if (bottlenecks.length === 0) {
		return {
			...meta,
			status: 'OPTIMAL',
			statusText: '신호 최적화 완료',
			detectedCause: OPTIMAL_CAUSE,
			actionItems: [OPTIMAL_ACTION],
		};
	}
	const status = decideStatus(bottlenecks.length);
	return {
		...meta,
		status,
		statusText: statusTextFor(meta.engine, status),
		detectedCause: bottlenecks.map((row) => row.cause).join('\n'),
		actionItems: bottlenecks.map((row) => row.action),
	};
}

/** ChatGPT/SearchGPT 계열 크롤러의 모든 알려진 User-agent 별칭. */
const CHATGPT_BOT_USER_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User'] as const;

/**
 * 특정 크롤러(들)의 robots.txt 허용 여부를 다양한 데이터 형태에서 동적으로 판정한다.
 * 브랜드·업종을 가정하지 않는 순수 범용 헬퍼이며, 어떤 `SiteAuditResult`가
 * 들어와도(웹사이트가 병원이든 호텔이든) `targetBots`만으로 판별한다.
 *
 * 1) 구조화된 실측 맵(`audit.aiBotAccess`) — 대부분의 저장된 진단 이력은 원문
 *    robots.txt 텍스트를 보관하지 않고, 스캔 시점에 계산된 이 불리언 맵만 남는다.
 *    이 신호를 확인하지 않으면 실제로 Allow가 선언된 사이트도 항상 "미선언"으로
 *    오판된다.
 * 2) 원문 robots.txt 텍스트(`audit.robotsTxt`) — 있으면 User-agent 그룹 단위로
 *    명시적 Allow 선언까지 정밀하게 검증한다(가장 신뢰도 높은 신호).
 */
export function checkBotAllowed(audit: SiteAuditResult, targetBots: readonly string[]): boolean {
	const wanted = new Set(targetBots.map((bot) => bot.toLowerCase()));

	if (audit.aiBotAccess) {
		for (const [botId, aliases] of Object.entries(BOT_ALIASES) as Array<[AiCrawlerBotId, readonly string[]]>) {
			const mentioned = aliases.some((alias) => wanted.has(alias));
			if (mentioned && audit.aiBotAccess[botId] === true) return true;
		}
	}

	const robots = (audit.robotsTxt || '').trim();
	if (!robots) return false;
	for (const group of parseRobotsGroups(robots)) {
		const mentionsTarget = group.agents.some((agent) => wanted.has(agent));
		if (!mentionsTarget) continue;
		const hasAllow = group.rules.some(
			(rule) => rule.allow && (rule.path === '/' || rule.path === '/*' || rule.path === ''),
		);
		if (hasAllow && !isRootDisallowed(group.rules)) return true;
	}
	return false;
}

function hasCitationSignals(audit: SiteAuditResult, live?: AiRecognitionResult): boolean {
	if (live?.isCited === true || live?.mentionType === 'recommended') return true;
	const corpus = [...(audit.sameAs || []), ...(audit.collectedUrls || [])].join('\n');
	return CITATION_SOURCE_RE.test(corpus);
}

type SchemaGeoMatch = {
	/** 스키마(JSON-LD)에 위경도 자체가 없음 — "미등록". */
	hasSchemaGeo: boolean;
	/** 대조 가능한 GBP/지도 좌표가 있음. */
	hasMapGeo: boolean;
	/** 두 좌표 모두 존재하고 오차 범위(≤80m) 이내로 일치함. */
	matched: boolean;
};

/**
 * LocalBusiness JSON-LD 좌표와 GBP/지도 앵커 좌표의 일치 여부를 판정한다.
 * 특정 업체명·좌표를 가정하지 않는 순수 동적 계산이며, 어떤 `SiteAuditResult`가
 * 들어와도(서울 병원이든 부산 호텔이든) 해당 값만으로 오차를 계산한다.
 * 값은 문자열/숫자가 섞여 들어올 수 있으므로 `parseCoord`로 안전 파싱한다.
 */
function resolveSchemaGeoMatch(audit: SiteAuditResult): SchemaGeoMatch {
	const schemaLat = parseCoord(audit.schemaGeo?.latitude);
	const schemaLng = parseCoord(audit.schemaGeo?.longitude);
	const mapLat = parseCoord(audit.mapGeo?.latitude);
	const mapLng = parseCoord(audit.mapGeo?.longitude);
	const hasSchemaGeo = schemaLat != null && schemaLng != null;
	const hasMapGeo = mapLat != null && mapLng != null;
	const matched =
		hasSchemaGeo &&
		hasMapGeo &&
		haversineMeters({ latitude: schemaLat!, longitude: schemaLng! }, { latitude: mapLat!, longitude: mapLng! }) <=
			80;
	return { hasSchemaGeo, hasMapGeo, matched };
}

function hasRecentIndexedDoc(audit: SiteAuditResult): boolean {
	if (!audit.hasSitemap || !audit.lastIndexedAt) return false;
	const stamped = new Date(audit.lastIndexedAt).getTime();
	if (!Number.isFinite(stamped)) return false;
	return Date.now() - stamped <= 1000 * 60 * 60 * 24 * 60;
}

function hasPhysicianSchema(audit: SiteAuditResult): boolean {
	const types = (audit.schemaTypes || []).join(' ');
	const corpus = audit.jsonLdCorpus || '';
	return /Physician|Person/i.test(types) || /"@type"\s*:\s*"(Physician|Person)"/i.test(corpus);
}

function hasEnglishBrandSync(audit: SiteAuditResult): boolean {
	return Boolean(
		(audit.napNameKo || '').trim() && (audit.napNameEn || '').trim() && (audit.napAddress || '').trim(),
	);
}

function evaluateChatGpt(audit: SiteAuditResult, live?: AiRecognitionResult): AiEngineDiagnosis {
	const bottlenecks: BottleneckPair[] = [];
	if (!checkBotAllowed(audit, CHATGPT_BOT_USER_AGENTS)) {
		bottlenecks.push({
			cause: 'robots.txt에 GPTBot/OAI-SearchBot이 명시적으로 Allow 선언되지 않음',
			action: 'robots.txt에 User-agent: GPTBot, OAI-SearchBot 명시 및 Allow: / 선언',
		});
	}
	if (!audit.hasLlmsTxt) {
		bottlenecks.push({
			cause: '루트에 /llms.txt 팩트 인덱스 파일 부재',
			action: '/llms.txt 배포하여 상호·위치·핵심서비스 고정',
		});
	}
	if (!audit.bingPlacesLinked) {
		bottlenecks.push({
			cause: 'Bing Places 미연동: OpenAI 실시간 검색(SearchGPT) 기반인 Bing 로컬 인덱스에 공식 NAP 부재',
			action: 'bingplaces.com에서 사업장/브랜드 등록 및 로컬 비즈니스 프로필 동기화',
		});
	}
	if (!hasCitationSignals(audit, live)) {
		bottlenecks.push({
			cause: '공식 보도자료 및 신뢰 웹사이트 인용(Citation) 신호 부재',
			action: '포털 뉴스 제휴 보도자료 배포를 통한 3rd-party 인용 확보',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[0], bottlenecks);
}

function evaluateGemini(audit: SiteAuditResult): AiEngineDiagnosis {
	const bottlenecks: BottleneckPair[] = [];
	const geoMatch = resolveSchemaGeoMatch(audit);
	if (!geoMatch.matched) {
		if (!geoMatch.hasSchemaGeo) {
			bottlenecks.push({
				cause: 'JSON-LD 스키마 내 위도/경도(GeoCoordinates) 좌표 미등록',
				action: 'LocalBusiness 스키마에 사업장의 정확한 latitude/longitude 좌표 선언',
			});
		} else {
			bottlenecks.push({
				cause: 'LocalBusiness 스키마 좌표가 GBP 지도 좌표와 불일치함',
				action: 'JSON-LD 스키마의 latitude/longitude를 Google 비즈니스 프로필 지도 핀과 80m 이내로 일치',
			});
		}
	}
	if (audit.hasYoutubeCaptions !== true) {
		bottlenecks.push({
			cause: '유튜브 영상에 수동 검수된 한글 자막(.srt/CC) 미등록',
			action: '유튜브 스튜디오에서 의학/서비스 키워드가 포함된 자막 파일 직접 업로드',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[1], bottlenecks);
}

function evaluatePerplexity(audit: SiteAuditResult): AiEngineDiagnosis {
	const bottlenecks: BottleneckPair[] = [];
	if (!hasRecentIndexedDoc(audit)) {
		bottlenecks.push({
			cause: '최근 60일 이내에 업데이트된 웹 문서 및 sitemap 갱신 신호 부족',
			action: 'lastmod가 포함된 sitemap.xml 제출 및 신규 정보성 칼럼 발행',
		});
	}
	if (!audit.hasFaq) {
		bottlenecks.push({
			cause: '직접 인용을 유도하는 FAQPage 구조화 데이터 미적용',
			action: 'FAQPage JSON-LD 스키마 구축',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[2], bottlenecks);
}

function evaluateClaude(audit: SiteAuditResult): AiEngineDiagnosis {
	const bottlenecks: BottleneckPair[] = [];
	const hasDeepMedicalReasoning =
		(audit.bodyLength || 0) >= 1200 && audit.hasMedicalCausalText === true;
	if (!hasDeepMedicalReasoning) {
		bottlenecks.push({
			cause: '원리 및 인과관계를 설명하는 1,200자 이상의 심층 콘텐츠 부족',
			action: '주력 서비스별 메커니즘과 치료 적응증을 설명하는 텍스트 칼럼 발행',
		});
	}
	if (!hasPhysicianSchema(audit)) {
		bottlenecks.push({
			cause: '책임 의료진/전문가 Person/Physician 스키마 연결 부재',
			action: '의료진 약력 및 전문분야 Person 스키마 선언',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[3], bottlenecks);
}

function evaluateCopilot(audit: SiteAuditResult): AiEngineDiagnosis {
	const bottlenecks: BottleneckPair[] = [];
	if (!audit.bingPlacesLinked) {
		bottlenecks.push({
			cause: 'Bing Places for Business 사업장 미등록 또는 동기화 누락',
			action: 'bingplaces.com에서 GBP 데이터 가져오기 및 등록 완료',
		});
	}
	if (!hasEnglishBrandSync(audit)) {
		bottlenecks.push({
			cause: '국문 상호와 영문 상호의 멀티 플랫폼 표기 불일치',
			action: '국문/영문 상호명 및 도로명 주소를 모든 검색 플랫폼에 100% 동일 표기',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[4], bottlenecks);
}

function evaluateNaverCue(audit: SiteAuditResult): AiEngineDiagnosis {
	const menuItemCount = audit.naverPlaceMenuCount ?? 0;
	const bottlenecks: BottleneckPair[] = [];
	if (menuItemCount < 3) {
		bottlenecks.push({
			cause: `플레이스 내 세부 메뉴/서비스가 ${menuItemCount}개로 등록 부족 (최소 3개 권장)`,
			action: '스마트플레이스에 주력 시술/서비스 메뉴 3개 이상 상세 등록',
		});
	}
	if (audit.naverKinExpertSignal !== true) {
		bottlenecks.push({
			cause: '네이버 지식iN 전문가/하이닥 제휴 답변 신호 부재',
			action: '지식iN 전문가 답변 활동을 통한 네이버 AI Q&A 영역 선점',
		});
	}
	return finalizeEngineDiagnosis(GUIDE_AI_ENGINE_META[5], bottlenecks);
}

export function evaluateAiBottlenecks(
	audit: SiteAuditResult,
	recognition?: AiRecognitionResult[],
): AiEngineDiagnosis[] {
	return [
		evaluateChatGpt(audit, recognitionFor(recognition, 'chatgpt')),
		evaluateGemini(audit),
		evaluatePerplexity(audit),
		evaluateClaude(audit),
		evaluateCopilot(audit),
		evaluateNaverCue(audit),
	];
}

export function liveResultsToRecognition(results: LiveEngineCheckResult[] | undefined): AiRecognitionResult[] {
	if (!results?.length) return [];
	return results.map((row) => ({
		engine: row.engine === 'clova' ? 'navercue' : row.engine,
		isCited: row.isCited,
		mentionType: row.mentionType,
		evidenceSnippet: row.evidenceSnippet,
		citedSources: row.citedSources,
		liveScore: row.liveScore,
		weaknessReasons: row.weaknessReasons,
	}));
}

export function siteAuditFromReport(report: AuditReport): SiteAuditResult {
	const signals = extractSignalsFromReport(report);
	const jsonLd = signals.jsonLdCorpus || '';
	const extra = [...(signals.sameAs || []), ...(signals.collectedUrls || []), signals.footerText || ''].join('\n');
	const platform = detectEnginePlatformSignals({
		schemaTypes: signals.schemaTypes,
		jsonLdCorpus: jsonLd,
		extraCorpus: extra,
		sameAs: signals.sameAs,
	});
	const schemaGeo = parseJsonLdCoords(jsonLd);
	const metaGeoLat = parseCoord(report.siteMeta?.geo?.latitude);
	const metaGeoLng = parseCoord(report.siteMeta?.geo?.longitude);
	/**
	 * `siteMeta.geo.source`는 'map' | 'jsonld' | 'locality' | 'default' 중 하나다.
	 * 예전에는 'map'(카카오/네이버/구글 지도 스크립트에서 직접 파싱)만 GBP 앵커로
	 * 인정했는데, 실제로는 지도 스크립트 정규식이 못 잡아도 JSON-LD 좌표가 그대로
	 * 실측 지도 좌표와 100% 일치하는 사이트가 많아 항상 "좌표 불일치"로 오판했다.
	 * 'default'(서초 임시 중심좌표 폴백)만 신뢰 불가로 배제하고, 나머지 소스는
	 * 실측/지오코딩된 좌표이므로 스키마 좌표 대조 기준으로 사용한다.
	 */
	const metaGeoSource = report.siteMeta?.geo?.source;
	const mapGeo =
		metaGeoLat != null && metaGeoLng != null && metaGeoSource !== 'default'
			? { latitude: metaGeoLat, longitude: metaGeoLng }
			: null;
	const youtube =
		(signals.sameAs || []).find((url) => /youtube\.com|youtu\.be/i.test(url)) ||
		(signals.collectedUrls || []).find((url) => /youtube\.com|youtu\.be/i.test(url));
	const corpus = `${jsonLd}\n${extra}\n${report.siteMeta?.metaDescription || ''}`;
	const kin = KIN_RE.test(corpus);
	const captions = YOUTUBE_CAPTION_RE.test(corpus);
	const menuCount =
		report.siteMeta?.coreSpecialties?.length ||
		report.siteMeta?.schemaKnowsAbout?.filter(Boolean).length ||
		0;

	return {
		url: report.url,
		brandName: report.siteMeta?.brandName || signals.brandName,
		brandNameEng: [report.siteMeta?.organizationName, report.siteMeta?.ogSiteName].find(
			(name) => name && /[a-z]/i.test(name) && !/[가-힣]/.test(name),
		),
		address: report.siteMeta?.address,
		industry: report.siteMeta?.category,
		aiBotAccess: report.metrics?.aiBotAccess,
		hasLlmsTxt: signals.hasLlmsTxt,
		hasSitemap: report.metrics?.hasSitemap ?? Boolean(report.sitemap),
		schemaTypes: signals.schemaTypes,
		jsonLdCorpus: jsonLd,
		sameAs: signals.sameAs,
		collectedUrls: signals.collectedUrls,
		footerText: signals.footerText,
		schemaGeo: schemaGeo || undefined,
		mapGeo: mapGeo || undefined,
		hasYoutubeCaptions: captions || undefined,
		youtubeUrl: youtube,
		bodyLength: signals.bodyLength,
		hasFaq: platform.hasFaq || signals.faqPresent,
		hasHowTo: platform.hasHowTo,
		hasArticle: platform.hasArticle || platform.hasNewsArticle,
		hasMedicalCausalText: CAUSAL_RE.test(corpus),
		bingPlacesLinked: platform.bingPlacesLinked,
		googleMapsLinked: platform.googleMapsLinked,
		hasGeoCoordinates: platform.hasGeoCoordinates || Boolean(schemaGeo),
		hasLocalBusiness: platform.hasLocalBusiness,
		napNameKo: report.siteMeta?.brandName || report.siteMeta?.organizationName,
		napNameEn: [report.siteMeta?.organizationName, report.siteMeta?.ogSiteName].find(
			(name) => name && /[a-z]/i.test(name),
		),
		napAddress: report.siteMeta?.address,
		schemaCoverage: report.schemaCoverage,
		geoCitationScore: report.geoCitationScore,
		isHttps: signals.isHttps,
		seoScore: Number.isFinite(report.score) ? report.score : undefined,
		seoMaxScore: Number.isFinite(report.maxScore) ? report.maxScore : undefined,
		indexAllowed: report.indexStatus?.allowed,
		naverPlaceLinked: platform.naverPlaceLinked,
		naverBlogLinked: platform.naverBlogLinked,
		naverPlaceMenuCount: menuCount,
		naverKinExpertSignal: kin,
		lastIndexedAt: report.fetchedAt,
		coreFeatureCount: menuCount,
	};
}

function isLiveEngineRow(row: AiRecognitionResult | LiveEngineCheckResult): row is LiveEngineCheckResult {
	return 'reachLevel' in row && 'isLiveGrounded' in row;
}

export function evaluateAiBottlenecksFromReport(
	report: AuditReport,
	recognition?: Array<AiRecognitionResult | LiveEngineCheckResult>,
): AiEngineDiagnosis[] {
	if (!recognition?.length) {
		return evaluateAiBottlenecks(siteAuditFromReport(report));
	}
	const mapped = recognition.map((row) =>
		isLiveEngineRow(row)
			? liveResultsToRecognition([row])[0]
			: row,
	);
	return evaluateAiBottlenecks(siteAuditFromReport(report), mapped);
}

export function emptyAiEngineDiagnoses(): AiEngineDiagnosis[] {
	return GUIDE_AI_ENGINE_META.map((meta) => ({
		...meta,
		status: 'WARNING' as const,
		statusText: '진단 대기',
		detectedCause: '최근 사이트 진단을 불러오면 실측 원인과 조치가 자동 생성됩니다.',
		actionItems: ['스튜디오에서 대상 사이트를 진단한 뒤 [최근 진단 데이터 불러오기]를 클릭하세요.'],
	}));
}

export const GUIDE_SEO_MAX_DEFAULT = 125;

export interface GuideScoreAnalysis {
	observedSeoScore: number;
	seoMaxScore: number;
	aiTrustScore: number;
	aiPotentialScore: number;
	subScores: SubScores;
	channelBriefing: ChannelStatusBriefing;
	aiEngineDiagnoses: AiEngineDiagnosis[];
}

function clampScore(n: number, max = 100): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(max, Math.max(0, Math.round(n)));
}

export function emptySubScores(): SubScores {
	return { specialty: 0, localPresence: 0, authority: 0, uniqueness: 0, awareness: 0 };
}

export function emptyChannelBriefing(): ChannelStatusBriefing {
	return {
		aiSearch: {
			statusBadge: '진단 대기',
			badgeType: 'amber',
			description:
				'최근 사이트 진단을 불러오면 ChatGPT·Gemini·Perplexity 등 생성형 AI 검색 채널의 현주소가 자동으로 작성됩니다.',
		},
		googleSearch: {
			statusBadge: '진단 대기',
			badgeType: 'blue',
			description:
				'온페이지 SEO 실측과 GBP·스키마·유튜브 자막 신호를 불러오면 구글 검색 채널 브리핑이 채워집니다.',
		},
		naverPlace: {
			statusBadge: '진단 대기',
			badgeType: 'green',
			description:
				'스마트플레이스·블로그·지식iN 신호가 확인되면 네이버 채널 현주소가 자동 생성됩니다.',
		},
	};
}

/** Presentable placeholder KPIs before any diagnosis is loaded — see lib/guide/types.ts. */
const GUIDE_OBSERVED_SEO_PLACEHOLDER = 125;
const GUIDE_AI_TRUST_PLACEHOLDER = 85;
const GUIDE_AI_POTENTIAL_PLACEHOLDER = 80;

export function emptyGuideScoreAnalysis(): GuideScoreAnalysis {
	return {
		observedSeoScore: GUIDE_OBSERVED_SEO_PLACEHOLDER,
		seoMaxScore: GUIDE_SEO_MAX_DEFAULT,
		aiTrustScore: GUIDE_AI_TRUST_PLACEHOLDER,
		aiPotentialScore: GUIDE_AI_POTENTIAL_PLACEHOLDER,
		subScores: {
			specialty: GUIDE_AI_TRUST_PLACEHOLDER,
			localPresence: GUIDE_AI_TRUST_PLACEHOLDER,
			authority: GUIDE_AI_TRUST_PLACEHOLDER,
			uniqueness: GUIDE_AI_TRUST_PLACEHOLDER,
			awareness: GUIDE_AI_TRUST_PLACEHOLDER,
		},
		channelBriefing: emptyChannelBriefing(),
		aiEngineDiagnoses: emptyAiEngineDiagnoses(),
	};
}

function citedCount(rows: AiRecognitionResult[] | undefined): { cited: number; mentioned: number; probed: number } {
	if (!rows?.length) return { cited: 0, mentioned: 0, probed: 0 };
	let cited = 0;
	let mentioned = 0;
	for (const row of rows) {
		if (row.isCited === true || row.mentionType === 'recommended') cited += 1;
		else if (row.mentionType === 'simple_mention') mentioned += 1;
	}
	return { cited, mentioned, probed: rows.length };
}

export function deriveGuideScores(
	audit: SiteAuditResult,
	diagnoses: AiEngineDiagnosis[],
	recognition?: AiRecognitionResult[],
): Omit<GuideScoreAnalysis, 'channelBriefing' | 'aiEngineDiagnoses'> {
	const seoMax = clampScore(audit.seoMaxScore ?? GUIDE_SEO_MAX_DEFAULT, 200) || GUIDE_SEO_MAX_DEFAULT;
	const observed =
		audit.seoScore != null && Number.isFinite(audit.seoScore)
			? Math.round(audit.seoScore)
			: clampScore(((audit.schemaCoverage ?? 0) / 100) * seoMax, seoMax);

	const { cited, mentioned, probed } = citedCount(recognition);
	const optimal = diagnoses.filter((row) => row.status === 'OPTIMAL').length;
	const critical = diagnoses.filter((row) => row.status === 'CRITICAL').length;
	const warning = diagnoses.filter((row) => row.status === 'WARNING').length;

	const derivedTrust = clampScore(
		(audit.schemaCoverage ?? 40) * 0.35 +
			(audit.geoCitationScore ?? 40) * 0.35 +
			cited * 10 +
			mentioned * 5 +
			optimal * 6 +
			(audit.hasLocalBusiness ? 8 : 0) +
			(audit.hasFaq ? 6 : 0) +
			(audit.hasLlmsTxt ? 5 : 0) -
			critical * 8,
	);

	const aiTrust = clampScore(audit.aiTrustScore ?? derivedTrust);
	const derivedPotential = clampScore(
		aiTrust +
			(audit.coreFeatureCount ?? 0) * 3 +
			(audit.hasYoutubeCaptions ? 8 : 0) +
			(audit.hasMedicalCausalText ? 6 : 0) +
			(audit.hasSitemap ? 4 : 0) -
			critical * 5 -
			warning * 2,
	);
	const aiPotential = clampScore(audit.aiPotentialScore ?? derivedPotential);

	const sameAsCount = audit.sameAs?.length ?? 0;
	const bodyBonus = Math.min(25, Math.round((audit.bodyLength || 0) / 80));

	const subScores: SubScores = {
		specialty: clampScore(
			audit.subScores?.specialty ??
				(audit.hasMedicalCausalText ? 28 : 10) +
					(audit.hasArticle ? 18 : 0) +
					(audit.hasFaq ? 14 : 0) +
					bodyBonus +
					(audit.coreFeatureCount ?? 0) * 5,
		),
		localPresence: clampScore(
			audit.subScores?.localPresence ??
				(audit.hasGeoCoordinates ? 22 : 0) +
					(audit.hasLocalBusiness ? 20 : 0) +
					(audit.googleMapsLinked ? 18 : 0) +
					(audit.naverPlaceLinked ? 18 : 0) +
					(audit.napAddress ? 14 : 0) +
					(audit.bingPlacesLinked ? 8 : 0),
		),
		authority: clampScore(
			audit.subScores?.authority ??
				(audit.hasLlmsTxt ? 12 : 0) +
					(audit.schemaCoverage ?? 40) * 0.4 +
					(audit.isHttps !== false ? 12 : 0) +
					cited * 10 +
					(probed ? 8 : 0) +
					(audit.hasFaq ? 8 : 0),
		),
		uniqueness: clampScore(
			audit.subScores?.uniqueness ??
				(audit.coreFeatureCount ?? 0) * 12 +
					(audit.hasMedicalCausalText ? 18 : 8) +
					(audit.hasHowTo ? 12 : 0) +
					Math.min(20, Math.round((audit.bodyLength || 0) / 100)) +
					(audit.hasArticle ? 10 : 0),
		),
		awareness: clampScore(
			audit.subScores?.awareness ??
				sameAsCount * 10 +
					(audit.youtubeUrl ? 14 : 0) +
					(audit.naverBlogLinked ? 14 : 0) +
					mentioned * 8 +
					cited * 12 +
					(audit.naverPlaceLinked ? 10 : 0),
		),
	};

	return {
		observedSeoScore: clampScore(observed, seoMax),
		seoMaxScore: seoMax,
		aiTrustScore: aiTrust,
		aiPotentialScore: aiPotential,
		subScores,
	};
}

function featurePhrase(audit: SiteAuditResult): string {
	const named = (audit.coreFeatures || []).map((item) => item.trim()).filter(Boolean).slice(0, 2).join('·');
	if (named) return named;
	if ((audit.coreFeatureCount || 0) >= 2) return '주력 장비·시술';
	return '핵심 서비스';
}

function buildAiChannelBriefing(
	audit: SiteAuditResult,
	diagnoses: AiEngineDiagnosis[],
	recognition?: AiRecognitionResult[],
): ChannelStatusItem {
	const { cited, mentioned, probed } = citedCount(recognition);
	const critical = diagnoses.filter((row) => row.status === 'CRITICAL').length;
	const brand = (audit.brandName || '해당 브랜드').trim();
	const features = featurePhrase(audit);

	if (cited >= 2 && critical === 0) {
		return {
			statusBadge: '인용 진입',
			badgeType: 'green',
			description: `${withJosa(brand, '이/가')} 복수 AI 엔진에서 추천·인용되고 있습니다. ${withJosa(features, '을/를')} FAQ·칼럼 첫 문단에 고정하면 1~3위 추천을 유지할 수 있습니다.`,
		};
	}
	if (cited >= 1 || mentioned >= 2) {
		return {
			statusBadge: '신호 구축 단계',
			badgeType: 'amber',
			description: `ChatGPT, Claude 등에서는 '단순 언급' 수준으로 파악되나, ${withJosa(features, '이/가')} 학습 데이터에 명확히 각인되지 않아 추천 답변의 상위 랭킹(1~3위)에 안정적으로 진입하지 못한 상태입니다.`,
		};
	}
	if (probed && cited === 0 && mentioned === 0) {
		return {
			statusBadge: '응답 누락 주의',
			badgeType: 'amber',
			description: `실측 LLM 질의에서 ${withJosa(brand, '이/가')} 미언급이었습니다. 공식 정의 문장, 언론 인용, /llms.txt를 보강해 생성형 AI 검색(GEO) 엔티티를 먼저 각인해야 합니다.`,
		};
	}
	if (critical >= 2) {
		return {
			statusBadge: '신호 구축 단계',
			badgeType: 'amber',
			description: `${brand}의 온페이지 신호는 확인되나 ${withJosa(features, '이/가')} AI 엔진에 충분히 각인되지 않았습니다. 크롤러 허용·인용 문서·엔티티 연결을 먼저 닫고 6대 엔진별 처방을 적용하세요.`,
		};
	}
	return {
		statusBadge: '신호 구축 단계',
		badgeType: 'amber',
		description: `${withJosa(brand, '은/는')} AI 엔진이 신뢰할 수 있는 로컬 엔티티로 인지하기 시작한 단계입니다. ${withJosa(features, '과/와')} 공식 Q&A를 보강하면 최상위 추천 진입이 유력합니다.`,
	};
}

function buildGoogleChannelBriefing(audit: SiteAuditResult, scores: { observedSeoScore: number; seoMaxScore: number }): ChannelStatusItem {
	const seoPct = scores.seoMaxScore > 0 ? scores.observedSeoScore / scores.seoMaxScore : 0;
	const gaps: string[] = [];
	if (!audit.googleMapsLinked) gaps.push('Google 비즈니스 프로필(GBP) 세부 서비스 탭 등록');
	if (!audit.hasYoutubeCaptions) gaps.push('유튜브 영상 자막(CC) 텍스트');
	if (!audit.hasGeoCoordinates) gaps.push('스키마 좌표와 GBP 핀 일치');
	const gapText = gaps.length
		? `${joinKoreanAnd(gaps)}가 보강되어야 구글 AI 오버뷰 및 로컬 3-Pack 최상단을 장악할 수 있습니다.`
		: 'GBP 소식·서비스 탭을 주기적으로 갱신하면 로컬 3-Pack과 AI 오버뷰 점유를 유지할 수 있습니다.';

	if (seoPct >= 0.9) {
		return {
			statusBadge: '구조 완비 / 확장 필요',
			badgeType: 'blue',
			description: `웹페이지 온페이지(On-Page) SEO는 만점(${scores.observedSeoScore}점) 수준으로 매우 훌륭합니다. 다만 ${gapText.replace(/<strong>|<\/strong>/g, '')}`,
		};
	}
	if (seoPct >= 0.6) {
		return {
			statusBadge: '기반 양호 / 확장 필요',
			badgeType: 'blue',
			description: `온페이지 SEO는 ${scores.observedSeoScore}/${scores.seoMaxScore}점으로 기반이 있습니다. ${gapText.replace(/<strong>|<\/strong>/g, '')}`,
		};
	}
	return {
		statusBadge: '기술 보완 필요',
		badgeType: 'amber',
		description: `온페이지 SEO 실측이 ${scores.observedSeoScore}/${scores.seoMaxScore}점에 머물러 있습니다. 타이틀·스키마·내부링크를 먼저 닫고 GBP·유튜브 자막을 연결하세요.`,
	};
}

function buildNaverChannelBriefing(audit: SiteAuditResult): ChannelStatusItem {
	const brand = (audit.brandName || '해당 브랜드').trim();
	const menus = audit.naverPlaceMenuCount ?? audit.coreFeatureCount ?? 0;

	if (!audit.naverPlaceLinked) {
		return {
			statusBadge: '플레이스 미연결',
			badgeType: 'amber',
			description: `네이버 스마트플레이스 신호가 없어 Cue: 로컬 답변의 기준 엔티티가 없습니다. ${brand} 플레이스를 개설하고 대표 키워드·세부 메뉴를 등록하세요.`,
		};
	}
	if (menus < 3 || !audit.naverKinExpertSignal) {
		return {
			statusBadge: '기반 양호 / 전환 가속',
			badgeType: 'green',
			description: `기본 플레이스 진입은 안정적이나, 단순 일반 검색어에 머물러 있습니다. 대표 키워드 재편과 설명 중심 블로그 칼럼 축적을 통해 네이버 스마트블록과 AI 큐(Cue:)의 단독 추천 후보군으로 전환해야 합니다.`,
		};
	}
	return {
		statusBadge: '로컬 엔티티 연결',
		badgeType: 'green',
		description: `${brand} 스마트플레이스와 메뉴 신호가 확인됩니다. 지식iN 전문가 답변과 브랜드 블로그를 유지하면 Cue: Q&A 영역을 방어할 수 있습니다.`,
	};
}

export function buildChannelBriefing(
	audit: SiteAuditResult,
	diagnoses: AiEngineDiagnosis[],
	scores: Pick<GuideScoreAnalysis, 'observedSeoScore' | 'seoMaxScore'>,
	recognition?: AiRecognitionResult[],
): ChannelStatusBriefing {
	return {
		aiSearch: buildAiChannelBriefing(audit, diagnoses, recognition),
		googleSearch: buildGoogleChannelBriefing(audit, scores),
		naverPlace: buildNaverChannelBriefing(audit),
	};
}

export function evaluateGuideAnalysis(
	audit: SiteAuditResult,
	recognition?: AiRecognitionResult[],
): GuideScoreAnalysis {
	const aiEngineDiagnoses = evaluateAiBottlenecks(audit, recognition);
	const scores = deriveGuideScores(audit, aiEngineDiagnoses, recognition);
	return {
		...scores,
		channelBriefing: buildChannelBriefing(audit, aiEngineDiagnoses, scores, recognition),
		aiEngineDiagnoses,
	};
}

export function evaluateGuideAnalysisFromReport(
	report: AuditReport,
	recognition?: Array<AiRecognitionResult | LiveEngineCheckResult>,
): GuideScoreAnalysis {
	const diagnoses = evaluateAiBottlenecksFromReport(report, recognition);
	const mapped = recognition?.length
		? recognition.map((row) => (isLiveEngineRow(row) ? liveResultsToRecognition([row])[0] : row))
		: undefined;
	const audit = siteAuditFromReport(report);
	const scores = deriveGuideScores(audit, diagnoses, mapped);
	return {
		...scores,
		channelBriefing: buildChannelBriefing(audit, diagnoses, scores, mapped),
		aiEngineDiagnoses: diagnoses,
	};
}
