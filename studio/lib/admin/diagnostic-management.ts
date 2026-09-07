/**
 * Admin "진단 이력 및 리포트 조회" — types, mock data, and pure helpers.
 *
 * See `studio/lib/admin/diagnosticService.ts` for the data-access seam.
 */

export type DiagnosticCategory = 'Medical' | 'Pet' | 'Commerce' | 'Corporate';
export type DiagnosticStatus = 'critical' | 'warning' | 'good';
export type DiagnosticPeriod = 'today' | '7d' | '30d';
export type DiagnosticPageSize = 10 | 20 | 50;

export type DiagnosticRecord = {
	id: string;
	siteName: string;
	domain: string;
	category: DiagnosticCategory;
	totalScore: number;
	geoScore: number;
	schemaScore: number;
	status: DiagnosticStatus;
	issues: string[];
	requestedBy: string;
	/** `YYYY-MM-DD HH:mm` */
	createdAt: string;
	reportShareUrl: string;
	url?: string;
};

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type DiagnosticRecommendation = {
	title: string;
	description: string;
	priority: RecommendationPriority;
};

export type DiagnosticReportData = {
	url?: string;
	knowledgeGraphScore: number;
	localSovScore: number;
	schemaTypes?: string[];
	jsonLdBlockCount?: number;
	recommendations: DiagnosticRecommendation[];
	summary: string;
	prescriptionIssued: boolean;
};

export type DiagnosticDetail = DiagnosticRecord & {
	knowledgeGraphScore: number;
	localSovScore: number;
	recommendations: DiagnosticRecommendation[];
	summary: string;
	prescriptionIssued: boolean;
	reportData?: DiagnosticReportData;
	url?: string;
};

export type DiagnosticKpiSummary = {
	totalCount: number;
	todayCount: number;
	avgGeoScore: number;
	reportCount: number;
};

export type DiagnosticSortBy = 'createdAt:desc' | 'createdAt:asc';

export type DiagnosticFilters = {
	query: string;
	category: 'all' | DiagnosticCategory;
	status: 'all' | DiagnosticStatus;
	period: DiagnosticPeriod;
};

export type DiagnosticKpi = {
	totalCount: number;
	todayCount: number;
	averageGeoScore: number;
	prescriptionCount: number;
};

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export const CATEGORY_LABEL: Record<DiagnosticCategory, string> = {
	Medical: '의료',
	Pet: '반려동물',
	Commerce: '유통',
	Corporate: '일반',
};

export const STATUS_LABEL: Record<DiagnosticStatus, string> = {
	critical: '위험',
	warning: '주의',
	good: '우수',
};

export const PERIOD_LABEL: Record<DiagnosticPeriod, string> = {
	today: '오늘',
	'7d': '최근 7일',
	'30d': '최근 30일',
};

export const EMPTY_DIAGNOSTIC_KPI: DiagnosticKpi = {
	totalCount: 0,
	todayCount: 0,
	averageGeoScore: 0,
	prescriptionCount: 0,
};

export function scoreToStatus(score: number): DiagnosticStatus {
	if (score <= 49) return 'critical';
	if (score <= 79) return 'warning';
	return 'good';
}

export function clampScore(score: number): number {
	return Math.max(0, Math.min(100, Math.round(score)));
}

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

export function formatDateTime(value: Date): string {
	return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
}

export function parseDateTime(value: string): Date {
	if (!value) return new Date(0);
	if (value.includes('T') || /Z$|[+-]\d{2}:\d{2}$/.test(value)) {
		const iso = new Date(value);
		if (!Number.isNaN(iso.getTime())) return iso;
	}
	const [datePart, timePart = '00:00'] = value.split(' ');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hour, minute] = timePart.split(':').map(Number);
	return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

export function formatDisplayDateTime(value: string): string {
	return formatDateTime(parseDateTime(value));
}

