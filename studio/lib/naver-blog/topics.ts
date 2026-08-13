import type { ProjectListItem } from '@/lib/projects';

/** Default treatment / topic options for medical GEO posting. */
export const DEFAULT_TREATMENT_TOPICS = [
	'중입자 치료',
	'iNKT 세포치료',
	'줄기세포치료',
	'네오안티젠 DC 백신',
	'중입자치료 대상암',
] as const;

const GENERIC_TOPICS = [
	'브랜드 소개',
	'서비스 안내',
	'고객 후기',
	'FAQ 가이드',
	'지역 최적화',
] as const;

/** Project-code keyed topic overrides (large client catalogs). */
const PROJECT_TOPIC_CATALOG: Record<string, string[]> = {
	koreaionlab: [...DEFAULT_TREATMENT_TOPICS],
	'한국중입자': [...DEFAULT_TREATMENT_TOPICS],
};

/** Recommended GEO keywords per treatment / topic. */
export const TOPIC_KEYWORD_SUGGESTIONS: Record<string, string[]> = {
	'중입자 치료': [
		'일본 중입자 치료 비용',
		'중입자 치료 병원',
		'해외 중입자치료',
		'중입자치료 효과',
	],
	'iNKT 세포치료': [
		'iNKT 세포치료란',
		'세포치료 전문병원',
		'면역세포치료 비용',
		'해외 암치료 전문병원',
	],
	줄기세포치료: [
		'줄기세포치료 후기',
		'줄기세포치료 비용',
		'재생의료 치료법',
		'줄기세포 암치료',
	],
	'네오안티젠 DC 백신': [
		'네오안티젠 DC 백신',
		'DC 백신 치료',
		'개인맞춤 암백신',
		'수지상세포 백신',
	],
	'중입자치료 대상암': [
		'중입자치료 대상암',
		'전립선암 중입자치료',
		'췌장암 중입자치료',
		'간암 중입자 치료',
	],
	'브랜드 소개': ['브랜드 스토리', '회사 소개 SEO'],
	'서비스 안내': ['서비스 특징', '전문 서비스 안내'],
	'고객 후기': ['실제 후기', '이용 경험'],
	'FAQ 가이드': ['자주 묻는 질문', '상담 FAQ'],
	'지역 최적화': ['지역 검색 노출', '로컬 SEO'],
};

export function extractProjectCode(project: Pick<ProjectListItem, 'id' | 'name' | 'targetUrl'>): string {
	try {
		const host = new URL(project.targetUrl).hostname.replace(/^www\./, '');
		const slug = host.split('.')[0]?.trim();
		if (slug) return slug.toLowerCase();
	} catch {
		// ignore
	}
	const fromName = project.name
		.replace(/\[([^\]]+)\]/, '$1')
		.trim()
		.split(/\s+/)[0];
	return (fromName || project.id).toLowerCase();
}

export function formatProjectLabel(project: ProjectListItem): string {
	const code = extractProjectCode(project);
	return `[${code}] ${project.name}`;
}

function looksMedical(project: ProjectListItem): boolean {
	if (project.category === 'MEDICAL') return true;
	const hay = `${project.name} ${project.targetUrl}`.toLowerCase();
	return /ion|중입자|암|clinic|병원|의료|cancer|proton|bnct|cell|stem|vaccine|치료/.test(hay);
}

/** Topics registered for the selected project / site. */
export function getTopicsForProject(project: ProjectListItem | null | undefined): string[] {
	if (!project) return [...DEFAULT_TREATMENT_TOPICS];
	const code = extractProjectCode(project);
	const byCode = PROJECT_TOPIC_CATALOG[code] || PROJECT_TOPIC_CATALOG[project.name];
	if (byCode?.length) return [...byCode];
	if (looksMedical(project)) return [...DEFAULT_TREATMENT_TOPICS];
	return [...GENERIC_TOPICS];
}

export function getKeywordSuggestions(topic: string): string[] {
	return TOPIC_KEYWORD_SUGGESTIONS[topic] || [
		`${topic} 비용`,
		`${topic} 병원`,
		`해외 ${topic}`,
		`${topic} FAQ`,
	];
}
