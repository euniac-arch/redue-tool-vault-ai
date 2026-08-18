import type { CaseStudyData } from '@/lib/case-study-types';

/** 안성햇살의원 (sunshineclinic.kr) — SEO/GEO 진단 Before → After 케이스 스터디. */
export const anseongSunshineClinicCaseStudy: CaseStudyData = {
	id: 'anseong-sunshine-clinic',
	siteInfo: {
		name: '안성햇살의원',
		domain: 'sunshineclinic.kr',
		domainUrl: 'https://sunshineclinic.kr',
		category: '의료 / 정형·통증클리닉',
		techStack: 'Custom HTML/PHP',
		httpsEnabled: false,
		ttfbMs: 61,
		ttfbTone: 'good',
	},
	normalizedScore: {
		before: { score: 53, maxScore: 100, tone: 'critical', label: '노출 위험 · 상위 47%' },
		after: { score: 81, maxScore: 100, tone: 'good', label: '상위 추천 선점 · 상위 19%' },
	},
	algorithmScore: { before: 54.5, after: 98.0, maxScore: 122 },
	axes: [
		{
			key: 'seo',
			label: 'SEO 기술 기본기',
			before: { score: 67, raw: '19.5/29' },
			after: { score: 92 },
		},
		{
			key: 'performance',
			label: '웹 성능 & 접근성',
			before: { score: 73, raw: '22/30' },
			after: { score: 95 },
		},
		{
			key: 'schema',
			label: '스키마 구조화 (JSON-LD)',
			before: { score: 0, raw: '0/37', badge: { label: 'FAIL', tone: 'critical' } },
			after: { score: 100, raw: '37/37', badge: { label: 'PASS', tone: 'good' } },
		},
		{
			key: 'geo',
			label: 'GEO & E-E-A-T 신호',
			before: { score: 50, raw: '13/26', badge: { label: 'WARN', tone: 'warning' } },
			after: { score: 88 },
		},
	],
	deficits: [
		{
			severity: 'critical',
			title: 'Organization 필수 속성 및 Logo/URL 누락',
			impact: 'E-E-A-T 감점 리스크',
		},
		{
			severity: 'high',
			title: 'JSON-LD 스키마 미구현',
			impact: 'ChatGPT · Perplexity 인용 후보 제외',
		},
		{
			severity: 'medium',
			title: '이미지 alt 태그 86% 누락',
			impact: '12/14건 · 이탈률 상승 요소',
		},
	],
	aiEngines: [
		{
			engine: 'Gemini',
			stars: 5,
			statusLabel: '상위 노출 중',
			reason: '구글맵 · LocalBusiness 신호 양호',
		},
		{
			engine: 'ChatGPT',
			stars: 3,
			statusLabel: '부분 노출',
			reason: 'Bing Places & Digital Footprint 부족',
		},
		{
			engine: 'Perplexity',
			stars: 3,
			statusLabel: '부분 노출',
			reason: 'FAQ 구조화 및 출처 문서 미흡',
		},
	],
	verifiedAt: '2026-08-14',
};
