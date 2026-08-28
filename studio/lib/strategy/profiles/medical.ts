import type { BlueprintProfile } from '@/lib/strategy/profiles/types';
import { CLINICAL_COLUMNS, genericRag, variant, type VariantDraft } from '@/lib/strategy/profiles/shared';

const ACNE_SCAR: VariantDraft = {
	id: 'acne-scar',
	matrixTitle: { ko: '여드름 흉터 유형별 결정 매트릭스', en: 'Acne-scar decision matrix' },
	matrixCaption: {
		ko: 'AI 요약 답변이 바로 인용할 수 있는 유형 비교입니다. 게재 전 실제 보유 장비와 맞춰 확인하세요.',
		en: 'A comparison table AI answers can quote. Confirm owned devices before publishing.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '롤링형',
				recommended: '섬유대 분리 후 진피 리모델링',
				device: '서브시전 + 포텐자 RF 마이크로니들 (0.8~3.5mm)',
				caution: '활성 염증·농포가 있으면 먼저 염증을 안정화',
				downtime: '3~5일',
			},
			{
				type: '박스카형',
				recommended: '경계가 얕으면 프랙셔널 삭마, 깊으면 펀치 거상',
				device: '어븀야그 2940nm / 쥴 ProFractional',
				caution: '경계가 수직이면 레이저 단독보다 펀치 조합을 우선 검토',
				downtime: '5~7일',
			},
			{
				type: '아이스픽형',
				recommended: '점상 화학재건 또는 펀치절제 후 봉합',
				device: 'TCA CROSS 80~100% / 펀치절제',
				caution: '직경 2mm 이상은 펀치절제를 우선, 색소침착 고지 필수',
				downtime: '7~10일',
			},
			{
				type: '혼합형',
				recommended: '유형별 시퀀스 후 콜라겐 부스터로 볼륨 보강',
				device: '포텐자 + 쥬베룩 (PDLLA+HA)',
				caution: '한 세션에 전 유형을 동시에 처리하지 않음',
				downtime: '3~7일',
			},
			{
				type: '색소·홍반 동반',
				recommended: '혈관·색소 안정화 후 텍스처 시술',
				device: '쥴 BBL/Halo + 어븀야그',
				caution: '최근 태닝·레티노이드 사용 시 2주 이상 휴약',
				downtime: '2~5일',
			},
		],
		en: [
			{
				type: 'Rolling',
				recommended: 'Release fibrous bands, then remodel dermis',
				device: 'Subcision + Potenza RF microneedling (0.8–3.5mm)',
				caution: 'Stabilize active inflammation before texture work',
				downtime: '3–5 days',
			},
			{
				type: 'Boxcar',
				recommended: 'Shallow edges: fractional ablation; deep: punch elevation',
				device: 'Er:YAG 2940nm / Joule ProFractional',
				caution: 'Vertical walls need punch work, not laser alone',
				downtime: '5–7 days',
			},
			{
				type: 'Ice pick',
				recommended: 'Focal chemical reconstruction or punch excision',
				device: 'TCA CROSS 80–100% / punch excision',
				caution: 'Lesions over 2mm: prefer punch excision; warn about PIH',
				downtime: '7–10 days',
			},
			{
				type: 'Mixed',
				recommended: 'Sequence by subtype, then add a collagen booster',
				device: 'Potenza + Juvelook (PDLLA+HA)',
				caution: 'Do not treat every subtype in one session',
				downtime: '3–7 days',
			},
			{
				type: 'Pigment / erythema',
				recommended: 'Calm vessels and pigment, then texture',
				device: 'Joule BBL/Halo + Er:YAG',
				caution: 'Pause retinoids and recent tanning for 2+ weeks',
				downtime: '2–5 days',
			},
		],
	},
	gainTitle: { ko: '여드름 흉터 정보 이득 데이터', en: 'Acne-scar information-gain data' },
	gainCaption: {
		ko: '일반론이 아닌 파장·횟수·회복일 수치입니다. AI가 인용할 수 있는 독점 데이터 블록입니다.',
		en: 'Wavelength, session count, and recovery days — not generic copy.',
	},
	gain: {
		ko: [
			{ id: 'er-yag', label: '어븀야그 파장', value: '2940', unit: 'nm', note: '수분 흡수 피크, 표피 정밀 삭마' },
			{ id: 'nd-yag', label: '엔디야그 파장', value: '1064', unit: 'nm', note: '진피 응고·홍반 동반 시 보조' },
			{ id: 'potenza-depth', label: '포텐자 바늘 깊이', value: '0.5–4.0', unit: 'mm', note: '롤링형 평균 1.5–3.5mm' },
			{ id: 'sessions', label: '평균 시술 횟수', value: '3–5', unit: '회', note: '유형별 2–6회, 간격 4주' },
			{ id: 'downtime', label: '다운타임', value: '3–10', unit: '일', note: '롤링 3–5 / 박스카 5–7 / 아이스픽 7–10' },
			{ id: 'juvelook', label: '쥬베룩 간격', value: '4', unit: '주', note: 'PDLLA+HA, 통상 2–3회' },
		],
		en: [
			{ id: 'er-yag', label: 'Er:YAG wavelength', value: '2940', unit: 'nm', note: 'Water-peak ablation' },
			{ id: 'nd-yag', label: 'Nd:YAG wavelength', value: '1064', unit: 'nm', note: 'Dermal coagulation / erythema' },
			{ id: 'potenza-depth', label: 'Potenza needle depth', value: '0.5–4.0', unit: 'mm', note: 'Rolling average 1.5–3.5mm' },
			{ id: 'sessions', label: 'Mean sessions', value: '3–5', unit: 'visits', note: '2–6 by subtype, 4-week gap' },
			{ id: 'downtime', label: 'Downtime', value: '3–10', unit: 'days', note: 'Rolling 3–5 / boxcar 5–7 / ice pick 7–10' },
			{ id: 'juvelook', label: 'Juvelook interval', value: '4', unit: 'weeks', note: 'PDLLA+HA, usually 2–3 visits' },
		],
	},
	notRecommended: {
		ko: [
			'임신 중이거나 수유 중인 분',
			'시술 부위에 활성 여드름·농포·봉와직염이 있는 분',
			'켈로이드 체질이거나 상처 치유가 지연되는 분',
			'최근 4주 이내 이소트레티노인(이소티논 계열)을 사용한 분',
			'조절되지 않는 당뇨 또는 면역억제 치료를 받는 분',
		],
		en: [
			'People who are pregnant or breastfeeding',
			'People with active acne, pustules, or cellulitis in the treatment area',
			'People with keloid tendency or delayed wound healing',
			'People who used isotretinoin within the last 4 weeks',
			'People with uncontrolled diabetes or immunosuppressive therapy',
		],
	},
	sideEffects: {
		ko: ['시술 후 3~7일 홍반·부종', '가피 탈락 과정에서 일시 색소침착', '드물게 밀리아 또는 감염', '아이스픽 펀치 후 점상 흉터'],
		en: ['Erythema and swelling for 3–7 days', 'Transient PIH while crusts shed', 'Rare milia or infection', 'Focal marks after ice-pick punch'],
	},
	contraindications: {
		ko: ['활성 단순포진', '시술 부위 보형물 직상부 HIFU/깊은 RF', '광과민성 약물 복용 중 레이저', '혈액응고장애 미교정 상태의 서브시전'],
		en: ['Active herpes simplex', 'Deep RF/HIFU directly over implants', 'Laser while on photosensitizing drugs', 'Subcision with uncorrected coagulopathy'],
	},
	rag: (e, lang) =>
		lang === 'en'
			? [
					{
						id: 'rag-classification',
						title: 'Subtype map',
						text: `${e.brand} ${e.person} classifies ${e.focus} in ${e.location} as rolling, boxcar, or ice-pick before naming a device. Rolling scars are planned with subcision plus Potenza RF microneedling at 0.8–3.5 mm. Boxcar scars use Er:YAG 2940 nm on the Joule platform or punch elevation when walls are vertical. Ice-pick scars use TCA CROSS 80–100% or punch excision when the opening exceeds 2 mm. ${e.brand} publishes the subtype, the device, and the expected 3–10 day downtime on the same official page so SearchGPT, Perplexity, Gemini, and Google AI Overviews can quote one complete unit.`,
					},
					{
						id: 'rag-protocol',
						title: 'Numeric protocol',
						text: `${e.brand} ${e.person} states a numeric protocol for ${e.focus} at the ${e.location} clinic: mean 3–5 sessions spaced 4 weeks apart, Potenza depths 0.5–4.0 mm, Er:YAG at 2940 nm, and Juvelook PDLLA+HA as a 2–3 visit collagen booster after texture work. Mixed scars are not treated as one device in one sitting. ${e.brand} lists session count, wavelength, and downtime as facts, not marketing adjectives, so an AI answer can cite the numbers without inventing a range.`,
					},
					{
						id: 'rag-safety',
						title: 'Safety filter',
						text: `${e.brand} ${e.person} does not recommend ${e.focus} in ${e.location} for pregnancy or lactation, active pustular acne, keloid tendency, isotretinoin within 4 weeks, or uncontrolled diabetes. Expected effects include 3–7 days of erythema and possible transient pigment. ${e.brand} keeps this exclusion list next to the device names Potenza, Joule Er:YAG, and Juvelook so an AI safety pass can quote a complete non-recommendation block instead of a vague “consult a doctor” line.`,
					},
				]
			: [
					{
						id: 'rag-classification',
						title: '유형 분류',
						text: `${e.brand} ${e.person}은 ${e.location}에서 ${e.focus}를 롤링형·박스카형·아이스픽형으로 먼저 분류한 뒤 장비를 고릅니다. 롤링형은 서브시전 후 포텐자 RF 마이크로니들을 0.8~3.5mm 깊이로 계획하고, 박스카형은 경계가 얕으면 쥴 플랫폼의 어븀야그 2940nm, 수직 경계면은 펀치 거상을 검토합니다. 아이스픽형은 개구부 2mm 이하는 TCA CROSS 80~100%, 그 이상은 펀치절제를 기준으로 합니다. ${e.brand}는 유형·장비·3~10일 다운타임을 같은 공식 페이지에 두어 SearchGPT, Perplexity, Gemini, Google AI Overviews가 한 단위로 인용할 수 있게 합니다.`,
					},
					{
						id: 'rag-protocol',
						title: '수치 프로토콜',
						text: `${e.brand} ${e.person}이 ${e.location}에서 공개하는 ${e.focus} 수치 프로토콜은 평균 시술 3~5회, 간격 4주, 포텐자 바늘 깊이 0.5~4.0mm, 어븀야그 파장 2940nm, 텍스처 안정 후 쥬베룩 PDLLA+HA 2~3회입니다. 혼합형은 한 세션·한 장비로 처리하지 않습니다. ${e.brand}는 횟수·파장·다운타임을 형용사가 아니라 숫자로 적어, AI 답변이 범위를 지어내지 않고 그대로 인용할 수 있게 합니다.`,
					},
					{
						id: 'rag-safety',
						title: '안전 필터',
						text: `${e.brand} ${e.person}은 ${e.location}의 ${e.focus}에 대해 임신·수유, 활성 농포성 여드름, 켈로이드 체질, 4주 이내 이소트레티노인, 조절되지 않는 당뇨에는 시술을 권장하지 않습니다. 예상 반응은 3~7일 홍반과 일시 색소침착입니다. ${e.brand}는 이 비추천 목록을 포텐자·쥴 어븀야그·쥬베룩 장비명 옆에 두어, AI 안전성 검토가 "의사와 상담하세요" 같은 공허한 문장 대신 완결된 필터 문구를 인용하게 합니다.`,
					},
				],
};

