/**
 * Owner-facing 30-second diagnosis copy.
 * Hardcoded so next-intl never leaks `audit.businessImpact.*` keys
 * (ICU placeholders + stale message cache).
 */

import type { ImpactCardId, ImpactTone } from '@/lib/audit/business-impact-cards';
import { withHonorific, withJosa } from '@/lib/korean-josa';
import type { SeverityLevel } from '@/types/quick-hook-report';

export type ImpactCopyLang = 'ko' | 'en';

type ToneCopy = Record<ImpactTone, string>;

interface CardCopy {
	title: string;
	loss: ToneCopy;
	/** Phrase inside `loss` to bold for scanability. */
	lossEmphasis: ToneCopy;
	cause: ToneCopy;
	rx: ToneCopy;
}

interface BusinessImpactCopy {
	/** `{role}` is replaced by the honorific role (e.g. 대표님을 / the CEO). */
	title: string;
	subtitle: string;
	empty: string;
	severity: Record<SeverityLevel, string>;
	columns: { impact: string; loss: string; cause: string; rx: string };
	step: { loss: string; cause: string; rx: string };
	cards: Record<ImpactCardId, CardCopy>;
}

export const BUSINESS_IMPACT_COPY: Record<ImpactCopyLang, BusinessImpactCopy> = {
	ko: {
		title: '{role} 위한 30초 비즈니스 임팩트 요약',
		subtitle: '핵심 결함이 실제 매출 및 브랜드 신뢰도에 미치는 영향과 조치 결과입니다.',
		empty: '현재 진단에서 표시할 비즈니스 임팩트 항목이 없습니다.',
		severity: {
			critical: '치명적',
			major: '주요',
			warning: '주의',
			info: '양호',
		},
		columns: {
			impact: '심각도/영향 영역',
			loss: '예상 비즈니스 손실',
			cause: '기술적 원인',
			rx: 'GEO 처방 효과',
		},
		step: {
			loss: '손실',
			cause: '원인',
			rx: '처방',
		},
		cards: {
			patientLeak: {
				title: '잠재 신규 고객 유출',
				loss: {
					critical: '주요 업종/지역 AI 검색 시 추천 목록에서 제외되어 경쟁사로 고객 유출',
					partial: '주요 업종/지역 AI 검색에서 일부만 노출되어 1순위 추천은 경쟁사가 선점',
					healthy: '주요 업종/지역 AI 검색에서 인용 기반이 형성되어 추천 선점을 유지 중',
				},
				lossEmphasis: {
					critical: '경쟁사로 고객 유출',
					partial: '1순위 추천은 경쟁사가 선점',
					healthy: '추천 선점을 유지 중',
				},
				cause: {
					critical: 'JSON-LD 구조화 데이터 0블록 (ChatGPT, Perplexity 파서 미인식)',
					partial: 'JSON-LD는 있으나 AI 파서가 브랜드 엔티티를 완전히 식별하지 못함',
					healthy: 'JSON-LD 블록이 감지되어 AI 파서가 기본 엔티티를 인식',
				},
				rx: {
					critical: '6대 AI 엔진 1~2순위 추천 인용 풀(Citation Pool) 진입',
					partial: '6대 AI 엔진 1~2순위 추천 인용 풀(Citation Pool) 진입',
					healthy: '6대 AI 엔진 1~2순위 추천 인용 풀을 유지·확대',
				},
			},
			trustUndervalued: {
				title: '브랜드 신뢰도 & 권위 저평가',
				loss: {
					critical: '대표 이력 및 사업자 신뢰도가 AI 지식그래프에 반영되지 않아 방어력 취약',
					partial: '전문성 신호가 일부만 연결되어 알고리즘 업데이트 시 순위 방어력이 흔들릴 수 있음',
					healthy: '공식 엔티티 신호가 지식그래프에 연결되어 순위 방어력을 유지 중',
				},
				lossEmphasis: {
					critical: '방어력 취약',
					partial: '순위 방어력이 흔들릴 수 있음',
					healthy: '순위 방어력을 유지 중',
				},
				cause: {
					critical: 'Organization 스키마 필수 속성 누락 및 4대 포털 지도 NAP 미연동',
					partial: 'Organization 속성이 일부만 채워져 지식그래프 매칭이 불완전',
					healthy: 'Organization 필수 속성과 NAP 연동이 확인된 상태',
				},
				rx: {
					critical: '공식 브랜드 E-E-A-T 지식그래프 등록 및 검색 알고리즘 리스크 방어',
					partial: '공식 브랜드 E-E-A-T 지식그래프 등록 및 검색 알고리즘 리스크 방어',
					healthy: 'E-E-A-T 지식그래프를 유지해 검색 알고리즘 리스크를 계속 방어',
				},
			},
			conversionDrop: {
				title: '모바일 탐색 및 문의 전환 실패',
				loss: {
					critical: '유입된 잠재 고객이 모바일 환경 가독성 저하로 문의 전 이탈',
					partial: '유입된 잠재 고객 일부가 모바일 가독성 저하로 문의 직전에 이탈',
					healthy: '모바일 가독성 신호가 양호하며 체류·문의 전환을 유지 중',
				},
				lossEmphasis: {
					critical: '문의 전 이탈',
					partial: '문의 직전에 이탈',
					healthy: '체류·문의 전환을 유지 중',
				},
				cause: {
					critical: '모바일 뷰포트 인덱싱 및 메타 태그 최적화 결함',
					partial: '모바일 뷰포트·메타 태그 최적화가 일부만 적용되어 보완 필요',
					healthy: '모바일 뷰포트 인덱싱과 메타 태그 신호가 기준선을 충족',
				},
				rx: {
					critical: '모바일 체류 시간 향상 및 실제 문의/도입 전환율 극대화',
					partial: '모바일 체류 시간 향상 및 실제 문의/도입 전환율 극대화',
					healthy: '모바일 체류 시간과 문의/도입 전환율을 유지·확대',
				},
			},
		},
	},
	en: {
		title: '30-second business-impact summary for the {role}',
		subtitle: 'How the core defects affect revenue and brand trust — and what changes after the fix.',
		empty: 'No business-impact rows to show for this diagnosis.',
		severity: {
			critical: 'Critical',
			major: 'Major',
			warning: 'Caution',
			info: 'Healthy',
		},
		columns: {
			impact: 'Severity / impact area',
			loss: 'Expected business loss',
			cause: 'Technical cause',
			rx: 'GEO prescription effect',
		},
		step: {
			loss: 'Loss',
			cause: 'Cause',
			rx: 'Fix',
		},
		cards: {
			patientLeak: {
				title: 'Potential new-customer leakage',
				loss: {
					critical: 'Excluded from AI recommendation lists on core industry/region searches, so prospects go to competitors',
					partial: 'Only partly visible on core industry/region AI searches — competitors still own the #1 recommendation',
					healthy: 'A citation base is in place on core industry/region AI searches, holding the recommendation lead',
				},
				lossEmphasis: {
					critical: 'prospects go to competitors',
					partial: 'competitors still own the #1 recommendation',
					healthy: 'holding the recommendation lead',
				},
				cause: {
					critical: '0 JSON-LD structured-data blocks (ChatGPT and Perplexity parsers cannot recognize the site)',
					partial: 'JSON-LD exists, but AI parsers cannot fully identify the brand entity',
					healthy: 'JSON-LD blocks are detected, so AI parsers can read the core entity',
				},
				rx: {
					critical: 'Enter the top 1–2 citation pool across the six major AI engines',
					partial: 'Enter the top 1–2 citation pool across the six major AI engines',
					healthy: 'Hold and expand the top 1–2 citation pool across the six major AI engines',
				},
			},
			trustUndervalued: {
				title: 'Brand trust & authority undervalued',
				loss: {
					critical: 'Founder credentials and business trust are missing from the AI knowledge graph, so ranking defense is weak',
					partial: 'Only part of the expertise signal is connected, so rankings can slip on algorithm updates',
					healthy: 'The official entity is in the knowledge graph, holding ranking defense',
				},
				lossEmphasis: {
					critical: 'ranking defense is weak',
					partial: 'rankings can slip on algorithm updates',
					healthy: 'holding ranking defense',
				},
				cause: {
					critical: 'Required Organization schema properties missing, and NAP is not linked across the four major map portals',
					partial: 'Organization fields are only partly filled, so knowledge-graph matching stays incomplete',
					healthy: 'Organization required fields and NAP linkage are confirmed',
				},
				rx: {
					critical: 'Register the official brand E-E-A-T knowledge graph and defend against search-algorithm risk',
					partial: 'Register the official brand E-E-A-T knowledge graph and defend against search-algorithm risk',
					healthy: 'Keep the E-E-A-T knowledge graph current to keep defending search-algorithm risk',
				},
			},
			conversionDrop: {
				title: 'Mobile discovery & inquiry conversion failure',
				loss: {
					critical: 'Arriving prospects bounce before inquiring because mobile readability breaks down',
					partial: 'Some arriving prospects bounce just before inquiring because of weaker mobile readability',
					healthy: 'Mobile readability signals are solid, holding dwell time and inquiry conversion',
				},
				lossEmphasis: {
					critical: 'bounce before inquiring',
					partial: 'bounce just before inquiring',
					healthy: 'holding dwell time and inquiry conversion',
				},
				cause: {
					critical: 'Mobile viewport indexing and meta-tag optimization defects',
					partial: 'Mobile viewport and meta-tag optimization is only partly applied',
					healthy: 'Mobile viewport indexing and meta-tag signals meet the baseline',
				},
				rx: {
					critical: 'Increase mobile dwell time and maximize actual inquiry/adoption conversion',
					partial: 'Increase mobile dwell time and maximize actual inquiry/adoption conversion',
					healthy: 'Hold and grow mobile dwell time plus inquiry/adoption conversion',
				},
			},
		},
	},
};

export function businessImpactCopy(lang: string): BusinessImpactCopy {
	return BUSINESS_IMPACT_COPY[lang === 'en' ? 'en' : 'ko'];
}

/** Owner-facing heading — Korean `대표` always gets shared `님` + josa. */
export function businessImpactHeading(lang: string): string {
	const copy = businessImpactCopy(lang);
	const role = lang === 'en' ? 'CEO' : withJosa(withHonorific('대표', 'ko'), '을/를');
	return copy.title.replace('{role}', role);
}
