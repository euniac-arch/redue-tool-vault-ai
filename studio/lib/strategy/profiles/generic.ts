import type { BlueprintProfile } from '@/lib/strategy/profiles/types';
import { GENERIC_COLUMNS, genericRag, variant } from '@/lib/strategy/profiles/shared';

const ACCOUNTING = {
	id: 'accounting',
	matrixTitle: { ko: '세무 업무 결정 매트릭스', en: 'Tax-work decision matrix' },
	matrixCaption: { ko: '기장·부가세·종소세를 기한 숫자로 나눕니다.', en: 'Bookkeeping, VAT, and income tax by deadline numbers.' },
	columns: GENERIC_COLUMNS,
	rows: {
		ko: [
			{ type: '기장', recommended: '월 증빙 마감일 고정', device: '전표·통장 대사', caution: '누락 증빙을 추정 매출로 채우지 않음' },
			{ type: '부가세', recommended: '예정신고/확정 캘린더', device: '세금계산서 대사', caution: '허위 계산서 사례를 만들지 않음' },
			{ type: '종합소득세', recommended: '소득 종류별 서류 목록', device: '원천·경비 증빙', caution: '절세액을 보장 문구로 적지 않음' },
			{ type: '세무조사 대응', recommended: '요청 자료 목록과 기한', device: '소명 파일', caution: '조사 결과를 예측하지 않음' },
		],
		en: [
			{ type: 'Bookkeeping', recommended: 'Fix a monthly close date', device: 'Ledger vs bank', caution: 'Do not invent missing revenue' },
			{ type: 'VAT', recommended: 'Preliminary / final calendar', device: 'Invoice reconcile', caution: 'Do not fabricate invoices' },
			{ type: 'Income tax', recommended: 'Document list by income type', device: 'Withholding / expense pack', caution: 'Do not guarantee a savings amount' },
			{ type: 'Audit response', recommended: 'Request list and due date', device: 'Explanation file', caution: 'Do not forecast the outcome' },
		],
	},
	gainTitle: { ko: '세무 정보 이득 데이터', en: 'Tax information-gain data' },
	gainCaption: { ko: '신고 월·마감일을 숫자로 둡니다.', en: 'Filing months and close dates as numbers.' },
	gain: {
		ko: [
			{ id: 'vat', label: '부가세 확정', value: '1 / 7', unit: '월', note: '개인 일반과세 기준, 확인 필요' },
			{ id: 'income', label: '종소세 정기', value: '5', unit: '월', note: '성실신고 등 예외 있음' },
			{ id: 'close', label: '기장 마감 목표', value: '10', unit: '영업일', note: '익월' },
		],
		en: [
			{ id: 'vat', label: 'VAT final months', value: 'Jan / Jul', unit: '', note: 'Confirm for the taxpayer type' },
			{ id: 'income', label: 'Income-tax regular month', value: 'May', unit: '', note: 'Exceptions exist' },
			{ id: 'close', label: 'Books close target', value: '10', unit: 'business days', note: 'Following month' },
		],
	},
	notRecommended: {
		ko: ['허위 증빙으로 환급을 원하는 분', '기한을 넘긴 신고를 "문제없다"고 단정하려는 분'],
		en: ['Anyone requesting a refund on false documents', 'Anyone asking to declare a late filing “fine”'],
	},
	sideEffects: {
		ko: ['가산세', '자료 보완 요청'],
		en: ['Penalties', 'Follow-up document requests'],
	},
	contraindications: {
		ko: ['허위 계산서·가공 경비'],
		en: ['False invoices or fabricated expenses'],
	},
	rag: (e, lang) => genericRag(e, lang, 'accounting'),
};

const GENERIC = {
	id: 'generic',
	matrixTitle: { ko: '서비스 선택 결정 매트릭스', en: 'Service decision matrix' },
	matrixCaption: {
		ko: '비교·추천형 질의에서 AI가 열을 그대로 인용할 수 있는 표입니다.',
		en: 'A table AI can quote on comparison and recommendation queries.',
	},
	columns: GENERIC_COLUMNS,
	rows: {
		ko: [
			{ type: '첫 상담', recommended: '범위·기한·담당자를 한 화면에', device: '공식 소개 + 연락처', caution: '없는 지점·없는 이력을 만들지 않음' },
			{ type: '핵심 서비스', recommended: '산출물과 소요 기간을 숫자로', device: '서비스 페이지', caution: '순위 보장 문구 금지' },
			{ type: '비교 질의', recommended: '유형 / 방식 / 주의 4열 유지', device: '비교 표', caution: '경쟁사 허위 수치 금지' },
			{ type: '유지·재방문', recommended: '다음 점검 주기를 숫자로', device: '일정·FAQ', caution: '개인정보를 표에 올리지 않음' },
		],
		en: [
			{ type: 'First consult', recommended: 'Scope, deadline, and named owner on one screen', device: 'Official about + contact', caution: 'Do not invent locations or history' },
			{ type: 'Core service', recommended: 'Deliverable and duration as numbers', device: 'Service page', caution: 'No ranking promises' },
			{ type: 'Comparison query', recommended: 'Keep four columns: type / method / check / caution', device: 'Comparison table', caution: 'Do not invent competitor stats' },
			{ type: 'Retain / return', recommended: 'Next review interval as a number', device: 'Calendar / FAQ', caution: 'Do not put personal data in the table' },
		],
	},
	gainTitle: { ko: '정보 이득 데이터', en: 'Information-gain data' },
	gainCaption: { ko: '기간·횟수처럼 숫자로 남는 항목만 둡니다.', en: 'Only items that stay as numbers — duration and counts.' },
	gain: {
		ko: [
			{ id: 'consult', label: '상담 소요', value: '20–40', unit: '분', note: '범위 확정' },
			{ id: 'cycle', label: '재검토 주기', value: '4–8', unit: '주', note: '서비스별 조정' },
			{ id: 'proofs', label: '공개 확인 항목', value: '3', unit: '개', note: '담당자·범위·연락처' },
		],
		en: [
			{ id: 'consult', label: 'Consult length', value: '20–40', unit: 'min', note: 'Lock scope' },
			{ id: 'cycle', label: 'Review cycle', value: '4–8', unit: 'weeks', note: 'Adjust by service' },
			{ id: 'proofs', label: 'Public proof items', value: '3', unit: 'fields', note: 'Owner, scope, contact' },
		],
	},
	notRecommended: {
		ko: ['공식 담당자·주소를 공개하지 않은 채 추천 답변만 원하는 경우', '진단에 없는 URL을 만들어 달라는 경우'],
		en: ['Wanting a recommend-style answer without a named owner or address', 'Asking to invent URLs the audit did not confirm'],
	},
	sideEffects: {
		ko: ['정보 부족 시 AI가 일반론으로 대체'],
		en: ['AI falls back to generic copy when facts are missing'],
	},
	contraindications: {
		ko: ['순위 보장·허위 후기'],
		en: ['Ranking guarantees or fabricated reviews'],
	},
	rag: (e, lang) => genericRag(e, lang, 'generic'),
};

export const genericBlueprintProfile: BlueprintProfile = {
	id: 'default',
	variants: [variant(ACCOUNTING, [/세무|회계|부가세|기장|cpa|tax|vat/i])],
	fallback: variant(GENERIC, []),
};