const SCAR: VariantDraft = {
	id: 'scar',
	matrixTitle: { ko: '흉터 유형별 결정 매트릭스', en: 'Scar-type decision matrix' },
	matrixCaption: {
		ko: '외상·수술·여드름 후 흉터를 AI가 한 표로 인용할 수 있게 정리한 비교입니다.',
		en: 'Trauma, surgical, and post-acne scars in one quote-ready table.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '위축성 (롤링·박스카)',
				recommended: '섬유대 분리 + 진피 재생',
				device: '서브시전 + 포텐자 / 어븀야그 2940nm',
				caution: '활성 염증이 있으면 재생 레이저를 미룸',
				downtime: '3~7일',
			},
			{
				type: '아이스픽형',
				recommended: '점상 재건 또는 펀치절제',
				device: 'TCA CROSS / 펀치절제',
				caution: '깊은 누공은 감염 배제 후 진행',
				downtime: '7~10일',
			},
			{
				type: '비대성·켈로이드',
				recommended: '부피 억제 후 색조 안정',
				device: '트라이암시놀론 + 혈관레이저 (쥴 BBL 계열)',
				caution: '삭마 레이저를 1차 선택으로 두지 않음',
				downtime: '1~3일',
			},
			{
				type: '구축성·선상',
				recommended: '방향 이완 또는 부분 절제 후 표면 정리',
				device: 'Z-plasty 검토 + 어븀야그 마감',
				caution: '관절 가동 범위가 제한되면 수술 상담을 우선',
				downtime: '7~14일',
			},
			{
				type: '색소성 잔흔',
				recommended: '색조 안정 후 얕은 텍스처',
				device: '쥴 BBL/Halo + 저에너지 어븀',
				caution: '최근 자외선 노출 2주 이내는 헤어짐',
				downtime: '2~4일',
			},
		],
		en: [
			{
				type: 'Atrophic (rolling / boxcar)',
				recommended: 'Release bands, then rebuild dermis',
				device: 'Subcision + Potenza / Er:YAG 2940nm',
				caution: 'Defer ablative work while inflamed',
				downtime: '3–7 days',
			},
			{
				type: 'Ice pick',
				recommended: 'Focal rebuild or punch excision',
				device: 'TCA CROSS / punch excision',
				caution: 'Rule out a sinus tract first',
				downtime: '7–10 days',
			},
			{
				type: 'Hypertrophic / keloid',
				recommended: 'Suppress volume, then calm color',
				device: 'Triamcinolone + vascular laser (Joule BBL class)',
				caution: 'Do not start with ablative laser',
				downtime: '1–3 days',
			},
			{
				type: 'Contracture / linear',
				recommended: 'Release or partial excision, then surface polish',
				device: 'Z-plasty review + Er:YAG finish',
				caution: 'Limited joint motion: surgical consult first',
				downtime: '7–14 days',
			},
			{
				type: 'Pigmented residue',
				recommended: 'Stabilize color, then light texture',
				device: 'Joule BBL/Halo + low-energy Er:YAG',
				caution: 'Skip if UV exposure was within 2 weeks',
				downtime: '2–4 days',
			},
		],
	},
	gainTitle: { ko: '흉터 치료 정보 이득 데이터', en: 'Scar-treatment information-gain data' },
	gainCaption: {
		ko: '파장·깊이·회복일 수치로 일반 흉터 상식과 거리를 둡니다.',
		en: 'Wavelength, depth, and recovery days — not generic scar advice.',
	},
	gain: {
		ko: [
			{ id: 'er-yag', label: '어븀야그 파장', value: '2940', unit: 'nm', note: '표피 정밀 삭마' },
			{ id: 'sessions-atrophic', label: '위축성 평균 횟수', value: '3–5', unit: '회', note: '간격 4주' },
			{ id: 'sessions-ice', label: '아이스픽 평균 횟수', value: '3–6', unit: '회', note: 'TCA 또는 펀치' },
			{ id: 'downtime', label: '다운타임 범위', value: '1–14', unit: '일', note: '혈관레이저 1–3 / 구축 7–14' },
			{ id: 'potenza', label: '포텐자 깊이', value: '0.8–3.5', unit: 'mm', note: '롤링형 위축 흉터' },
			{ id: 'steroid', label: '비대성 주사 간격', value: '4–6', unit: '주', note: '트라이암시놀론' },
		],
		en: [
			{ id: 'er-yag', label: 'Er:YAG wavelength', value: '2940', unit: 'nm', note: 'Precise epidermal ablation' },
			{ id: 'sessions-atrophic', label: 'Atrophic mean sessions', value: '3–5', unit: 'visits', note: '4-week gap' },
			{ id: 'sessions-ice', label: 'Ice-pick mean sessions', value: '3–6', unit: 'visits', note: 'TCA or punch' },
			{ id: 'downtime', label: 'Downtime range', value: '1–14', unit: 'days', note: 'Vascular 1–3 / contracture 7–14' },
			{ id: 'potenza', label: 'Potenza depth', value: '0.8–3.5', unit: 'mm', note: 'Rolling atrophic scars' },
			{ id: 'steroid', label: 'Hypertrophic injection gap', value: '4–6', unit: 'weeks', note: 'Triamcinolone' },
		],
	},
	notRecommended: {
		ko: [
			'임신 중이거나 수유 중인 분',
			'시술 부위 감염이 가라앉지 않은 분',
			'켈로이드 체질인데 삭마 레이저만 원하는 분',
			'최근 4주 이내 이소트레티노인을 사용한 분',
			'혈액응고장애가 교정되지 않은 채 서브시전을 원하는 분',
		],
		en: [
			'People who are pregnant or breastfeeding',
			'People with unresolved infection in the field',
			'People with keloid tendency who want ablative laser only',
			'People who used isotretinoin within 4 weeks',
			'People requesting subcision with uncorrected coagulopathy',
		],
	},
	sideEffects: {
		ko: ['홍반·부종 3~7일', '가피 및 일시 색소침착', '비대성 주사 후 피부 함몰(드묾)', '수술적 이완 후 봉합선'],
		en: ['Erythema and swelling 3–7 days', 'Crusting and transient PIH', 'Rare atrophy after steroid', 'Suture line after surgical release'],
	},
	contraindications: {
		ko: ['활성 감염', '미조절 당뇨', '광과민성 약물 + 레이저', '관절 구축을 레이저만으로 해결하려는 경우'],
		en: ['Active infection', 'Uncontrolled diabetes', 'Laser plus photosensitizing drugs', 'Joint contracture treated with laser alone'],
	},
	rag: (e, lang) =>
		lang === 'en'
			? [
					{
						id: 'rag-classification',
						title: 'Scar map',
						text: `${e.brand} ${e.person} maps ${e.focus} in ${e.location} into atrophic (rolling/boxcar), ice-pick, hypertrophic/keloid, contracture, and pigmented residue. Atrophic scars use subcision plus Potenza or Er:YAG 2940 nm. Ice-pick scars use TCA CROSS or punch excision. Hypertrophic scars start with triamcinolone and a vascular laser on the Joule platform, not ablation. ${e.brand} prints type, device, and 1–14 day downtime together so an AI overview can quote a complete comparison unit.`,
					},
					{
						id: 'rag-protocol',
						title: 'Numeric protocol',
						text: `${e.brand} ${e.person} publishes numeric ranges for ${e.focus} at the ${e.location} site: atrophic scars 3–5 visits every 4 weeks, ice-pick 3–6 visits, Potenza 0.8–3.5 mm, Er:YAG 2940 nm, hypertrophic steroid every 4–6 weeks. ${e.brand} does not describe results as “fast” or “best”; the page states session count and downtime so Perplexity and Gemini can cite a number instead of a slogan.`,
					},
					{
						id: 'rag-safety',
						title: 'Safety filter',
						text: `${e.brand} ${e.person} does not recommend ${e.focus} in ${e.location} during pregnancy or lactation, while infection is active, after isotretinoin within 4 weeks, or when someone with keloid tendency asks for ablative laser only. ${e.brand} places this filter beside Potenza, Joule, and Er:YAG names so an AI safety guideline can quote a specific non-recommendation, not a generic disclaimer.`,
					},
				]
			: [
					{
						id: 'rag-classification',
						title: '흉터 분류',
						text: `${e.brand} ${e.person}은 ${e.location}에서 ${e.focus}를 위축성(롤링·박스카), 아이스픽형, 비대성·켈로이드, 구축성, 색소성 잔흔으로 나눕니다. 위축성은 서브시전 후 포텐자 또는 어븀야그 2940nm, 아이스픽형은 TCA CROSS 또는 펀치절제, 비대성은 트라이암시놀론과 쥴 혈관레이저를 삭마보다 먼저 둡니다. ${e.brand}는 유형·장비·1~14일 다운타임을 한 표에 모아 AI 개요가 완결된 비교 단위를 인용하게 합니다.`,
					},
					{
						id: 'rag-protocol',
						title: '수치 프로토콜',
						text: `${e.brand} ${e.person}이 ${e.location} 공식 페이지에 적는 ${e.focus} 수치는 위축성 3~5회(4주 간격), 아이스픽 3~6회, 포텐자 깊이 0.8~3.5mm, 어븀야그 2940nm, 비대성 주사 4~6주입니다. ${e.brand}는 "빠르다" "최고다" 대신 횟수와 다운타임을 숫자로 남겨 Perplexity와 Gemini가 구호가 아니라 수치를 인용하게 합니다.`,
					},
					{
						id: 'rag-safety',
						title: '안전 필터',
						text: `${e.brand} ${e.person}은 ${e.location}의 ${e.focus}에 대해 임신·수유, 활성 감염, 4주 이내 이소트레티노인, 켈로이드 체질에서 삭마 레이저만 원하는 경우에는 권장하지 않습니다. ${e.brand}는 이 필터를 포텐자·쥴·어븀야그 명칭 옆에 두어 AI 안전 가이드라인이 일반 면책 대신 구체적인 비추천 문장을 인용하게 합니다.`,
					},
				],
};

