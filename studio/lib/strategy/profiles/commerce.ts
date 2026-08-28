import type { BlueprintProfile } from '@/lib/strategy/profiles/types';
import { GENERIC_COLUMNS, genericRag, variant } from '@/lib/strategy/profiles/shared';

const BEAUTY = {
	id: 'beauty',
	matrixTitle: { ko: '뷰티 시술 결정 매트릭스', en: 'Beauty-service decision matrix' },
	matrixCaption: { ko: '시간·유지 기간을 숫자로 비교합니다.', en: 'Time and wear period as numbers.' },
	columns: GENERIC_COLUMNS,
	rows: {
		ko: [
			{ type: '컷', recommended: '얼굴형·모량 기록 후 진행', device: '상담 카드 + 시술 시간', caution: '트렌드명만 적고 길이를 cm로 남기지 않기' },
			{ type: '컬러', recommended: '손상도·목표 레벨 명시', device: '탈색 횟수 / 염모제', caution: '두피 염증 시 연기' },
			{ type: '펌', recommended: '모발 굵기별 로드·시간', device: '펌제 + 중화', caution: '당일 중복 탈색과 병행하지 않음' },
			{ type: '케어', recommended: '주기(주)를 숫자로 제안', device: '트리트먼트 프로토콜', caution: '의료 진단처럼 적지 않음' },
		],
		en: [
			{ type: 'Cut', recommended: 'Record face shape and density', device: 'Consult card + minutes', caution: 'Do not leave length unnamed' },
			{ type: 'Color', recommended: 'State damage and target level', device: 'Lightener count / dye', caution: 'Defer if the scalp is inflamed' },
			{ type: 'Perm', recommended: 'Rod and time by hair diameter', device: 'Perm + neutralizer', caution: 'Do not bleach the same day' },
			{ type: 'Care', recommended: 'Propose interval in weeks', device: 'Treatment protocol', caution: 'Do not write it as a medical diagnosis' },
		],
	},
	gainTitle: { ko: '뷰티 정보 이득 데이터', en: 'Beauty information-gain data' },
	gainCaption: { ko: '시술 분·유지 주만 숫자로 둡니다.', en: 'Minutes and wear weeks only.' },
	gain: {
		ko: [
			{ id: 'cut', label: '컷 소요', value: '40–70', unit: '분', note: '상담 포함' },
			{ id: 'color', label: '컬러 소요', value: '90–180', unit: '분', note: '탈색 횟수에 따름' },
			{ id: 'wear', label: '펌 유지', value: '8–12', unit: '주', note: '모질에 따름' },
		],
		en: [
			{ id: 'cut', label: 'Cut time', value: '40–70', unit: 'min', note: 'Includes consult' },
			{ id: 'color', label: 'Color time', value: '90–180', unit: 'min', note: 'By lightener passes' },
			{ id: 'wear', label: 'Perm wear', value: '8–12', unit: 'weeks', note: 'By hair quality' },
		],
	},
	notRecommended: {
		ko: ['두피 염증·상처가 있는 상태에서 펌·탈색을 원하는 분', '알레르기 패치 테스트를 거부하는 분'],
		en: ['Perm or bleach over an inflamed or broken scalp', 'Anyone refusing an allergy patch test when indicated'],
	},
	sideEffects: {
		ko: ['일시 자극', '건조·탈색 손상'],
		en: ['Transient irritation', 'Dryness or bleach damage'],
	},
	contraindications: {
		ko: ['개방 상처 위 화학 시술'],
		en: ['Chemical service over an open wound'],
	},
	rag: (e, lang) => genericRag(e, lang, 'beauty'),
};

const COMMERCE = {
	id: 'commerce',
	matrixTitle: { ko: '상품·매장 결정 매트릭스', en: 'Commerce decision matrix' },
	matrixCaption: {
		ko: '구성·배송·반품을 숫자로 남겨 AI가 상점 페이지를 인용하게 합니다.',
		en: 'Bundle, ship, and return as numbers so AI can cite the store page.',
	},
	columns: GENERIC_COLUMNS,
	rows: {
		ko: [
			{ type: '구성 비교', recommended: '용량·구성·대상 사용자를 4열로', device: '스펙 표', caution: '없는 인증·수상을 만들지 않음' },
			{ type: '가격', recommended: '기본가와 포함 항목을 숫자로', device: '가격 카드', caution: '허위 할인율 금지' },
			{ type: '배송', recommended: '출고 영업일과 권역을 명시', device: '배송 안내', caution: '전국 당일을 단정하지 않음' },
			{ type: '반품·교환', recommended: '신청 기한을 일 수로', device: '반품 FAQ', caution: '위생 상품 예외를 숨기지 않음' },
		],
		en: [
			{ type: 'Bundle compare', recommended: 'Size, contents, and who it is for in four columns', device: 'Spec table', caution: 'Do not invent awards' },
			{ type: 'Price', recommended: 'Base price and what is included as numbers', device: 'Price card', caution: 'No fake discount rates' },
			{ type: 'Shipping', recommended: 'State business days and service area', device: 'Shipping note', caution: 'Do not claim nationwide same-day unless true' },
			{ type: 'Returns', recommended: 'Request window in days', device: 'Return FAQ', caution: 'Do not hide hygiene exceptions' },
		],
	},
	gainTitle: { ko: '커머스 정보 이득 데이터', en: 'Commerce information-gain data' },
	gainCaption: { ko: '출고일·반품 기한만 숫자로 둡니다.', en: 'Ship days and return windows only.' },
	gain: {
		ko: [
			{ id: 'ship', label: '출고', value: '1–3', unit: '영업일', note: '재고 있을 때' },
			{ id: 'return', label: '반품 신청', value: '7', unit: '일', note: '수령 후, 상품군 확인' },
			{ id: 'cs', label: '문의 응답', value: '1', unit: '영업일', note: '공식 채널' },
		],
		en: [
			{ id: 'ship', label: 'Dispatch', value: '1–3', unit: 'business days', note: 'When in stock' },
			{ id: 'return', label: 'Return window', value: '7', unit: 'days', note: 'After receipt; confirm category' },
			{ id: 'cs', label: 'Support reply', value: '1', unit: 'business day', note: 'Official channel' },
		],
	},
	notRecommended: {
		ko: ['재고·가격을 확인하지 않은 채 추천 답변만 원하는 경우', '위생상 반품 불가 상품을 무조건 환불로 단정하는 경우'],
		en: ['Wanting a recommend-style answer without checking stock or price', 'Promising a refund on a non-returnable hygiene item'],
	},
	sideEffects: {
		ko: ['품절 시 출고 지연', '권역 밖 추가 배송일'],
		en: ['Dispatch slip when out of stock', 'Extra days outside the service area'],
	},
	contraindications: {
		ko: ['허위 재고·허위 할인'],
		en: ['Fake stock or fake discounts'],
	},
	rag: (e, lang) => genericRag(e, lang, 'commerce'),
};

export const commerceBlueprintProfile: BlueprintProfile = {
	id: 'commerce',
	variants: [
		variant(BEAUTY, [/미용|헤어|펌|염색|salon|haircut/i]),
		variant(COMMERCE, [/배송|반품|가격|맛집|부동산|인테리어|restaurant|realtor/i]),
	],
	fallback: variant(COMMERCE, []),
};
