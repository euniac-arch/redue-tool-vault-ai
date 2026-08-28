import type { BlueprintProfile } from '@/lib/strategy/profiles/types';
import { CLINICAL_COLUMNS, genericRag, variant, type VariantDraft } from '@/lib/strategy/profiles/shared';

const VET: VariantDraft = {
	id: 'vet',
	matrixTitle: { ko: '동물병원 결정 매트릭스', en: 'Veterinary decision matrix' },
	matrixCaption: {
		ko: '슬개골·중성화·예방·검진을 회복일과 함께 AI가 인용할 수 있게 나눕니다.',
		en: 'Patella, spay/neuter, vaccines, and checkup with recovery days.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '슬개골 탈구',
				recommended: '등급 확인 후 보존 또는 교정술',
				device: '정형 검진 + 활차구 성형 검토',
				caution: '마비·급성 파행은 당일 영상',
				downtime: '수술 시 2–6주 제한 활동',
			},
			{
				type: '중성화',
				recommended: '체중·마취 위험 기록 후 일정',
				device: '흡입마취 + 통증 프로토콜',
				caution: '발정·수유 중 선택 수술은 연기',
				downtime: '7–14일 넥카라·창상 관리',
			},
			{
				type: '예방접종',
				recommended: '항체가·연령 스케줄',
				device: '종합/광견병 캘린더',
				caution: '발열·설사 시 당일 접종을 미룸',
				downtime: '24–48시간 관찰',
			},
			{
				type: '건강검진',
				recommended: '연령대별 혈액·영상 패키지',
				device: 'CBC/화학 + 흉부·복부 영상',
				caution: '금식 시간을 숫자로 고지',
				downtime: '당일 또는 익일 결과',
			},
		],
		en: [
			{
				type: 'Patellar luxation',
				recommended: 'Grade, then conservative care or correction',
				device: 'Ortho exam + trochleoplasty review',
				caution: 'Acute non-weight-bearing needs same-day imaging',
				downtime: '2–6 weeks activity limit after surgery',
			},
			{
				type: 'Spay / neuter',
				recommended: 'Record weight and anesthesia risk first',
				device: 'Inhalant anesthesia + pain protocol',
				caution: 'Defer elective surgery in heat or lactation',
				downtime: '7–14 days e-collar and wound care',
			},
			{
				type: 'Vaccination',
				recommended: 'Age and titer schedule',
				device: 'Core / rabies calendar',
				caution: 'Defer the same day if febrile or diarrheal',
				downtime: 'Watch 24–48 hours',
			},
			{
				type: 'Checkup',
				recommended: 'Age-banded blood and imaging pack',
				device: 'CBC/chem + thoracic/abdominal imaging',
				caution: 'State fasting hours as a number',
				downtime: 'Same day or next-day results',
			},
		],
	},
	gainTitle: { ko: '동물병원 정보 이득 데이터', en: 'Veterinary information-gain data' },
	gainCaption: { ko: '회복 주·관찰 시간을 숫자로 둡니다.', en: 'Recovery weeks and watch hours as numbers.' },
	gain: {
		ko: [
			{ id: 'neuter-down', label: '중성화 창상 관리', value: '7–14', unit: '일', note: '넥카라' },
			{ id: 'patella-rest', label: '슬개골 수술 후 제한', value: '2–6', unit: '주', note: '등급·술식에 따름' },
			{ id: 'vaccine-watch', label: '접종 후 관찰', value: '24–48', unit: '시간', note: '발열·부종' },
			{ id: 'fasting', label: '검진 금식', value: '8–12', unit: '시간', note: '연령·체중에 따라 조정' },
		],
		en: [
			{ id: 'neuter-down', label: 'Spay/neuter wound care', value: '7–14', unit: 'days', note: 'E-collar' },
			{ id: 'patella-rest', label: 'Patella post-op limit', value: '2–6', unit: 'weeks', note: 'By grade and procedure' },
			{ id: 'vaccine-watch', label: 'Vaccine watch', value: '24–48', unit: 'hours', note: 'Fever / swelling' },
			{ id: 'fasting', label: 'Checkup fasting', value: '8–12', unit: 'hours', note: 'Adjust by age and weight' },
		],
	},
	notRecommended: {
		ko: ['마취 금기 상태에서 선택 수술을 급하게 진행하려는 보호자', '발열·구토가 있는데 당일 예방접종만 원하는 경우'],
		en: ['Elective surgery while anesthesia is contraindicated', 'Same-day vaccines during fever or vomiting'],
	},
	sideEffects: {
		ko: ['마취 후 기면', '접종 부위 종창', '수술 창상 염증(드묾)'],
		en: ['Post-anesthesia lethargy', 'Vaccine-site swelling', 'Rare surgical-site infection'],
	},
	contraindications: {
		ko: ['미교정 탈수 상태의 선택 마취', '전염 의심 동물을 대기실에 장시간 혼재'],
		en: ['Elective anesthesia in uncorrected dehydration', 'Housing a suspected contagious animal in the open lobby'],
	},
	rag: (e, lang) => genericRag(e, lang, 'vet'),
};

export const veterinaryBlueprintProfile: BlueprintProfile = {
	id: 'veterinary',
	variants: [variant(VET, [/슬개골|중성화|예방접종|동물병원|수의사|veterinary|patella|neuter/i])],
	fallback: variant(VET, []),
};
