import type { CaseStudyData } from '@/lib/case-study-types';

/** 포트폴리오 리스트 미리보기용 샘플 케이스 스터디 (실서비스 데이터가 아님). */
export const SAMPLE_CASE_STUDIES: CaseStudyData[] = [
	{
		id: 'wolha-hanok-stay',
		siteInfo: {
			name: '월하한옥스테이',
			domain: 'wolhahouse.kr',
			domainUrl: 'https://wolhahouse.kr',
			category: '숙박 / 한옥스테이',
			techStack: 'WordPress',
			httpsEnabled: true,
			ttfbMs: 184,
			ttfbTone: 'warning',
		},
		normalizedScore: {
			before: { score: 41, maxScore: 100, tone: 'critical', label: '예약 유입 약세 · 상위 59%' },
			after: { score: 86, maxScore: 100, tone: 'good', label: '로컬 숙소 추천 선점 · 상위 14%' },
		},
		algorithmScore: { before: 48.0, after: 109.5, maxScore: 122 },
		axes: [
			{
				key: 'seo',
				label: 'SEO 기술 기본기',
				before: { score: 58, raw: '17/29' },
				after: { score: 90 },
			},
			{
				key: 'performance',
				label: '웹 성능 & 접근성',
				before: { score: 61, raw: '18/30' },
				after: { score: 88 },
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
				before: { score: 42, raw: '11/26', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 84 },
			},
		],
		deficits: [
			{
				severity: 'critical',
				title: 'LodgingBusiness · Hotel 스키마 미구현',
				impact: 'Google 숙소·AI 예약 추천 제외',
			},
			{
				severity: 'high',
				title: 'NAP(이름·주소·전화) 불일치',
				impact: '네이버 플레이스 · Maps 신뢰도 하락',
			},
			{
				severity: 'medium',
				title: '객실 갤러리 alt 태그 72% 누락',
				impact: '이미지 검색 및 접근성 감점',
			},
		],
		aiEngines: [
			{
				engine: 'Gemini',
				stars: 4,
				statusLabel: '로컬 추천 진입',
				reason: 'Hotel 스키마 · 구글맵 연동 완료',
			},
			{
				engine: 'ChatGPT',
				stars: 3,
				statusLabel: '부분 노출',
				reason: '예약 FAQ 구조화 후 인용 증가',
			},
			{
				engine: 'Perplexity',
				stars: 4,
				statusLabel: '출처 후보 편입',
				reason: '위치·편의시설 문서화 강화',
			},
		],
		verifiedAt: '2026-08-11',
	},
	{
		id: 'hangyeol-law',
		siteInfo: {
			name: '법무법인 한결',
			domain: 'hangyeol-law.kr',
			domainUrl: 'https://hangyeol-law.kr',
			category: '법률 / 법무법인',
			techStack: 'Custom HTML/PHP',
			httpsEnabled: true,
			ttfbMs: 96,
			ttfbTone: 'good',
		},
		normalizedScore: {
			before: { score: 62, maxScore: 100, tone: 'warning', label: '전문성 신호 부족 · 상위 38%' },
			after: { score: 79, maxScore: 100, tone: 'good', label: 'E-E-A-T 보강 · 상위 21%' },
		},
		algorithmScore: { before: 71.5, after: 102.0, maxScore: 122 },
		axes: [
			{
				key: 'seo',
				label: 'SEO 기술 기본기',
				before: { score: 74, raw: '21.5/29' },
				after: { score: 88 },
			},
			{
				key: 'performance',
				label: '웹 성능 & 접근성',
				before: { score: 80, raw: '24/30' },
				after: { score: 91 },
			},
			{
				key: 'schema',
				label: '스키마 구조화 (JSON-LD)',
				before: { score: 22, raw: '8/37', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 95, raw: '35/37', badge: { label: 'PASS', tone: 'good' } },
			},
			{
				key: 'geo',
				label: 'GEO & E-E-A-T 신호',
				before: { score: 46, raw: '12/26', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 82 },
			},
		],
		deficits: [
			{
				severity: 'high',
				title: 'Attorney · LegalService 스키마 부분 구현',
				impact: '변호사 프로필이 AI 인용 대상에서 누락',
			},
			{
				severity: 'high',
				title: '저자(Person) · 자격 정보 미연결',
				impact: 'E-E-A-T 전문성 점수 하락',
			},
			{
				severity: 'medium',
				title: '상담 FAQ 비구조화',
				impact: 'People Also Ask · AI 답변 박스 미진입',
			},
		],
		aiEngines: [
			{
				engine: 'Gemini',
				stars: 4,
				statusLabel: '전문 질의 노출',
				reason: 'LegalService 스키마 · 약력 페이지 보강',
			},
			{
				engine: 'ChatGPT',
				stars: 4,
				statusLabel: '인용 후보',
				reason: '변호사 Person 그래프 연결',
			},
			{
				engine: 'Perplexity',
				stars: 3,
				statusLabel: '부분 노출',
				reason: '판례 해설 출처 문서 추가 필요',
			},
		],
		verifiedAt: '2026-08-09',
	},
	{
		id: 'harin-closet',
		siteInfo: {
			name: '하린클로젯',
			domain: 'harincloset.kr',
			domainUrl: 'https://harincloset.kr',
			category: '이커머스 / 패션',
			techStack: 'Cafe24',
			httpsEnabled: true,
			ttfbMs: 312,
			ttfbTone: 'critical',
		},
		normalizedScore: {
			before: { score: 48, maxScore: 100, tone: 'critical', label: '상품 검색 누락 · 상위 52%' },
			after: { score: 91, maxScore: 100, tone: 'good', label: '리치결과 확보 · 상위 9%' },
		},
		algorithmScore: { before: 52.0, after: 114.5, maxScore: 122 },
		axes: [
			{
				key: 'seo',
				label: 'SEO 기술 기본기',
				before: { score: 64, raw: '18.5/29' },
				after: { score: 93 },
			},
			{
				key: 'performance',
				label: '웹 성능 & 접근성',
				before: { score: 49, raw: '15/30', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 86 },
			},
			{
				key: 'schema',
				label: '스키마 구조화 (JSON-LD)',
				before: { score: 8, raw: '3/37', badge: { label: 'FAIL', tone: 'critical' } },
				after: { score: 100, raw: '37/37', badge: { label: 'PASS', tone: 'good' } },
			},
			{
				key: 'geo',
				label: 'GEO & E-E-A-T 신호',
				before: { score: 38, raw: '10/26', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 85 },
			},
		],
		deficits: [
			{
				severity: 'critical',
				title: 'Product · Offer 스키마 미주입',
				impact: '쇼핑 리치결과 · AI 상품 추천 제외',
			},
			{
				severity: 'high',
				title: '리뷰 AggregateRating 누락',
				impact: '별점 스니펫 미노출',
			},
			{
				severity: 'high',
				title: 'LCP 4.8s · 히어로 이미지 미압축',
				impact: 'Core Web Vitals 실패 · 이탈률 상승',
			},
		],
		aiEngines: [
			{
				engine: 'Gemini',
				stars: 5,
				statusLabel: '쇼핑 질의 상위',
				reason: 'Product 스키마 · 리뷰 별점 연동',
			},
			{
				engine: 'ChatGPT',
				stars: 4,
				statusLabel: '브랜드 언급',
				reason: '카테고리 FAQ · 브랜드 About 보강',
			},
			{
				engine: 'Perplexity',
				stars: 3,
				statusLabel: '부분 노출',
				reason: '소재·사이즈 가이드 출처 추가',
			},
		],
		verifiedAt: '2026-08-12',
	},
	{
		id: 'prime-edu-academy',
		siteInfo: {
			name: '프라임에듀아카데미',
			domain: 'primeduedu.kr',
			domainUrl: 'https://primeduedu.kr',
			category: '교육 / 입시학원',
			techStack: 'WordPress + LearnDash',
			httpsEnabled: true,
			ttfbMs: 142,
			ttfbTone: 'warning',
		},
		normalizedScore: {
			before: { score: 55, maxScore: 100, tone: 'warning', label: '과정 검색 약세 · 상위 45%' },
			after: { score: 84, maxScore: 100, tone: 'good', label: '지역 학원 추천 · 상위 16%' },
		},
		algorithmScore: { before: 61.0, after: 107.0, maxScore: 122 },
		axes: [
			{
				key: 'seo',
				label: 'SEO 기술 기본기',
				before: { score: 70, raw: '20/29' },
				after: { score: 91 },
			},
			{
				key: 'performance',
				label: '웹 성능 & 접근성',
				before: { score: 66, raw: '20/30' },
				after: { score: 87 },
			},
			{
				key: 'schema',
				label: '스키마 구조화 (JSON-LD)',
				before: { score: 14, raw: '5/37', badge: { label: 'FAIL', tone: 'critical' } },
				after: { score: 97, raw: '36/37', badge: { label: 'PASS', tone: 'good' } },
			},
			{
				key: 'geo',
				label: 'GEO & E-E-A-T 신호',
				before: { score: 48, raw: '12.5/26', badge: { label: 'WARN', tone: 'warning' } },
				after: { score: 80 },
			},
		],
		deficits: [
			{
				severity: 'critical',
				title: 'Course · EducationalOrganization 스키마 없음',
				impact: '과정 리치결과 · AI 학원 추천 제외',
			},
			{
				severity: 'high',
				title: '강사 Person 프로필 미연결',
				impact: '전문성(E-E-A-T) 신호 부족',
			},
			{
				severity: 'medium',
				title: '수강후기 비구조화',
				impact: '리뷰 스니펫 및 인용 문서 부재',
			},
		],
		aiEngines: [
			{
				engine: 'Gemini',
				stars: 4,
				statusLabel: '지역 학원 노출',
				reason: 'EducationalOrganization · Maps 연동',
			},
			{
				engine: 'ChatGPT',
				stars: 3,
				statusLabel: '부분 노출',
				reason: '커리큘럼 FAQ 구조화 완료',
			},
			{
				engine: 'Perplexity',
				stars: 4,
				statusLabel: '출처 후보 편입',
				reason: '강사 약력 · 합격 후기 문서화',
			},
		],
		verifiedAt: '2026-08-10',
	},
];
