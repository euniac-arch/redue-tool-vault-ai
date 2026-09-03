/**
 * Independent curation set for the "🔥 요즘 뜨는 AI" tab.
 * Never mixed into traffic ranking, rank-delta, or market-share math.
 */

export type CuratedTrendingCategory = 'video' | 'image' | 'llm' | 'audio' | 'code';

export type CuratedTrendingBadge = '🔥 HOT' | '✨ NEW' | '⚡ RISING';

export type CuratedPricingType = 'Freemium' | 'Free / Open Source' | 'Paid';

export interface CuratedTrendingTool {
	id: string;
	name: string;
	developer: string;
	category: CuratedTrendingCategory;
	badge: CuratedTrendingBadge;
	description: string;
	highlight: string;
	websiteUrl: string;
	pricingType: CuratedPricingType;
	tags: string[];
}

export const CURATED_TRENDING_CATEGORY_META: Array<{
	id: CuratedTrendingCategory;
	label: string;
}> = [
	{ id: 'video', label: '비디오' },
	{ id: 'image', label: '이미지' },
	{ id: 'llm', label: 'LLM·검색' },
	{ id: 'audio', label: '오디오' },
	{ id: 'code', label: '코딩·개발' },
];

export const CURATED_TRENDING_TOOLS: CuratedTrendingTool[] = [
	{
		id: 'seedance-2',
		name: 'Seedance 2.0 (SeaDance)',
		developer: 'ByteDance',
		category: 'video',
		badge: '🔥 HOT',
		description: '참조 비디오의 관절 움직임과 댄스/액션을 완벽히 복제하는 멀티모달 비디오 생성 모델.',
		highlight: '모션 복제 & 인체 물리 제어 1위',
		websiteUrl: 'https://jimeng.jianying.com/',
		pricingType: 'Freemium',
		tags: ['#모션복제', '#댄스액션', '#바이트댄스', '#숏폼특화'],
	},
	{
		id: 'hailuo-ai',
		name: 'Hailuo AI',
		developer: 'MiniMax',
		category: 'video',
		badge: '⚡ RISING',
		description: '극강의 실사 인물 표정 표현과 자연스러운 물리 충돌 반응을 보여주는 차세대 영상 AI.',
		highlight: '실사 표정 및 물리 시뮬레이션',
		websiteUrl: 'https://hailuoai.video/',
		pricingType: 'Freemium',
		tags: ['#실사인물', '#물리반응', '#가성비'],
	},
	{
		id: 'hunyuan-video',
		name: 'HunyuanVideo',
		developer: 'Tencent',
		category: 'video',
		badge: '✨ NEW',
		description: 'ComfyUI와 로컬 GPU 환경에서 구동 가능한 현존 최상위급 오픈소스 비디오 파운데이션 모델.',
		highlight: '오픈소스 영상 생성 끝판왕',
		websiteUrl: 'https://github.com/Tencent/HunyuanVideo',
		pricingType: 'Free / Open Source',
		tags: ['#오픈소스', '#ComfyUI', '#로컬구동'],
	},
	{
		id: 'flux-1',
		name: 'FLUX.1 [dev/schnell]',
		developer: 'Black Forest Labs',
		category: 'image',
		badge: '🔥 HOT',
		description: '미드저니를 압도하는 텍스트 렌더링(글자 묘사) 능력과 초고해상도 실사 질감 생성 모델.',
		highlight: '영문 타이포그래피 & 실사 묘사 1위',
		websiteUrl: 'https://blackforestlabs.ai/',
		pricingType: 'Free / Open Source',
		tags: ['#FLUX', '#타이포그래피', '#오픈웨이트'],
	},
	{
		id: 'recraft-v3',
		name: 'Recraft v3',
		developer: 'Recraft',
		category: 'image',
		badge: '⚡ RISING',
		description: '디자이너를 위한 전문 벡터(SVG) 그래픽, 3D 아이콘, 일러스트레이션 브랜딩 특화 생성기.',
		highlight: '디자이너 전용 벡터(SVG) 특화',
		websiteUrl: 'https://www.recraft.ai/',
		pricingType: 'Freemium',
		tags: ['#SVG벡터', '#디자인에셋', '#브랜딩'],
	},
	{
		id: 'ideogram-2',
		name: 'Ideogram 2.0',
		developer: 'Ideogram',
		category: 'image',
		badge: '⚡ RISING',
		description: '완벽한 포스터 디자인 레이아웃과 폰트 스타일을 연출하는 디자인 최적화 이미지 생성 AI.',
		highlight: '포스터 & 텍스트 그래픽 디자인',
		websiteUrl: 'https://ideogram.ai/',
		pricingType: 'Freemium',
		tags: ['#그래픽디자인', '#포스터', '#텍스트배치'],
	},
	{
		id: 'deepseek-r1',
		name: 'DeepSeek (V3 / R1)',
		developer: 'DeepSeek',
		category: 'llm',
		badge: '🔥 HOT',
		description: '오픈소스 모델로 OpenAI o1급 추론 능력을 보여주며 압도적인 가성비를 기록한 화제의 AI.',
		highlight: '오픈 가중치 추론(Reasoning) 최강자',
		websiteUrl: 'https://chat.deepseek.com/',
		pricingType: 'Free / Open Source',
		tags: ['#추론모델', '#가성비', '#오픈소스'],
	},
	{
		id: 'perplexity-spaces',
		name: 'Perplexity Spaces',
		developer: 'Perplexity',
		category: 'llm',
		badge: '⚡ RISING',
		description: '팀 단위 문서 업로드, 웹 리서치 및 맞춤형 검색 인덱스를 구축하는 협업형 검색 공간.',
		highlight: 'AI 기반 지식 검색 & 리서치 허브',
		websiteUrl: 'https://www.perplexity.ai/',
		pricingType: 'Freemium',
		tags: ['#AI검색', '#협업리서치', '#GEO최적화'],
	},
	{
		id: 'suno-v4',
		name: 'Suno v4',
		developer: 'Suno',
		category: 'audio',
		badge: '🔥 HOT',
		description: '스튜디오 마스터링급 음질과 복합적인 악기 세션 편곡을 지원하는 최신 작곡 엔진.',
		highlight: '스튜디오급 보컬 & 음원 생성',
		websiteUrl: 'https://suno.com/',
		pricingType: 'Freemium',
		tags: ['#음악생성', '#작곡AI', '#고음질보컬'],
	},
	{
		id: 'elevenlabs-voice-design',
		name: 'ElevenLabs Voice Design',
		developer: 'ElevenLabs',
		category: 'audio',
		badge: '✨ NEW',
		description: '프롬프트 몇 줄로 세상에 없는 고유한 목소리 톤과 감정을 즉시 설계해내는 음성 엔진.',
		highlight: '맞춤형 AI 보이스 디자인',
		websiteUrl: 'https://elevenlabs.io/',
		pricingType: 'Freemium',
		tags: ['#음성합성', '#보이스디자인', '#TTS'],
	},
	{
		id: 'bolt-new',
		name: 'Bolt.new',
		developer: 'StackBlitz',
		category: 'code',
		badge: '🔥 HOT',
		description: '브라우저 안에서 풀스택 Node/React 환경을 직접 실행하고 배포까지 끝내는 프롬프트 앱 빌더.',
		highlight: '브라우저 인브라우저 풀스택 빌더',
		websiteUrl: 'https://bolt.new/',
		pricingType: 'Freemium',
		tags: ['#풀스택빌더', '#코드생성', '#웹컨테이너'],
	},
	{
		id: 'v0-vercel',
		name: 'v0 by Vercel',
		developer: 'Vercel',
		category: 'code',
		badge: '⚡ RISING',
		description: '프롬프트 입력 즉시 완성도 높은 모던 React + Tailwind CSS 컴포넌트를 코드로 뽑아주는 툴.',
		highlight: 'React/Tailwind UI 실시간 생성',
		websiteUrl: 'https://v0.dev/',
		pricingType: 'Freemium',
		tags: ['#UI컴포넌트', '#Nextjs', '#Tailwind'],
	},
];

export function matchesCuratedTrendingQuery(tool: CuratedTrendingTool, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return (
		tool.name.toLowerCase().includes(q) ||
		tool.developer.toLowerCase().includes(q) ||
		tool.description.toLowerCase().includes(q) ||
		tool.highlight.toLowerCase().includes(q) ||
		tool.tags.some((tag) => tag.toLowerCase().includes(q))
	);
}

export function groupCuratedTrendingTools(tools: CuratedTrendingTool[], query = '') {
	return CURATED_TRENDING_CATEGORY_META.map((category) => ({
		...category,
		tools: tools.filter((tool) => tool.category === category.id && matchesCuratedTrendingQuery(tool, query)),
	})).filter((category) => category.tools.length > 0);
}
