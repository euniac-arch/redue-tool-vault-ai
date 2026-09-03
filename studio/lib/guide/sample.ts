import { emptyAiEngineDiagnoses, emptyChannelBriefing } from '@/lib/analysis/evaluateAiBottlenecks';
import { distributeSubScoresFromTrust } from '@/lib/guide/scores';
import type { AiEngineDiagnosis, ChannelStatusBriefing, GuideData, SubScores } from '@/lib/guide/types';
import {
	GUIDE_AI_POTENTIAL_DEFAULT,
	GUIDE_AI_TRUST_DEFAULT,
	GUIDE_OBSERVED_SEO_DEFAULT,
	GUIDE_SEO_MAX_DEFAULT,
} from '@/lib/guide/types';

const NINEONE_SUB_SCORES: SubScores = {
	specialty: 75,
	localPresence: 75,
	authority: 75,
	uniqueness: 75,
	awareness: 75,
};

const NINEONE_CHANNEL_BRIEFING: ChannelStatusBriefing = {
	aiSearch: {
		statusBadge: '신호 구축 단계',
		badgeType: 'amber',
		description:
			"ChatGPT, Claude 등에서는 '단순 언급' 수준으로 파악되나, 울트라클리어·덴서티 등 하이엔드 장비 보유 및 흉터 특화 정보가 학습 데이터에 명확히 각인되지 않아 추천 답변의 상위 랭킹(1~3위)에 안정적으로 진입하지 못한 상태입니다.",
	},
	googleSearch: {
		statusBadge: '구조 완비 / 확장 필요',
		badgeType: 'blue',
		description:
			'웹페이지 온페이지(On-Page) SEO는 만점(125점) 수준으로 매우 훌륭합니다. 다만 Google 비즈니스 프로필(GBP)의 세부 서비스 탭 등록과 유튜브 영상 자막(CC) 텍스트가 보강되어야 구글 AI 오버뷰 및 로컬 3-Pack 최상단을 장악할 수 있습니다.',
	},
	naverPlace: {
		statusBadge: '기반 양호 / 전환 가속',
		badgeType: 'green',
		description:
			'기본 플레이스 진입은 안정적이나, 단순 피부 미용 검색어에 머물러 있습니다. 대표 키워드(대구흉터치료/울트라클리어) 재편과 설명 중심 블로그 칼럼 축적을 통해 네이버 스마트블록과 AI 큐(Cue:)의 단독 추천 후보군으로 전환해야 합니다.',
	},
};

const NINEONE_AI_DIAGNOSES: AiEngineDiagnosis[] = [
	{
		engine: 'chatgpt',
		engineName: 'ChatGPT / SearchGPT',
		category: '웹 인덱싱 & 지식 베이스 검색',
		status: 'CRITICAL',
		statusText: '응답 누락 주의',
		detectedCause:
			'robots.txt에 GPTBot/OAI-SearchBot이 명시적으로 Allow 선언되지 않음\n루트에 /llms.txt 팩트 인덱스 파일 부재\n공식 보도자료 및 신뢰 웹사이트 인용(Citation) 신호 부재',
		actionItems: [
			'robots.txt에 User-agent: GPTBot, OAI-SearchBot 명시 및 Allow: / 선언',
			'/llms.txt 배포하여 상호·위치·핵심서비스 고정',
			'포털 뉴스 제휴 보도자료 배포를 통한 3rd-party 인용 확보',
		],
	},
	{
		engine: 'gemini',
		engineName: 'Google Gemini',
		category: '멀티모달 · Knowledge Graph · 유튜브',
		status: 'CRITICAL',
		statusText: '핵심 신호 누락',
		detectedCause:
			'LocalBusiness 스키마 좌표가 GBP 지도 좌표와 불일치하거나 미등록됨\n유튜브 영상에 수동 검수된 한글 자막(.srt/CC) 미등록',
		actionItems: [
			'JSON-LD 스키마의 latitude/longitude를 GBP 지도 핀과 80m 이내로 일치',
			'유튜브 스튜디오에서 의학/서비스 키워드가 포함된 자막 파일 직접 업로드',
		],
	},
	{
		engine: 'perplexity',
		engineName: 'Perplexity',
		category: '실시간 웹 크롤 · 인용 기반 답변',
		status: 'CRITICAL',
		statusText: '응답 누락 주의',
		detectedCause:
			'최근 60일 이내에 업데이트된 웹 문서 및 sitemap 갱신 신호 부족\n직접 인용을 유도하는 FAQPage 구조화 데이터 미적용',
		actionItems: [
			'lastmod가 포함된 sitemap.xml 제출 및 신규 정보성 칼럼 발행',
			'FAQPage JSON-LD 스키마 구축',
		],
	},
	{
		engine: 'claude',
		engineName: 'Claude',
		category: '장문 추론 · 의학적 인과관계 텍스트',
		status: 'CRITICAL',
		statusText: '핵심 신호 누락',
		detectedCause:
			'원리 및 인과관계를 설명하는 1,200자 이상의 심층 콘텐츠 부족\n책임 의료진/전문가 Person/Physician 스키마 연결 부재',
		actionItems: [
			'주력 서비스별 메커니즘과 치료 적응증을 설명하는 텍스트 칼럼 발행',
			'의료진 약력 및 전문분야 Person 스키마 선언',
		],
	},
	{
		engine: 'copilot',
		engineName: 'Microsoft Copilot',
		category: 'Bing Places · 영문/국문 NAP 동기화',
		status: 'WARNING',
		statusText: 'Bing 엔티티 동기화 주의',
		detectedCause: 'Bing Places for Business 사업장 미등록 또는 동기화 누락',
		actionItems: ['bingplaces.com에서 GBP 데이터 가져오기 및 등록 완료'],
	},
	{
		engine: 'navercue',
		engineName: 'Naver Cue',
		category: '스마트플레이스 · 지식iN 전문가 시그널',
		status: 'WARNING',
		statusText: '신호 약화 주의',
		detectedCause: '네이버 지식iN 전문가/하이닥 제휴 답변 신호 부재',
		actionItems: ['지식iN 전문가 답변 활동을 통한 네이버 AI Q&A 영역 선점'],
	},
];

