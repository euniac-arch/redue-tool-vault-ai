import type { CaseStudyActionTaken, CaseStudyAxis, CaseStudyData } from '@/lib/case-study-types';

export interface ExecutiveImprovement {
	title: string;
	detail: string;
}

export interface ExecutiveNextStep {
	title: string;
	detail: string;
}

export function formatCaseStudyScore(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function resolveCaseStudyResultHref(data: CaseStudyData, override?: string): string {
	return override ?? data.resultHref ?? `/portfolio/case-study/${data.id}`;
}

export function findCaseStudyAxis(axes: CaseStudyAxis[], key: string): CaseStudyAxis | undefined {
	if (key === 'cwv' || key === 'performance') {
		return axes.find((axis) => axis.key === 'performance' || axis.key === 'cwv');
	}
	return axes.find((axis) => axis.key === key);
}

function isMedicalCategory(category: string): boolean {
	return /의료|병원|의원|클리닉|피부|성형|치과|한의/.test(category);
}

function schemaEntityLabel(category: string): string {
	if (isMedicalCategory(category)) return 'MedicalBusiness/LocalBusiness';
	if (/법률|법무/.test(category)) return 'LegalService/LocalBusiness';
	if (/숙박|한옥|호텔|스테이/.test(category)) return 'LodgingBusiness/LocalBusiness';
	if (/교육|학원/.test(category)) return 'EducationalOrganization/LocalBusiness';
	if (/이커머스|쇼핑몰|스토어/.test(category)) return 'Organization/Store';
	return 'Organization/LocalBusiness';
}

function serviceNoun(category: string): string {
	if (isMedicalCategory(category)) return '시술/서비스';
	if (/법률|법무/.test(category)) return '법률 서비스';
	if (/숙박|한옥|호텔|스테이/.test(category)) return '숙박/스테이';
	if (/교육|학원/.test(category)) return '교육 과정';
	return '서비스';
}

export function axisDisplayMeta(axis: CaseStudyAxis): { title: string; hint: string } {
	switch (axis.key) {
		case 'seo':
			return { title: 'SEO 기술 기본기', hint: '' };
		case 'performance':
		case 'cwv':
			return { title: '웹 성능 & CWV', hint: '' };
		case 'schema':
			return { title: '스키마 구조화', hint: 'JSON-LD 주입 상태' };
		case 'geo':
			return { title: 'AI 신뢰도 & GEO', hint: 'E-E-A-T 신호' };
		default:
			return { title: axis.label, hint: '' };
	}
}

export function schemaInjectionLabel(axis: CaseStudyAxis | undefined, hasBaseline: boolean): string {
	if (!axis) return '진단 데이터 없음';
	if (axis.after.badge?.label === 'PASS' || axis.after.score >= 95) return 'JSON-LD 주입 완료';
	if (hasBaseline && axis.before.score === 0 && axis.after.score >= 80) return 'JSON-LD 신규 주입';
	if (axis.after.score >= 80) return 'JSON-LD 적용됨';
	if (axis.after.score > 0) return 'JSON-LD 부분 적용';
	return 'JSON-LD 미주입';
}

export interface AxisCommentary {
	/** One-line expert commentary shown under the score badge. Always score-derived — never site-specific copy. */
	commentary: string;
	/** Key technical action checkpoints shown as small chip tags. */
	keyFixes: string[];
}

function seoAxisCommentary(after: number): AxisCommentary {
	if (after >= 95) {
		return {
			commentary:
				'Canonical 정규화 및 메타 타이틀·디스크립션·OG 태그 누락을 완전히 보완하고 H1~H3 시맨틱 헤딩 구조를 재설계해 검색 로봇 인덱싱 정확도를 최고 수준으로 끌어올렸습니다.',
			keyFixes: ['Canonical 태그 정규화', 'Meta Title/Description 최적화', '시맨틱 헤딩 계층화'],
		};
	}
	if (after >= 80) {
		return {
			commentary: '메타데이터와 시맨틱 태그를 정비해 검색 로봇의 페이지 구조 인덱싱 정확도를 크게 개선했습니다.',
			keyFixes: ['Meta Title/Description 보완', 'OpenGraph 태그 정비', '시맨틱 마크업 정리'],
		};
	}
	if (after >= 60) {
		return {
			commentary: '핵심 메타데이터는 확보했으나 세부 태그 보완이 추가로 필요한 상태입니다.',
			keyFixes: ['메타 태그 부분 보완', '헤딩 구조 점검 필요'],
		};
	}
	return {
		commentary: '검색 로봇이 페이지 구조를 온전히 해석하기 어려운 상태로, 기본 SEO 태그 보강이 시급합니다.',
		keyFixes: ['메타 태그 긴급 보강 필요'],
	};
}

function performanceAxisCommentary(before: number, after: number, hasBaseline: boolean): AxisCommentary {
	const delta = after - before;
	if (hasBaseline && delta === 0 && after >= 60) {
		return {
			commentary:
				'서버 응답 속도 제약이 있는 환경에서도 LCP·CLS 등 핵심 코어 웹 바이탈 지표가 흔들리지 않도록 방어 최적화를 적용했습니다.',
			keyFixes: ['LCP 안정 구간 방어', 'CLS 레이아웃 흔들림 최소화', '스크립트 비동기 로드'],
		};
	}
	if (after >= 90) {
		return {
			commentary: '이미지 최적화와 렌더링 차단 리소스 정리로 로딩 체감 속도와 레이아웃 안정성을 최상위 수준까지 끌어올렸습니다.',
			keyFixes: ['이미지 지연 로딩 적용', '렌더링 차단 리소스 제거', 'CLS 최소화'],
		};
	}
	if (after >= 70) {
		return {
			commentary: '핵심 렌더링 경로를 개선해 로딩 속도와 레이아웃 안정성이 눈에 띄게 좋아졌습니다.',
			keyFixes: ['렌더링 경로 최적화', '이미지 용량 압축'],
		};
	}
	return {
		commentary: '서버 응답 및 리소스 로딩 지연이 남아 있어 코어 웹 바이탈 방어를 위한 추가 조치가 필요합니다.',
		keyFixes: ['TTFB 개선 필요', '리소스 로딩 최적화 필요'],
	};
}

function schemaAxisCommentary(before: number, after: number, category: string): AxisCommentary {
	const entity = schemaEntityLabel(category);
	const entityShort = entity.split('/')[0];
	const noun = serviceNoun(category);
	if (after >= 95) {
		return {
			commentary: `${entity} 스키마를 100% 주입해 ${noun} 정보가 검색 포털과 생성형 AI에 정밀하게 매핑되도록 구조화했습니다.`,
			keyFixes: [`${entityShort} JSON-LD 주입`, '핵심 속성 구조화', '리치 스니펫 통과'],
		};
	}
	if (after >= 80) {
		return {
			commentary: '구조화 데이터를 폭넓게 적용해 검색 엔진과 생성형 AI가 사업 정보를 인식할 수 있는 기반을 마련했습니다.',
			keyFixes: ['JSON-LD 스키마 적용', '핵심 엔티티 매핑'],
		};
	}
	if (after > 0) {
		return {
			commentary: '구조화 데이터가 일부 적용되었으나 핵심 속성 보완이 추가로 필요합니다.',
			keyFixes: ['JSON-LD 부분 적용', '속성 보완 필요'],
		};
	}
	return {
		commentary: '구조화 데이터(JSON-LD)가 주입되지 않아 검색 엔진과 생성형 AI가 사업 정보를 인식하지 못하는 상태입니다.',
		keyFixes: ['JSON-LD 스키마 신규 주입 필요'],
	};
}

function geoAxisCommentary(after: number): AxisCommentary {
	if (after >= 95) {
		return {
			commentary:
				'대표자/기관 정보, 인증 신호, 사업장 식별 메타데이터를 연결해 ChatGPT·Perplexity·Gemini 등 생성형 AI의 인용 신뢰도를 최고 수준으로 확보했습니다.',
			keyFixes: ['E-E-A-T 프로필 매핑', 'AI 검색엔진 인용 최적화', '지식그래프 Entity 연결'],
		};
	}
	if (after >= 80) {
		return {
			commentary: '전문성·신뢰도 신호를 보강해 생성형 AI가 인용할 수 있는 근거를 확보했습니다.',
			keyFixes: ['E-E-A-T 신호 보강', 'NAP 정보 일치화'],
		};
	}
	if (after >= 60) {
		return {
			commentary: '기본적인 신뢰 신호는 확보했으나 AI 인용을 위한 근거 보강이 추가로 필요합니다.',
			keyFixes: ['전문성 근거 보완 필요'],
		};
	}
	return {
		commentary: 'AI가 신뢰할 수 있는 근거 신호가 부족해 생성형 검색 인용에서 누락될 위험이 있습니다.',
		keyFixes: ['E-E-A-T 신호 긴급 보강 필요'],
	};
}

/**
 * Score-derived one-line commentary + key-fix chips for the executive-summary
 * modal's 4-axis breakdown. Always computed from the axis before/after
 * numbers (and category-derived nouns) — never site-specific hardcoded copy.
 */
export function buildAxisCommentary(
	axis: CaseStudyAxis,
	category: string,
	hasBaseline: boolean,
): AxisCommentary {
	const before = hasBaseline ? axis.before.score : axis.after.score;
	const after = axis.after.score;

	if (axis.key === 'performance' || axis.key === 'cwv') {
		return performanceAxisCommentary(before, after, hasBaseline);
	}
	if (axis.key === 'schema') {
		return schemaAxisCommentary(before, after, category);
	}
	if (axis.key === 'geo') {
		return geoAxisCommentary(after);
	}
	return seoAxisCommentary(after);
}

export interface ExecutiveNarrativeModel {
	beforeScore: string;
	afterScore: string;
	lift: string;
	hasBaseline: boolean;
	intensity: '대폭 개선되어' | '유의미하게 개선되어' | '개선되어';
	foundation: 'AI 검색 신뢰도 기초공사를 100% 완료' | 'AI 검색 신뢰도 기반을 크게 강화';
	variant: 'lift' | 'after-only' | 'stable';
}

export function buildExecutiveNarrative(data: CaseStudyData): ExecutiveNarrativeModel {
	const before = data.normalizedScore.before.score;
	const after = data.normalizedScore.after.score;
	const hasBaseline = data.hasBaseline !== false;
	const lift = Number((after - before).toFixed(1));
	const intensity = lift >= 30 ? '대폭 개선되어' : lift >= 10 ? '유의미하게 개선되어' : '개선되어';
	const foundation = after >= 90 ? 'AI 검색 신뢰도 기초공사를 100% 완료' : 'AI 검색 신뢰도 기반을 크게 강화';

	return {
		beforeScore: formatCaseStudyScore(before),
		afterScore: formatCaseStudyScore(after),
		lift: formatCaseStudyScore(Math.abs(lift)),
		hasBaseline,
		intensity,
		foundation,
		variant: !hasBaseline ? 'after-only' : lift > 0 ? 'lift' : 'stable',
	};
}

function defaultImprovements(data: CaseStudyData): ExecutiveImprovement[] {
	const category = data.siteInfo.category;
	const entity = schemaEntityLabel(category);
	const schema = findCaseStudyAxis(data.axes, 'schema');
	const seo = findCaseStudyAxis(data.axes, 'seo');
	const cwv = findCaseStudyAxis(data.axes, 'performance');
	const items: ExecutiveImprovement[] = [];

	if (!schema || schema.after.score >= 70 || (schema.after.score - schema.before.score) >= 20) {
		items.push({
			title: '구조화 데이터 완전 주입',
			detail: `검색 로봇과 LLM이 병원/기업 정보를 오차 없이 파싱하도록 ${entity} JSON-LD 스키마 구축 완료.`,
		});
	}
	if (!seo || seo.after.score >= 70 || (seo.after.score - seo.before.score) >= 15) {
		items.push({
			title: '시맨틱 웹 표준 및 메타데이터 정비',
			detail: 'Title, Description, OpenGraph, Canonical 태그 누락 보정.',
		});
	}
	if (!cwv || cwv.after.score >= 60 || (cwv.after.score - cwv.before.score) >= 10) {
		items.push({
			title: '접근성 및 인프라 신호 개선',
			detail: `주요 이미지 태그 식별성 확보 및 TTFB 반응성 최적화${data.siteInfo.ttfbMs > 0 ? ` (현재 ${data.siteInfo.ttfbMs}ms)` : ''}.`,
		});
	}

	return items.slice(0, 3);
}

export function buildImprovementItems(data: CaseStudyData): ExecutiveImprovement[] {
	const taken = (Array.isArray(data.actionsTaken) ? data.actionsTaken : [])
		.filter((action): action is CaseStudyActionTaken & { title: string } => Boolean(action?.title))
		.map((action) => ({
			title: action.title,
			detail: action.detail?.trim() || 'REDUE 처방을 적용하고 재진단으로 개선을 확인했습니다.',
		}));

	if (taken.length >= 3) return taken.slice(0, 3);

	const extras = defaultImprovements(data).filter(
		(item) => !taken.some((row) => row.title === item.title),
	);
	return [...taken, ...extras].slice(0, 3);
}

export function buildNextSteps(data: CaseStudyData): ExecutiveNextStep[] {
	const noun = serviceNoun(data.siteInfo.category);
	return [
		{
			title: '출처 인용(Citation) 자산 확장',
			detail: `Perplexity 및 네이버 AI가 신뢰할 수 있는 ${noun} 정보 관련 FAQ 및 Q&A 구조화 문서 지속 배포.`,
		},
		{
			title: '외부 디지털 풋프린트(Digital Footprint) 동기화',
			detail: '지도(플레이스), 공공 데이터, 전문 포털 내 상호명/주소/연락처(NAP) 데이터 일관성 유지.',
		},
		{
			title: '정기 재진단(Continuous Monitoring)',
			detail: '검색 엔진 및 생성형 AI 알고리즘 업데이트에 맞춘 분기별 스키마 무결성 검증.',
		},
	];
}