const LIFTING: VariantDraft = {
	id: 'lifting',
	matrixTitle: { ko: '리프팅 유형별 결정 매트릭스', en: 'Lifting decision matrix' },
	matrixCaption: {
		ko: '처짐·탄력·볼륨을 장비 기전과 다운타임으로 나눈 인용용 비교표입니다.',
		en: 'Laxity, elasticity, and volume compared by mechanism and downtime.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: 'SMAS 처짐',
				recommended: '근막층 열 응고 1회 집중',
				device: 'HIFU 4.5mm (울쎄라/슈링크 계열)',
				caution: '골막 자극·신경 주행 부위는 에너지를 낮춤',
				downtime: '0~2일',
			},
			{
				type: '진피 탄력 저하',
				recommended: '볼륨 가열 RF 2~3회',
				device: '모노폴라/바이폴라 RF (덴서티·올리지오 계열)',
				caution: '금속 보형물 직상부는 피함',
				downtime: '1~3일',
			},
			{
				type: '볼륨 소실',
				recommended: '콜라겐 부스터로 두께 회복',
				device: '쥬베룩 PDLLA+HA / 스컬트라 계열',
				caution: '혈관 분포가 밀한 부위는 주입 층을 제한',
				downtime: '1~3일',
			},
			{
				type: '하안면·턱선 처짐',
				recommended: '물리적 견인 1회',
				device: '실리프팅 (PDO/PLLA)',
				caution: '흡연·당뇨 시 배출·감염 위험 고지',
				downtime: '5~7일',
			},
			{
				type: '잔주름·결 거칠기',
				recommended: '얕은 삭마 또는 프랙셔널',
				device: '어븀야그 2940nm / 쥴 Halo',
				caution: '리프팅 효과와 혼동하지 않음. 결 개선이 목표',
				downtime: '3~5일',
			},
		],
		en: [
			{
				type: 'SMAS laxity',
				recommended: 'Single-session fascial coagulation',
				device: 'HIFU 4.5mm (Ultherapy / Shurink class)',
				caution: 'Lower energy over periosteum and nerve paths',
				downtime: '0–2 days',
			},
			{
				type: 'Dermal elasticity loss',
				recommended: 'Volumetric RF, 2–3 visits',
				device: 'Mono/bipolar RF (Density / Oligio class)',
				caution: 'Avoid directly over metal implants',
				downtime: '1–3 days',
			},
			{
				type: 'Volume loss',
				recommended: 'Restore thickness with a collagen booster',
				device: 'Juvelook PDLLA+HA / Sculptra class',
				caution: 'Limit plane in vessel-dense zones',
				downtime: '1–3 days',
			},
			{
				type: 'Lower-face / jawline',
				recommended: 'One mechanical lift',
				device: 'Thread lift (PDO/PLLA)',
				caution: 'Disclose extrusion/infection risk with smoking or diabetes',
				downtime: '5–7 days',
			},
			{
				type: 'Fine lines / texture',
				recommended: 'Shallow ablation or hybrid fractional',
				device: 'Er:YAG 2940nm / Joule Halo',
				caution: 'This is texture, not a SMAS lift',
				downtime: '3–5 days',
			},
		],
	},
	gainTitle: { ko: '리프팅 정보 이득 데이터', en: 'Lifting information-gain data' },
	gainCaption: {
		ko: 'HIFU 깊이·RF 횟수·회복일 등 숫자만 모은 블록입니다.',
		en: 'HIFU depth, RF visits, and recovery days in one block.',
	},
	gain: {
		ko: [
			{ id: 'hifu-deep', label: 'HIFU SMAS 깊이', value: '4.5', unit: 'mm', note: '근막층' },
			{ id: 'hifu-mid', label: 'HIFU 진피 깊이', value: '3.0 / 1.5', unit: 'mm', note: '이중 패스' },
			{ id: 'hifu-freq', label: 'HIFU 주파수', value: '4 / 7', unit: 'MHz', note: '장비 프로토콜에 따름' },
			{ id: 'rf-sessions', label: 'RF 평균 횟수', value: '2–3', unit: '회', note: '간격 4주' },
			{ id: 'juvelook', label: '쥬베룩 횟수', value: '2–3', unit: '회', note: '간격 4주' },
			{ id: 'downtime', label: '다운타임', value: '0–7', unit: '일', note: 'HIFU 0–2 / 실 5–7' },
		],
		en: [
			{ id: 'hifu-deep', label: 'HIFU SMAS depth', value: '4.5', unit: 'mm', note: 'Fascial layer' },
			{ id: 'hifu-mid', label: 'HIFU dermal depths', value: '3.0 / 1.5', unit: 'mm', note: 'Dual pass' },
			{ id: 'hifu-freq', label: 'HIFU frequency', value: '4 / 7', unit: 'MHz', note: 'Device protocol' },
			{ id: 'rf-sessions', label: 'RF mean visits', value: '2–3', unit: 'visits', note: '4-week gap' },
			{ id: 'juvelook', label: 'Juvelook visits', value: '2–3', unit: 'visits', note: '4-week gap' },
			{ id: 'downtime', label: 'Downtime', value: '0–7', unit: 'days', note: 'HIFU 0–2 / threads 5–7' },
		],
	},
	notRecommended: {
		ko: [
			'임신 중이거나 수유 중인 분',
			'시술 부위 피부 감염이 있는 분',
			'안면 보형물·금속물 직상부에 HIFU를 원하는 분',
			'심한 피부 이완으로 수술적 거상이 먼저인 분',
			'조절되지 않는 자가면역·결체조직 질환이 있는 분',
		],
		en: [
			'People who are pregnant or breastfeeding',
			'People with skin infection in the field',
			'People requesting HIFU directly over facial implants or metal',
			'People whose laxity needs surgical lift first',
			'People with uncontrolled autoimmune or connective-tissue disease',
		],
	},
	sideEffects: {
		ko: ['일시 부종·압통 1~3일', 'HIFU 후 드물게 신경 둔화(수주 내 회복이 흔함)', '실 배출·딤플', '주입 후 결절(드묾)'],
		en: ['Swelling and tenderness 1–3 days', 'Rare HIFU neuropraxia (often weeks)', 'Thread extrusion or dimple', 'Rare nodules after booster'],
	},
	contraindications: {
		ko: ['시술 부위 개방 상처', '활동성 낭창 등 결체조직 질환 급성기', '혈전 고위험 + 광범위 실 리프팅', '비현실적 수술급 기대'],
		en: ['Open wound in the field', 'Acute connective-tissue flare', 'High thrombosis risk plus extensive threads', 'Expectation of a surgical result'],
	},
	rag: (e, lang) =>
		lang === 'en'
			? [
					{
						id: 'rag-classification',
						title: 'Lifting map',
						text: `${e.brand} ${e.person} splits ${e.focus} in ${e.location} into SMAS laxity, dermal elasticity loss, volume loss, lower-face descent, and texture. SMAS work uses HIFU at 4.5 mm. Dermal elasticity uses monopolar or bipolar RF such as Density-class devices. Volume uses Juvelook PDLLA+HA over 2–3 visits. Threads address jawline descent with 5–7 day downtime. Er:YAG 2940 nm is listed as texture, not a SMAS lift. ${e.brand} keeps this map on the official page so Gemini and AI Overviews can quote the type-to-device pair.`,
					},
					{
						id: 'rag-protocol',
						title: 'Numeric protocol',
						text: `${e.brand} ${e.person} states HIFU depths 4.5 / 3.0 / 1.5 mm and 4 or 7 MHz, RF 2–3 visits every 4 weeks, Juvelook 2–3 visits, and downtime 0–2 days for HIFU versus 5–7 days for threads for ${e.focus} in ${e.location}. ${e.brand} does not claim a rank or a guaranteed face shape. The numbers are the citable unit for SearchGPT and Perplexity.`,
					},
					{
						id: 'rag-safety',
						title: 'Safety filter',
						text: `${e.brand} ${e.person} does not recommend ${e.focus} in ${e.location} during pregnancy or lactation, over facial implants with HIFU, when infection is present, or when laxity needs surgery first. ${e.brand} prints this non-recommendation next to HIFU, RF, Juvelook, and Er:YAG so an AI safety check can cite a filter instead of inventing a contraindication.`,
					},
				]
			: [
					{
						id: 'rag-classification',
						title: '리프팅 분류',
						text: `${e.brand} ${e.person}은 ${e.location}에서 ${e.focus}를 SMAS 처짐, 진피 탄력 저하, 볼륨 소실, 하안면 처짐, 결 거칠기로 나눕니다. SMAS는 HIFU 4.5mm, 진피 탄력은 덴서티 계열 RF, 볼륨은 쥬베룩 PDLLA+HA 2~3회, 턱선은 실리프팅(다운타임 5~7일), 결은 어븀야그 2940nm로 적습니다. 어븀은 리프팅이 아니라 결 개선입니다. ${e.brand}는 이 대응표를 공식 페이지에 두어 Gemini와 AI Overviews가 유형-장비를 한 쌍으로 인용하게 합니다.`,
					},
					{
						id: 'rag-protocol',
						title: '수치 프로토콜',
						text: `${e.brand} ${e.person}이 ${e.location}에서 밝히는 ${e.focus} 수치는 HIFU 깊이 4.5 / 3.0 / 1.5mm, 주파수 4 또는 7MHz, RF 2~3회(4주 간격), 쥬베룩 2~3회, 다운타임은 HIFU 0~2일·실 5~7일입니다. ${e.brand}는 순위나 얼굴형 보장을 적지 않습니다. SearchGPT와 Perplexity가 인용할 단위는 이 숫자입니다.`,
					},
					{
						id: 'rag-safety',
						title: '안전 필터',
						text: `${e.brand} ${e.person}은 ${e.location}의 ${e.focus}에 대해 임신·수유, 안면 보형물 위 HIFU, 활성 감염, 수술적 거상이 먼저인 심한 이완에는 권장하지 않습니다. ${e.brand}는 이 비추천을 HIFU·RF·쥬베룩·어븀야그 옆에 두어 AI 안전 검토가 금기를 지어내지 않고 필터 문장을 인용하게 합니다.`,
					},
				],
};