export function toKpiSummary(kpi: DiagnosticKpi): DiagnosticKpiSummary {
	return {
		totalCount: kpi.totalCount,
		todayCount: kpi.todayCount,
		avgGeoScore: kpi.averageGeoScore,
		reportCount: kpi.prescriptionCount,
	};
}

export function fromKpiSummary(summary: Partial<DiagnosticKpiSummary> | null | undefined): DiagnosticKpi {
	return {
		totalCount: Number(summary?.totalCount) || 0,
		todayCount: Number(summary?.todayCount) || 0,
		averageGeoScore: clampScore(Number(summary?.avgGeoScore) || 0),
		prescriptionCount: Number(summary?.reportCount) || 0,
	};
}

function atDaysAgo(days: number, hours: number, minutes: number): string {
	const date = new Date();
	date.setDate(date.getDate() - days);
	date.setHours(hours, minutes, 0, 0);
	return formatDateTime(date);
}

function startOfToday(): Date {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	return date;
}

function startOfPeriod(period: DiagnosticPeriod): Date {
	const start = startOfToday();
	if (period === 'today') return start;
	start.setDate(start.getDate() - (period === '7d' ? 6 : 29));
	return start;
}

export function cloneDiagnostics(rows: DiagnosticDetail[]): DiagnosticDetail[] {
	return rows.map((row) => ({
		...row,
		issues: [...row.issues],
		recommendations: row.recommendations.map((item) => ({ ...item })),
	}));
}

export function sameDiagnosticDomain(left: string, right: string): boolean {
	return left.replace(/^www\./i, '').toLowerCase() === right.replace(/^www\./i, '').toLowerCase();
}

/** True when the value is a host/URL the rerun engine can fetch — not a Firestore doc id. */
export function isDiagnosticRerunTarget(value: string | null | undefined): boolean {
	const trimmed = String(value || '').trim();
	if (!trimmed || /\s/.test(trimmed)) return false;
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true;
	return trimmed.includes('.') && trimmed.length < 253 && !trimmed.includes('/');
}

/**
 * Patch the recent-diagnostics list with a completed rerun so the score badge
 * updates immediately (before the refetch round-trip).
 */
export function applyDiagnosticRerunToList(
	items: DiagnosticRecord[],
	updated: DiagnosticRecord,
): DiagnosticRecord[] {
	let replaced = false;
	const next = items.map((row) => {
		if (row.id === updated.id || sameDiagnosticDomain(row.domain, updated.domain)) {
			replaced = true;
			return { ...row, ...updated, id: row.id === updated.id ? updated.id : row.id };
		}
		return row;
	});
	if (!replaced) next.unshift(updated);
	return sortDiagnostics(
		next.map((row) => ({
			...row,
			knowledgeGraphScore: 0,
			localSovScore: 0,
			recommendations: [],
			summary: '',
			prescriptionIssued: false,
		})),
		'createdAt:desc',
	).map(toDiagnosticRecord);
}

export function toDiagnosticRecord(row: DiagnosticDetail): DiagnosticRecord {
	return {
		id: row.id,
		siteName: row.siteName,
		domain: row.domain,
		category: row.category,
		totalScore: row.totalScore,
		geoScore: row.geoScore,
		schemaScore: row.schemaScore,
		status: row.status,
		issues: [...row.issues],
		requestedBy: row.requestedBy,
		createdAt: row.createdAt,
		reportShareUrl: row.reportShareUrl,
		url: row.url || row.reportData?.url,
	};
}

export function summarizeDiagnostics(rows: DiagnosticDetail[]): DiagnosticKpi {
	if (rows.length === 0) return { ...EMPTY_DIAGNOSTIC_KPI };
	const today = startOfToday();
	const todayCount = rows.filter((row) => parseDateTime(row.createdAt) >= today).length;
	const geoTotal = rows.reduce((sum, row) => sum + row.geoScore, 0);
	return {
		totalCount: rows.length,
		todayCount,
		averageGeoScore: clampScore(geoTotal / rows.length),
		prescriptionCount: rows.filter((row) => row.prescriptionIssued).length,
	};
}