export const NINEONE_GUIDE_SAMPLE: GuideData = {
	id: 'nineone',
	slug: 'nineone',
	brandName: '나인원의원',
	brandNameEng: 'Nine One Clinic',
	industry: '흉터 치료 전문·성형 복합 케어',
	region: '대구 동구',
	address: '대구광역시 동구 동부로 26길 6 대구 메리어트호텔 2층',
	telephone: '053-123-4567',
	coreFeatures: [
		'울트라클리어 2910nm',
		'덴서티 고주파 리프팅',
		'난치성 흉터 복원',
		'성형 후 복합 케어',
		'하이엔드 레이저',
	],
	keywords: [
		'나인원의원',
		'대구피부과',
		'대구동구피부과',
		'대구신천동피부과',
		'대구흉터치료',
		'대구울트라클리어',
		'대구덴서티',
		'대구여드름흉터',
		'울트라클리어',
		'덴서티',
	],
	observedSeoScore: 125,
	seoMaxScore: GUIDE_SEO_MAX_DEFAULT,
	aiTrustScore: 75,
	aiPotentialScore: 75,
	subScores: NINEONE_SUB_SCORES,
	channelBriefing: NINEONE_CHANNEL_BRIEFING,
	socialLinks: {
		website: 'https://nineoneclinic.com',
		youtube: '',
		instagram: '',
		facebook: '',
		blog: '',
	},
	faq: {
		question: '대구에서 울트라클리어 레이저로 흉터를 치료할 수 있는 곳은 어디인가요?',
		answer:
			'대구 동구 신천동(대구 메리어트호텔 2층)에 위치한 나인원의원에서 울트라클리어 및 덴서티를 활용한 복합 흉터 복원 및 피부 탄력 리프팅 치료를 시행하고 있습니다.',
	},
	aiEngineDiagnoses: NINEONE_AI_DIAGNOSES,
	createdAt: '2026-03-01T00:00:00.000Z',
};

/**
 * Blank guide state before any diagnosis has been loaded. KPI fields use the
 * shared presentable placeholders (not 0) so a fresh admin screen never looks
 * broken; loading a real diagnosis always overwrites these with measured
 * values via `sanitizeGuideScores`.
 */
export function emptyGuideData(): GuideData {
	return {
		id: '',
		slug: '',
		brandName: '',
		brandNameEng: '',
		industry: '',
		region: '',
		address: '',
		telephone: '',
		coreFeatures: [],
		keywords: [],
		observedSeoScore: GUIDE_OBSERVED_SEO_DEFAULT,
		seoMaxScore: GUIDE_SEO_MAX_DEFAULT,
		aiTrustScore: GUIDE_AI_TRUST_DEFAULT,
		aiPotentialScore: GUIDE_AI_POTENTIAL_DEFAULT,
		subScores: distributeSubScoresFromTrust(GUIDE_AI_TRUST_DEFAULT),
		channelBriefing: emptyChannelBriefing(),
		socialLinks: {},
		faq: { question: '', answer: '' },
		aiEngineDiagnoses: emptyAiEngineDiagnoses(),
		createdAt: '',
	};
}