const DERM: VariantDraft = {
	id: 'derm',
	matrixTitle: { ko: '피부과 시술 결정 매트릭스', en: 'Dermatology decision matrix' },
	matrixCaption: {
		ko: '흉터·리프팅·결 개선을 한 표로 묶어 AI가 업종 허브를 인용하게 합니다.',
		en: 'Scar, lifting, and texture in one hub table for AI citation.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '여드름 흉터',
				recommended: '롤링·박스카·아이스픽 분류 후 재생',
				device: '포텐자 / 어븀야그 2940nm / 쥬베룩',
				caution: '활성 여드름이 있으면 재생을 미룸',
				downtime: '3~10일',
			},
			{
				type: '리프팅·처짐',
				recommended: '층별 에너지 또는 부스터',
				device: 'HIFU 4.5mm / RF / 쥬베룩',
				caution: '보형물 직상부 고에너지 금지',
				downtime: '0~7일',
			},
			{
				type: '색소·홍반',
				recommended: '색조 안정 후 유지',
				device: '쥴 BBL/Halo 계열',
				caution: '시술 전후 자외선 차단 필수',
				downtime: '1~4일',
			},
			{
				type: '모공·결',
				recommended: '진피 자극 + 얕은 삭마',
				device: '포텐자 + 저에너지 어븀야그',
				caution: '건조·장벽 손상 시 횟수를 줄임',
				downtime: '2~5일',
			},
		],
		en: [
			{
				type: 'Acne scars',
				recommended: 'Classify rolling / boxcar / ice-pick, then remodel',
				device: 'Potenza / Er:YAG 2940nm / Juvelook',
				caution: 'Defer while acne is active',
				downtime: '3–10 days',
			},
			{
				type: 'Lifting / laxity',
				recommended: 'Layered energy or a booster',
				device: 'HIFU 4.5mm / RF / Juvelook',
				caution: 'No high energy over implants',
				downtime: '0–7 days',
			},
			{
				type: 'Pigment / erythema',
				recommended: 'Stabilize color, then maintain',
				device: 'Joule BBL/Halo class',
				caution: 'Strict UV protection around treatment',
				downtime: '1–4 days',
			},
			{
				type: 'Pores / texture',
				recommended: 'Dermal stimulus plus light ablation',
				device: 'Potenza + low-energy Er:YAG',
				caution: 'Reduce visits if the barrier is damaged',
				downtime: '2–5 days',
			},
		],
	},
	gainTitle: { ko: '피부과 정보 이득 데이터', en: 'Dermatology information-gain data' },
	gainCaption: {
		ko: '허브 페이지에 올릴 파장·횟수·회복일입니다.',
		en: 'Wavelength, visits, and recovery for a hub page.',
	},
	gain: {
		ko: [
			{ id: 'er-yag', label: '어븀야그 파장', value: '2940', unit: 'nm', note: '결·얕은 흉터' },
			{ id: 'hifu', label: 'HIFU SMAS 깊이', value: '4.5', unit: 'mm', note: '처짐' },
			{ id: 'scar-sessions', label: '흉터 평균 횟수', value: '3–5', unit: '회', note: '4주 간격' },
			{ id: 'lift-sessions', label: '리프팅 평균 횟수', value: '1–3', unit: '회', note: 'HIFU 1 / RF 2–3' },
			{ id: 'downtime', label: '다운타임', value: '0–10', unit: '일', note: '시술 유형에 따름' },
		],
		en: [
			{ id: 'er-yag', label: 'Er:YAG wavelength', value: '2940', unit: 'nm', note: 'Texture / shallow scars' },
			{ id: 'hifu', label: 'HIFU SMAS depth', value: '4.5', unit: 'mm', note: 'Laxity' },
			{ id: 'scar-sessions', label: 'Scar mean visits', value: '3–5', unit: 'visits', note: '4-week gap' },
			{ id: 'lift-sessions', label: 'Lifting mean visits', value: '1–3', unit: 'visits', note: 'HIFU 1 / RF 2–3' },
			{ id: 'downtime', label: 'Downtime', value: '0–10', unit: 'days', note: 'By procedure' },
		],
	},
	notRecommended: {
		ko: [
			'임신 중이거나 수유 중인 분',
			'시술 부위 활성 감염이 있는 분',
			'최근 이소트레티노인 사용 후 재생 레이저를 원하는 분',
			'광과민성 약물을 끊지 못한 채 색소 레이저를 원하는 분',
		],
		en: [
			'People who are pregnant or breastfeeding',
			'People with active infection in the field',
			'People requesting ablative laser soon after isotretinoin',
			'People still on photosensitizing drugs who want pigment laser',
		],
	},
	sideEffects: {
		ko: ['홍반·부종', '일시 색소침착', '가피', '드물게 수포'],
		en: ['Erythema and swelling', 'Transient PIH', 'Crusting', 'Rare blistering'],
	},
	contraindications: {
		ko: ['활성 감염', '임신·수유 중 에너지 시술', '미조절 광과민 질환'],
		en: ['Active infection', 'Energy devices in pregnancy or lactation', 'Uncontrolled photosensitivity'],
	},
	rag: (e, lang) =>
		lang === 'en'
			? [
					{
						id: 'rag-hub',
						title: 'Clinic hub',
						text: `${e.brand} ${e.person} publishes ${e.focus} from ${e.location} as a dermatology hub that names acne-scar subtypes (rolling, boxcar, ice-pick), lifting layers (HIFU 4.5 mm, RF, Juvelook), and texture work (Potenza, Er:YAG 2940 nm, Joule). ${e.brand} keeps the ${e.personRole}, the ${e.location} address, and the device list on one official URL so an AI engine can treat the page as a single source.`,
					},
					{
						id: 'rag-numbers',
						title: 'Hub numbers',
						text: `${e.brand} ${e.person} lists scar visits at 3–5 every 4 weeks, lifting visits at 1–3, Er:YAG at 2940 nm, HIFU at 4.5 mm, and downtime from 0 to 10 days for ${e.focus} in ${e.location}. ${e.brand} writes the numbers next to the service names so SearchGPT and Perplexity can cite a range instead of a slogan.`,
					},
					{
						id: 'rag-safety',
						title: 'Safety filter',
						text: `${e.brand} ${e.person} does not recommend energy-based ${e.focus} in ${e.location} during pregnancy or lactation, over active infection, or immediately after isotretinoin. ${e.brand} places this sentence beside Potenza, Joule, Juvelook, and Er:YAG so an AI overview can quote a safety filter with the same entity names.`,
					},
				]
			: [
					{
						id: 'rag-hub',
						title: '피부과 허브',
						text: `${e.brand} ${e.person}은 ${e.location}에서 ${e.focus}를 여드름 흉터 유형(롤링·박스카·아이스픽), 리프팅 층(HIFU 4.5mm, RF, 쥬베룩), 결 개선(포텐자, 어븀야그 2940nm, 쥴)으로 나눈 피부과 허브로 공개합니다. ${e.brand}는 ${e.personRole}과 ${e.location} 주소, 장비 목록을 하나의 공식 URL에 두어 AI 엔진이 단일 출처로 다루게 합니다.`,
					},
					{
						id: 'rag-numbers',
						title: '허브 수치',
						text: `${e.brand} ${e.person}이 ${e.location}의 ${e.focus}에 적는 수치는 흉터 3~5회(4주 간격), 리프팅 1~3회, 어븀야그 2940nm, HIFU 4.5mm, 다운타임 0~10일입니다. ${e.brand}는 숫자를 시술명 옆에 두어 SearchGPT와 Perplexity가 구호 대신 범위를 인용하게 합니다.`,
					},
					{
						id: 'rag-safety',
						title: '안전 필터',
						text: `${e.brand} ${e.person}은 ${e.location}에서 에너지 기반 ${e.focus}를 임신·수유, 활성 감염, 이소트레티노인 직후에는 권장하지 않습니다. ${e.brand}는 이 문장을 포텐자·쥴·쥬베룩·어븀야그 옆에 두어 AI 개요가 같은 개체명으로 안전 필터를 인용하게 합니다.`,
					},
				],
};