export function filterDiagnostics(rows: DiagnosticDetail[], filters: DiagnosticFilters): DiagnosticDetail[] {
	const query = filters.query.trim().toLowerCase();
	const periodStart = startOfPeriod(filters.period);

	return rows.filter((row) => {
		if (parseDateTime(row.createdAt) < periodStart) return false;
		if (filters.category !== 'all' && row.category !== filters.category) return false;
		if (filters.status !== 'all' && row.status !== filters.status) return false;
		if (!query) return true;
		return (
			row.siteName.toLowerCase().includes(query) ||
			row.domain.toLowerCase().includes(query) ||
			row.id.toLowerCase().includes(query) ||
			(row.url || '').toLowerCase().includes(query)
		);
	});
}

export function sortDiagnostics(
	rows: DiagnosticDetail[],
	sortBy: DiagnosticSortBy = 'createdAt:desc',
): DiagnosticDetail[] {
	const direction = sortBy === 'createdAt:asc' ? 1 : -1;
	return [...rows].sort(
		(a, b) => (parseDateTime(a.createdAt).getTime() - parseDateTime(b.createdAt).getTime()) * direction,
	);
}

export function paginateDiagnostics(rows: DiagnosticDetail[], page: number, pageSize: number): DiagnosticDetail[] {
	const start = (page - 1) * pageSize;
	return rows.slice(start, start + pageSize);
}

export function nextDiagnosticId(rows: DiagnosticDetail[]): string {
	const max = rows.reduce((acc, row) => {
		const match = /-(\d+)$/.exec(row.id);
		return match ? Math.max(acc, Number(match[1])) : acc;
	}, 0);
	return `DIAG-2026-${String(max + 1).padStart(3, '0')}`;
}

