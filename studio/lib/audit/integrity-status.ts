/**
 * Score-band labels for the "AI 데이터 무결성 검증" card.
 * Client-safe — do not import Node-only modules here.
 */

export type IntegrityGrade = 'PERFECT' | 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';

export interface IntegrityStatus {
	status: string;
	grade: IntegrityGrade;
	color: string;
	icon: string;
	desc: string;
}

/**
 * 100 is the only PERFECT band — 90s must not collapse into "완벽 정합".
 */
export function getIntegrityStatus(score: number): IntegrityStatus {
	const clamped = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
	if (clamped === 100) {
		return {
			status: '완벽 정합',
			grade: 'PERFECT',
			color: '#10B981',
			icon: '🟢',
			desc: '스키마와 웹사이트 본문 데이터가 100% 완벽하게 일치합니다.',
		};
	}
	if (clamped >= 90) {
		return {
			status: '우수 정합',
			grade: 'EXCELLENT',
			color: '#059669',
			icon: '🟢',
			desc: '핵심 데이터가 매우 우수하게 일치하며, 미세한 권장 개선 사항만 존재합니다.',
		};
	}
	if (clamped >= 70) {
		return {
			status: '양호 정합',
			grade: 'GOOD',
			color: '#F59E0B',
			icon: '🟡',
			desc: '기본적인 정합성은 확보되었으나, 일부 메타/속성 보완이 권장됩니다.',
		};
	}
	if (clamped >= 50) {
		return {
			status: '주의 필요',
			grade: 'WARNING',
			color: '#F97316',
			icon: '🟠',
			desc: '스키마와 실제 웹사이트 내용 간 주요 불일치 요소가 발견되었습니다.',
		};
	}
	return {
		status: '정합 불량',
		grade: 'CRITICAL',
		color: '#EF4444',
		icon: '🔴',
		desc: '스키마 누락 또는 본문과의 심각한 데이터 불일치가 감지되었습니다.',
	};
}