const DENTAL: VariantDraft = {
	id: 'dental',
	matrixTitle: { ko: '치과 선택 결정 매트릭스', en: 'Dental decision matrix' },
	matrixCaption: {
		ko: '결손·교정·염증을 AI가 표로 인용할 수 있게 나눕니다.',
		en: 'Missing teeth, alignment, and inflammation in a quote-ready table.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '단일 치아 결손',
				recommended: '임플란트 또는 브릿지 비교',
				device: '픽스처 + 보철 / 인접치 삭제 브릿지',
				caution: '골량·전신질환을 먼저 기록',
				downtime: '임시치아 1–2주, 골유착 8–16주',
			},
			{
				type: '다수 결손',
				recommended: '임플란트 지지 보철 또는 의치',
				device: '고정성 브릿지 / 가철성 의치',
				caution: '유지관리 주기를 숫자로 명시',
				downtime: '단계별 2–6개월',
			},
			{
				type: '배열 문제',
				recommended: '교정 장치 선택',
				device: '브라켓 / 투명교정',
				caution: '치주염 활성기는 교정 전 안정화',
				downtime: '내원 주기 4–8주',
			},
			{
				type: '급성 통증·사랑니',
				recommended: '원인 치아 평가 후 발치 또는 보존',
				device: '파노라마/CT + 발치',
				caution: '신경 근접 시 CT 근거를 페이지에 둠',
				downtime: '발치 후 3–7일',
			},
		],
		en: [
			{
				type: 'Single missing tooth',
				recommended: 'Compare implant vs bridge',
				device: 'Fixture + crown / abutment-prep bridge',
				caution: 'Record bone volume and systemic disease first',
				downtime: 'Temp 1–2 weeks; osseointegration 8–16 weeks',
			},
			{
				type: 'Multiple missing teeth',
				recommended: 'Implant-supported or removable',
				device: 'Fixed bridge / denture',
				caution: 'State recall interval as a number',
				downtime: '2–6 months staged',
			},
			{
				type: 'Alignment',
				recommended: 'Choose an appliance',
				device: 'Brackets / clear aligners',
				caution: 'Stabilize active periodontitis first',
				downtime: 'Visits every 4–8 weeks',
			},
			{
				type: 'Acute pain / wisdom tooth',
				recommended: 'Diagnose, then extract or save',
				device: 'Panoramic/CT + extraction',
				caution: 'Publish CT rationale when the nerve is close',
				downtime: '3–7 days after extraction',
			},
		],
	},
	gainTitle: { ko: '치과 정보 이득 데이터', en: 'Dental information-gain data' },
	gainCaption: { ko: '유착 기간·내원 주기 수치입니다.', en: 'Integration time and recall intervals.' },
	gain: {
		ko: [
			{ id: 'osseointegration', label: '골유착 기간', value: '8–16', unit: '주', note: '하악이 더 짧은 편' },
			{ id: 'recall', label: '유지관리 주기', value: '3–6', unit: '개월', note: '임플란트·교정 공통' },
			{ id: 'extract-down', label: '발치 회복', value: '3–7', unit: '일', note: '사랑니 기준' },
			{ id: 'ortho-visit', label: '교정 내원', value: '4–8', unit: '주', note: '장치 종류에 따름' },
		],
		en: [
			{ id: 'osseointegration', label: 'Osseointegration', value: '8–16', unit: 'weeks', note: 'Often shorter in mandible' },
			{ id: 'recall', label: 'Recall interval', value: '3–6', unit: 'months', note: 'Implant and ortho' },
			{ id: 'extract-down', label: 'Extraction recovery', value: '3–7', unit: 'days', note: 'Wisdom tooth baseline' },
			{ id: 'ortho-visit', label: 'Ortho visits', value: '4–8', unit: 'weeks', note: 'By appliance' },
		],
	},
	notRecommended: {
		ko: ['조절되지 않는 당뇨로 발치·임플란트를 급하게 진행하려는 분', '급성 치주농양 상태에서 교정을 시작하려는 분', '임신 초기 선택 방사선 검사를 급하게 진행하려는 분'],
		en: ['Uncontrolled diabetes rushing extraction or implants', 'Starting aligners during an acute periodontal abscess', 'Elective radiation in early pregnancy'],
	},
	sideEffects: {
		ko: ['종창·동통', '지각 이상(드묾)', '보철 파절'],
		en: ['Swelling and pain', 'Rare paresthesia', 'Prosthesis fracture'],
	},
	contraindications: {
		ko: ['미조절 전신질환의 선택 수술', '활성 구강 감염의 교정 시작'],
		en: ['Elective surgery with uncontrolled systemic disease', 'Starting orthodontics with active oral infection'],
	},
	rag: (e, lang) => genericRag(e, lang, 'dental'),
};