export const MOCK_DIAGNOSTICS: DiagnosticDetail[] = [
	{
		id: 'DIAG-2026-001',
		siteName: '나인원의원',
		domain: 'nineoneclinic.com',
		category: 'Medical',
		totalScore: 78,
		geoScore: 74,
		schemaScore: 81,
		status: 'warning',
		issues: ['대표자 지식그래프 미연동', 'MedicalProcedure 누락'],
		requestedBy: 'dr.bae@nineoneclinic.com',
		createdAt: atDaysAgo(0, 14, 8),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-001',
		knowledgeGraphScore: 61,
		localSovScore: 72,
		prescriptionIssued: true,
		summary: '의료 엔티티는 비교적 잘 잡혀 있으나, 원장 지식그래프와 시술 스키마가 비어 있어 GEO 인용 확률이 낮습니다.',
		recommendations: [
			{
				title: 'Physician 엔티티 연결',
				description: '원장 프로필 페이지에 Person + Physician 스키마와 sameAs(네이버/구글)를 주입하세요.',
				priority: 'high',
			},
			{
				title: 'MedicalProcedure 보강',
				description: '주요 시술 8종을 MedicalProcedure로 마크업하고 대표 페이지에 연결하세요.',
				priority: 'high',
			},
			{
				title: '로컬 인용 일관성',
				description: 'NAP를 네이버 플레이스·카카오맵과 동일한 표기로 맞추면 Local SoV가 상승합니다.',
				priority: 'medium',
			},
		],
	},
	{
		id: 'DIAG-2026-002',
		siteName: '젠틀리동물의료센터',
		domain: 'gentle-amc.co.kr',
		category: 'Pet',
		totalScore: 86,
		geoScore: 88,
		schemaScore: 84,
		status: 'good',
		issues: ['FAQPage 미적용'],
		requestedBy: 'seo_master@kakao.com',
		createdAt: atDaysAgo(0, 11, 22),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-002',
		knowledgeGraphScore: 82,
		localSovScore: 90,
		prescriptionIssued: true,
		summary: '반려동물 병원 엔티티와 로컬 인용은 우수합니다. FAQ 스키마만 보강하면 답변 엔진 노출이 더 안정적입니다.',
		recommendations: [
			{
				title: 'FAQPage 스키마 추가',
				description: '진료 안내·수술 전후 질문 6개를 FAQPage로 구조화하세요.',
				priority: 'medium',
			},
			{
				title: 'Veterinarian sameAs 보강',
				description: '원장 프로필에 학회·논문 링크를 sameAs로 연결하면 E-E-A-T가 강화됩니다.',
				priority: 'low',
			},
		],
	},
	{
		id: 'DIAG-2026-003',
		siteName: '신일푸드',
		domain: 'shinilfood.co.kr',
		category: 'Commerce',
		totalScore: 41,
		geoScore: 38,
		schemaScore: 44,
		status: 'critical',
		issues: ['HTTPS 미적용', 'Product 스키마 누락', '브랜드 엔티티 혼선'],
		requestedBy: 'Guest',
		createdAt: atDaysAgo(2, 16, 40),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-003',
		knowledgeGraphScore: 29,
		localSovScore: 35,
		prescriptionIssued: false,
		summary: '보안 프로토콜과 상품 스키마가 모두 비어 있어 AI 엔진이 브랜드를 유통 사업자로 인식하지 못합니다.',
		recommendations: [
			{
				title: '전 구간 HTTPS 전환',
				description: '인증서를 설치하고 HTTP → HTTPS 301 리다이렉트를 적용하세요.',
				priority: 'high',
			},
			{
				title: 'Product / Offer 마크업',
				description: '대표 SKU 12종에 Product, Offer, brand 속성을 주입하세요.',
				priority: 'high',
			},
			{
				title: 'Organization 단일화',
				description: '법인명·브랜드명을 하나의 Organization @id로 묶어 지식그래프 혼선을 해소하세요.',
				priority: 'medium',
			},
		],
	},
	{
		id: 'DIAG-2026-004',
		siteName: '레드유 스튜디오',
		domain: 'redue.ai',
		category: 'Corporate',
		totalScore: 92,
		geoScore: 94,
		schemaScore: 91,
		status: 'good',
		issues: ['llms.txt 버전 불일치'],
		requestedBy: 'geo.ops@redue.ai',
		createdAt: atDaysAgo(4, 9, 15),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-004',
		knowledgeGraphScore: 93,
		localSovScore: 80,
		prescriptionIssued: true,
		summary: '엔티티 팩과 스키마 완성도가 높습니다. llms.txt만 최신 서비스 라인에 맞게 갱신하면 됩니다.',
		recommendations: [
			{
				title: 'llms.txt 동기화',
				description: '현재 제공 중인 GEO 진단·처방 워크스페이스 항목을 llms.txt에 반영하세요.',
				priority: 'low',
			},
		],
	},
	{
		id: 'DIAG-2026-005',
		siteName: '서울스킨클리닉',
		domain: 'seoulskinclinic.com',
		category: 'Medical',
		totalScore: 63,
		geoScore: 58,
		schemaScore: 70,
		status: 'warning',
		issues: ['대표자 지식그래프 미연동', '시술 가격 스키마 불일치'],
		requestedBy: 'clinic.admin@seoulskinclinic.com',
		createdAt: atDaysAgo(9, 13, 5),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-005',
		knowledgeGraphScore: 47,
		localSovScore: 64,
		prescriptionIssued: true,
		summary: '클리닉 스키마는 존재하지만 원장 엔티티와 가격 정보가 어긋나 AI 답변에서 신뢰도가 떨어집니다.',
		recommendations: [
			{
				title: '원장 Person 그래프 연결',
				description: '원장 소개 페이지를 MedicalClinic의 employee로 연결하세요.',
				priority: 'high',
			},
			{
				title: '가격 Offer 정합성',
				description: '랜딩 페이지 가격과 schema.org Offer.price를 동일 값으로 맞추세요.',
				priority: 'medium',
			},
		],
	},
	{
		id: 'DIAG-2026-006',
		siteName: '펫프렌즈몰',
		domain: 'petfriends-mall.com',
		category: 'Pet',
		totalScore: 38,
		geoScore: 34,
		schemaScore: 40,
		status: 'critical',
		issues: ['HTTPS 미적용', 'BreadcrumbList 누락', '상품 리뷰 스키마 없음'],
		requestedBy: 'Guest',
		createdAt: atDaysAgo(14, 18, 27),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-006',
		knowledgeGraphScore: 22,
		localSovScore: 31,
		prescriptionIssued: false,
		summary: '커머스 기본 보안과 탐색 스키마가 없어 크롤러가 카테고리 구조를 학습하지 못합니다.',
		recommendations: [
			{
				title: 'SSL 및 혼합 콘텐츠 제거',
				description: '전 페이지 HTTPS를 강제하고 이미지 리소스를 보안 경로로 교체하세요.',
				priority: 'high',
			},
			{
				title: '카테고리 Breadcrumb 주입',
				description: '사료·용품·병원용품 3단 카테고리에 BreadcrumbList를 적용하세요.',
				priority: 'high',
			},
			{
				title: 'AggregateRating 연결',
				description: '후기 데이터를 AggregateRating으로 노출하면 상품 엔티티 신뢰가 올라갑니다.',
				priority: 'medium',
			},
		],
	},
	{
		id: 'DIAG-2026-007',
		siteName: '한샘리빙스토어',
		domain: 'hanssem-living.com',
		category: 'Commerce',
		totalScore: 81,
		geoScore: 79,
		schemaScore: 85,
		status: 'good',
		issues: ['로컬 매장 LocalBusiness 분산'],
		requestedBy: 'growth@hanssem-living.com',
		createdAt: atDaysAgo(19, 10, 48),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-007',
		knowledgeGraphScore: 76,
		localSovScore: 68,
		prescriptionIssued: true,
		summary: '상품 스키마는 우수하지만 오프라인 매장 엔티티가 분산되어 로컬 SoV가 정체되어 있습니다.',
		recommendations: [
			{
				title: '매장 LocalBusiness 통합',
				description: '각 지점 페이지를 하나의 Organization 하위로 묶고 parentOrganization을 지정하세요.',
				priority: 'medium',
			},
			{
				title: '매장별 NAP 표준화',
				description: '주소 표기(도로명/지번)를 네이버 플레이스와 일치시키세요.',
				priority: 'low',
			},
		],
	},
	{
		id: 'DIAG-2026-008',
		siteName: '한화솔루션',
		domain: 'hanwha-solutions.com',
		category: 'Corporate',
		totalScore: 54,
		geoScore: 49,
		schemaScore: 62,
		status: 'warning',
		issues: ['About 페이지 엔티티 공백', '동일 법인 중복 @id'],
		requestedBy: 'pr.info@hanwha-solutions.com',
		createdAt: atDaysAgo(26, 15, 12),
		reportShareUrl: 'https://studio.redue.ai/r/diag-2026-008',
		knowledgeGraphScore: 45,
		localSovScore: 40,
		prescriptionIssued: true,
		summary: '대기업 사이트임에도 법인 엔티티가 중복 정의되어 AI가 브랜드를 여러 조직으로 해석합니다.',
		recommendations: [
			{
				title: 'Organization @id 단일화',
				description: '모든 서브도메인 스키마가 동일한 Organization @id를 참조하도록 정리하세요.',
				priority: 'high',
			},
			{
				title: 'About 페이지 지식그래프',
				description: '연혁·사업영역·자회사를 sameAs 및 subOrganization으로 명시하세요.',
				priority: 'medium',
			},
		],
	},
];
