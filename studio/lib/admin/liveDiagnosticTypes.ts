export const LIVE_INDUSTRY_OPTIONS = [
	{ value: 'medical', label: '병의원/의료' },
	{ value: 'veterinary', label: '동물의료센터' },
	{ value: 'ecommerce', label: '이커머스' },
	{ value: 'corporate', label: '기업' },
] as const;

export type LiveDiagnosticIndustry = (typeof LIVE_INDUSTRY_OPTIONS)[number]['value'];

export const LIVE_INDUSTRY_LABEL: Record<LiveDiagnosticIndustry, string> = {
	medical: '병의원/의료',
	veterinary: '동물의료센터',
	ecommerce: '이커머스',
	corporate: '기업',
};

export const LIVE_SCAN_STEPS = [
	{ id: 'crawl', label: '크롤링', hint: 'HTML · 리소스 · HTTPS · 상태코드' },
	{ id: 'meta', label: '메타태그 파싱', hint: 'title · description · OG · canonical' },
	{ id: 'schema', label: '스키마 검증', hint: 'JSON-LD 구문 · 필수 속성 · @type' },
	{ id: 'geo', label: 'GEO 인용도 분석', hint: '엔티티 · sameAs · AI 엔진 인용 가능도' },
] as const;

export type LiveScanStepId = (typeof LIVE_SCAN_STEPS)[number]['id'];
export type LiveScanStepStatus = 'pending' | 'running' | 'done';

export type LiveDiagnosticOptions = {
	industry: LiveDiagnosticIndustry;
	targetFocus: string;
};

export type LiveIssueSeverity = 'critical' | 'warning' | 'good';

export type LiveDiagnosticIssue = {
	id: string;
	title: string;
	description: string;
	severity: LiveIssueSeverity;
};

export type LiveDiagnosticScores = {
	overall: number;
	schema: number;
	knowledgeGraph: number;
	geo: number;
};

export type LiveMetaSnapshot = {
	title: string;
	description: string;
	ogTitle: string;
	ogImage: string;
	canonical: string;
};

export type LiveCrawlSnapshot = {
	https: boolean;
	status: number | null;
	ok: boolean;
	finalUrl: string;
	elapsedMs: number;
	botChallenge: boolean;
};

export type LiveDetectedSchema = {
	types: string[];
	blockCount: number;
	hasMedicalBusiness: boolean;
	hasPhysician: boolean;
	hasOrganization: boolean;
	sameAs: string[];
};

export type LiveScoreBreakdown = {
	meta: number;
	jsonLd: number;
	knowledgeGraph: number;
};

export type LiveDiagnosticResult = {
	id: string;
	url: string;
	canonicalUrl: string;
	siteName: string;
	domain: string;
	industry: LiveDiagnosticIndustry;
	targetFocus: string;
	scannedAt: string;
	scores: LiveDiagnosticScores;
	issues: LiveDiagnosticIssue[];
	jsonLd: unknown;
	jsonLdPretty: string;
	headInjectSnippet: string;
	summary: string;
	crawl?: LiveCrawlSnapshot;
	meta?: LiveMetaSnapshot;
	detected?: LiveDetectedSchema;
	scoreBreakdown?: LiveScoreBreakdown;
};

export const ISSUE_SEVERITY_LABEL: Record<LiveIssueSeverity, string> = {
	critical: '심각',
	warning: '주의',
	good: '양호',
};

export type LiveDiagnosticProgressHandler = (
	stepId: LiveScanStepId,
	status: Extract<LiveScanStepStatus, 'running' | 'done'>,
) => void;

export function normalizeLiveUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) throw new Error('진단할 URL을 입력해 주세요.');
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let parsed: URL;
	try {
		parsed = new URL(withProtocol);
	} catch {
		throw new Error('올바른 URL 형식이 아닙니다. 예: https://example.com');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('http 또는 https URL만 진단할 수 있습니다.');
	}
	parsed.hash = '';
	return parsed.toString();
}

export function hostnameFromLiveUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch {
		return url;
	}
}
