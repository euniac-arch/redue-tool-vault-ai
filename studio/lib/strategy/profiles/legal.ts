import type { BlueprintProfile } from '@/lib/strategy/profiles/types';
import { GENERIC_COLUMNS, genericRag, variant } from '@/lib/strategy/profiles/shared';

const LEGAL = {
	id: 'legal',
	matrixTitle: { ko: '법률 서비스 결정 매트릭스', en: 'Legal-service decision matrix' },
	matrixCaption: { ko: '상담·자문·소송을 기간과 산출물로 나눕니다.', en: 'Consult, counsel, and litigation by time and deliverable.' },
	columns: GENERIC_COLUMNS,
	rows: {
		ko: [
			{ type: '초기 상담', recommended: '쟁점 3개와 기한 확인', device: '상담 기록·일정표', caution: '승소 보장을 적지 않음' },
			{ type: '계약·자문', recommended: '조항 단위 서면 의견', device: '의견서 / 계약 개정안', caution: '구두 합의만으로 끝내지 않음' },
			{ type: '소송·심판', recommended: '관할·소멸시효·증거 목록', device: '소장·답변서 일정', caution: '상대방 개인정보를 페이지에 올리지 않음' },
			{ type: '집행·합의', recommended: '이행 기한과 담보', device: '합의서 / 강제집행 목록', caution: '합의금 액수를 허위 사례로 적지 않음' },
		],
		en: [
			{ type: 'Intake consult', recommended: 'Name 3 issues and a deadline', device: 'Consult note / timeline', caution: 'Do not promise a win' },
			{ type: 'Counsel / contracts', recommended: 'Clause-level written opinion', device: 'Memo / redline', caution: 'Do not close on oral terms only' },
			{ type: 'Litigation', recommended: 'Venue, limitation, exhibit list', device: 'Complaint / answer calendar', caution: 'Do not publish the other party’s personal data' },
			{ type: 'Settlement / enforcement', recommended: 'Deadline and security', device: 'Settlement / enforcement list', caution: 'Do not invent settlement figures' },
		],
	},
	gainTitle: { ko: '법률 정보 이득 데이터', en: 'Legal information-gain data' },
	gainCaption: { ko: '시효·응답일 등 숫자 가능한 항목만 둡니다.', en: 'Limitation periods and response days only.' },
	gain: {
		ko: [
			{ id: 'consult', label: '초기 상담', value: '40–60', unit: '분', note: '쟁점 정리' },
			{ id: 'civil-limit', label: '일반 민사 시효 검토', value: '3 / 10', unit: '년', note: '사안별 확인' },
			{ id: 'answer', label: '소장 후 응답 창', value: '30', unit: '일', note: '절차에 따라 다름' },
		],
		en: [
			{ id: 'consult', label: 'Intake consult', value: '40–60', unit: 'min', note: 'Issue map' },
			{ id: 'civil-limit', label: 'Civil limitation review', value: '3 / 10', unit: 'years', note: 'Confirm per matter' },
			{ id: 'answer', label: 'Response window', value: '30', unit: 'days', note: 'Procedure-dependent' },
		],
	},
	notRecommended: {
		ko: ['이해충돌이 확인된 상대방 사건', '형사 피의자인데 웹 상담만으로 진술을 남기려는 분'],
		en: ['Matters with a confirmed conflict', 'Criminal suspects leaving statements in a web form only'],
	},
	sideEffects: {
		ko: ['일정 지연', '상대방 대응에 따른 비용 증가'],
		en: ['Schedule slip', 'Cost increase from the other side’s moves'],
	},
	contraindications: {
		ko: ['수임 전 비밀이 깨진 채널에서의 구체 사실 공개'],
		en: ['Publishing case facts on a non-confidential channel before engagement'],
	},
	rag: (e, lang) => genericRag(e, lang, 'legal'),
};

export const legalBlueprintProfile: BlueprintProfile = {
	id: 'legal',
	variants: [variant(LEGAL, [/변호|법률|로펌|소송|계약|attorney|lawyer|litigation/i])],
	fallback: variant(LEGAL, []),
};