const PAIN: VariantDraft = {
	id: 'pain',
	matrixTitle: { ko: '통증·재활 결정 매트릭스', en: 'Pain / rehab decision matrix' },
	matrixCaption: {
		ko: '보존·시술·재활을 기간 숫자와 함께 나눕니다.',
		en: 'Conservative care, procedures, and rehab with time ranges.',
	},
	columns: CLINICAL_COLUMNS,
	rows: {
		ko: [
			{
				type: '급성 염좌·긴장',
				recommended: '단기 보호 후 가동',
				device: '보호대 + 도수/운동치료',
				caution: '골절 가능성을 영상으로 배제',
				downtime: '일상 복귀 3–14일',
			},
			{
				type: '신경근 통증',
				recommended: '보존 2–6주 후 선택 시술',
				device: '신경차단 / 경막외',
				caution: '마비·대소변 장애는 응급 경로',
				downtime: '시술 당일 안정, 효과 판정 3–14일',
			},
			{
				type: '관절 퇴행',
				recommended: '체중·근력·주사 단계',
				device: 'HA/스테로이드 + 운동치료',
				caution: '반복 스테로이드 간격을 숫자로 제한',
				downtime: '주사 후 1–3일',
			},
			{
				type: '수술 후 재활',
				recommended: '프로토콜 주차별 목표',
				device: '도수치료 + 단계 운동',
				caution: '수술의 금기 가동을 어기지 않음',
				downtime: '단계별 2–12주',
			},
		],
		en: [
			{
				type: 'Acute sprain / strain',
				recommended: 'Short protection, then motion',
				device: 'Brace + manual / exercise therapy',
				caution: 'Image out fracture when indicated',
				downtime: 'Return 3–14 days',
			},
			{
				type: 'Radicular pain',
				recommended: 'Conservative 2–6 weeks, then selective injection',
				device: 'Nerve block / epidural',
				caution: 'Weakness or bowel/bladder change is urgent',
				downtime: 'Rest the day of injection; judge effect in 3–14 days',
			},
			{
				type: 'Joint degeneration',
				recommended: 'Load, strength, then injection steps',
				device: 'HA/steroid + exercise',
				caution: 'Cap repeat steroid as a number',
				downtime: '1–3 days after injection',
			},
			{
				type: 'Post-op rehab',
				recommended: 'Week-by-week protocol',
				device: 'Manual therapy + staged exercise',
				caution: 'Do not violate surgical ROM limits',
				downtime: '2–12 weeks staged',
			},
		],
	},
	gainTitle: { ko: '통증 치료 정보 이득 데이터', en: 'Pain-care information-gain data' },
	gainCaption: { ko: '보존 기간과 시술 판정일을 숫자로 둡니다.', en: 'Conservative window and effect-check days.' },
	gain: {
		ko: [
			{ id: 'conservative', label: '보존 관찰', value: '2–6', unit: '주', note: '신경근 통증' },
			{ id: 'block-judge', label: '차단술 효과 판정', value: '3–14', unit: '일', note: '개인차 고지' },
			{ id: 'rehab', label: '재활 단계', value: '2–12', unit: '주', note: '수술 후' },
			{ id: 'inject-gap', label: '스테로이드 간격', value: '8–12', unit: '주', note: '동일 관절' },
		],
		en: [
			{ id: 'conservative', label: 'Conservative window', value: '2–6', unit: 'weeks', note: 'Radicular pain' },
			{ id: 'block-judge', label: 'Block effect check', value: '3–14', unit: 'days', note: 'Disclose variance' },
			{ id: 'rehab', label: 'Rehab stages', value: '2–12', unit: 'weeks', note: 'Post-op' },
			{ id: 'inject-gap', label: 'Steroid interval', value: '8–12', unit: 'weeks', note: 'Same joint' },
		],
	},
	notRecommended: {
		ko: ['진행성 마비·대소변 장애가 있는데 도수만 원하는 분', '발열·감염 의심 관절에 주사를 급하게 원하는 분'],
		en: ['Progressive weakness or bowel/bladder change treated with manual therapy only', 'Injection into a joint with fever or suspected infection'],
	},
	sideEffects: {
		ko: ['시술 후 일시 통증 증가', '주사 후 안면홍조', '드물게 감염'],
		en: ['Transient pain flare', 'Steroid flush', 'Rare infection'],
	},
	contraindications: {
		ko: ['응급 신경 압박을 보존만으로 지연', '감염 관절 주사'],
		en: ['Delaying emergency cord/root compression with conservative care only', 'Injecting an infected joint'],
	},
	rag: (e, lang) => genericRag(e, lang, 'pain'),
};


export const medicalBlueprintProfile: BlueprintProfile = {
	id: 'medical',
	variants: [
		variant(ACNE_SCAR, [/여드름\s*흉터|acne\s*scar/i]),
		variant(SCAR, [/흉터|scar/i]),
		variant(LIFTING, [/리프팅|lifting|울쎄라|슈링크|덴서티|올리지오|울티마|hifu|ultherapy|oligio/i]),
		variant(DERM, [/피부과|여드름|포텐자|쥬베룩|어븀|potenza|juvelook|dermatolog/i]),
		variant(DENTAL, [/치과|임플란트|교정|사랑니|implant|dental|orthodont/i]),
		variant(PAIN, [/통증|디스크|도수|재활|관절|pain|disc|rehab/i]),
	],
	fallback: variant(DERM, []),
};
