/**
 * Industry-aware GEO/SEO keyword intent templates (Strategy Pattern).
 * `general` is the required fallback when the vertical is unknown.
 */

import { getIndustryProfile, type IndustryType } from '@/lib/registry/universalIndustryRegistry';

export type KeywordIndustryType =
	| 'medical'
	| 'legal'
	| 'tax'
	| 'beauty'
	| 'interior'
	| 'fitness'
	| 'veterinary'
	| 'education'
	| 'realestate'
	| 'restaurant'
	| 'b2b'
	| 'general';

export type AuditLang = 'ko' | 'en';

export const NEUTRAL_SERVICE = { ko: '전문 서비스', en: 'professional service' } as const;

export interface PipelineCtx {
	brand: string;
	loc: string;
	cityOk: boolean;
	lang: AuditLang;
	/** Ranked 1–3 services; always at least one (neutral fallback). */
	services: string[];
	/** `registry.actionName` — visit/booking, consult/retainer, inquiry/adoption, … */
	actionName: string;
}

export interface IndustryIntentStrategy {
	placeNoun: { ko: string; en: string };
	officialSuffix: { ko: string; en: string };
	/** Drop agency/shopping leak chips that are not in `actionName`. */
	filterAgencyLeak: boolean;
	aiPrompts: (ctx: PipelineCtx) => string[];
	conversionForService: (service: string, ctx: PipelineCtx) => string[];
	lsiForService: (service: string, ctx: PipelineCtx) => string[];
	extraConversion: (ctx: PipelineCtx) => string[];
	extraLsi: (ctx: PipelineCtx) => string[];
}

type SpecialtyCluster = 'sports' | 'child' | 'pain' | 'cancer' | 'dental' | 'plastic' | 'derm' | 'general';

const PIPELINE_INDUSTRIES = new Set<string>([
	'medical',
	'legal',
	'tax',
	'beauty',
	'interior',
	'fitness',
	'veterinary',
	'education',
	'realestate',
	'restaurant',
	'b2b',
	'general',
]);

export function joinRegion(region: string, rest: string): string {
	const r = region.replace(/\s+/g, ' ').trim();
	const body = rest.replace(/\s+/g, ' ').trim();
	if (!r || r === '해당' || r === 'this') return body;
	return `${r} ${body}`;
}

export function serviceAt(services: string[], index: number): string {
	if (!services.length) return NEUTRAL_SERVICE.ko;
	return services[index % services.length] || services[0] || NEUTRAL_SERVICE.ko;
}

function classifySpecialty(spec: string): SpecialtyCluster {
	if (/스포츠|sports/i.test(spec)) return 'sports';
	if (/아동|발달|소아|언어치료|child|pediatric/i.test(spec)) return 'child';
	if (/정형|통증|도수|관절|ortho|pain|manual/i.test(spec)) return 'pain';
	if (/중입자|암|종양|cancer|oncolog|proton/i.test(spec)) return 'cancer';
	if (/치과|임플란트|교정|dental|implant|orthodont/i.test(spec)) return 'dental';
	if (/성형|plastic|rhinoplast|blepharoplast/i.test(spec)) return 'plastic';
	if (/피부|보톡스|필러|derm|botox|filler/i.test(spec)) return 'derm';
	return 'general';
}

function withLoc(ctx: PipelineCtx, phrase: string): string {
	return ctx.cityOk ? joinRegion(ctx.loc, phrase) : phrase;
}

function actionPhrase(ctx: PipelineCtx, spec: string): string {
	const action = (ctx.actionName || '').trim();
	if (!action) return spec;
	return `${spec} ${action}`;
}

/** Six conversational prompts cycling services[0..2] evenly. */
function cycledPrompts(
	ctx: PipelineCtx,
	build: (service: string, slot: 0 | 1 | 2 | 3 | 4 | 5) => string,
): string[] {
	return [0, 1, 2, 3, 4, 5].map((slot) => build(serviceAt(ctx.services, slot), slot as 0 | 1 | 2 | 3 | 4 | 5));
}

function medicalAiPrompts(ctx: PipelineCtx): string[] {
	return getIndustryProfile('medical').aiPromptGenerator({
		brandName: ctx.brand,
		location: ctx.cityOk ? ctx.loc : '',
		services: ctx.services,
		lang: ctx.lang,
	});
}

function medicalConversion(spec: string, ctx: PipelineCtx): string[] {
	const cluster = classifySpecialty(spec);
	const brand = ctx.brand;
	if (ctx.lang === 'en') {
		switch (cluster) {
			case 'sports':
				return [
					withLoc(ctx, `${spec} insurance covered therapy`),
					`${spec} same-day non-surgical treatment`,
					withLoc(ctx, `${spec} evening appointment`),
					`${spec} recovery reviews`,
				];
			case 'child':
				return [
					withLoc(ctx, `${spec} evaluation process`),
					withLoc(ctx, `${spec} consult fee`),
					brand ? `${brand} first-visit booking` : `${spec} first-visit booking`,
					`${spec} parent reviews`,
				];
			case 'pain':
				return [
					withLoc(ctx, `${spec} manual therapy insurance`),
					`${spec} same-day non-surgical treatment`,
					withLoc(ctx, `${spec} pain treatment reviews`),
					withLoc(ctx, `${spec} evening clinic booking`),
				];
			case 'cancer':
				return [
					`${spec} eligibility and process`,
					`${spec} cost and treatment timeline`,
					brand ? `${brand} consultation booking` : `${spec} consultation booking`,
					`${spec} second opinion`,
				];
			case 'dental':
				return [
					withLoc(ctx, `${spec} same-day consult`),
					`${spec} insurance coverage`,
					brand ? `${brand} first-visit booking` : `${spec} booking`,
					`${spec} treatment reviews`,
				];
			default:
				return [
					withLoc(ctx, `${spec} appointment today`),
					`${spec} insurance / coverage`,
					brand ? `${brand} first-visit booking` : `${spec} booking`,
					`${spec} treatment reviews`,
				];
		}
	}
	switch (cluster) {
		case 'sports':
			return [
				withLoc(ctx, actionPhrase(ctx, spec)),
				`${spec} 비수술 당일 치료`,
				withLoc(ctx, `${spec} 야간진료 예약`),
				`${spec} 치료 후기 및 추천`,
			];
		case 'child':
			return [
				withLoc(ctx, actionPhrase(ctx, spec)),
				withLoc(ctx, `${spec} 상담 비용`),
				brand ? `${brand} 첫 방문 예약` : `${spec} 첫 방문 예약`,
				`${spec} 치료 후기 및 추천`,
			];
		case 'pain':
			return [
				withLoc(ctx, actionPhrase(ctx, spec)),
				`${spec} 비수술 당일 치료`,
				withLoc(ctx, `${spec} 통증 치료 후기`),
				withLoc(ctx, `${spec} 야간진료 예약`),
			];
		case 'cancer':
			return [
				`${spec} 적응증과 치료 절차`,
				`${spec} 비용 및 일정`,
				brand ? `${brand} 상담 예약` : `${spec} 상담 예약`,
				`${spec} 치료 후기 및 추천`,
			];
		case 'dental':
			return [
				withLoc(ctx, `${spec} 당일 진료`),
				`${spec} 보험 적용 여부`,
				brand ? `${brand} 첫 방문 예약` : `${spec} 예약`,
				`${spec} 치료 후기`,
			];
		default:
			return [
				withLoc(ctx, actionPhrase(ctx, spec)),
				`${spec} 비수술 당일 치료`,
				brand ? `${brand} 첫 방문 예약` : `${spec} 예약`,
				`${spec} 치료 후기 및 추천`,
			];
	}
}

function medicalLsi(spec: string, ctx: PipelineCtx): string[] {
	const cluster = classifySpecialty(spec);
	if (ctx.lang === 'en') {
		switch (cluster) {
			case 'sports':
				return [
					withLoc(ctx, `${spec} clinic`),
					withLoc(ctx, 'rehab clinic'),
					withLoc(ctx, 'physical therapy clinic'),
					withLoc(ctx, 'posture correction therapy'),
				];
			case 'child':
				return [withLoc(ctx, `${spec} near me`), withLoc(ctx, 'pediatric speech therapy'), withLoc(ctx, 'child rehab clinic')];
			case 'pain':
				return [
					withLoc(ctx, `${spec} highly rated`),
					withLoc(ctx, 'pain medicine clinic'),
					withLoc(ctx, 'non-surgical joint treatment'),
					withLoc(ctx, 'nearby pain clinic'),
				];
			default:
				return [withLoc(ctx, `${spec} near me`), withLoc(ctx, `${spec} specialist`)];
		}
	}
	switch (cluster) {
		case 'sports':
			return [
				withLoc(ctx, `${spec} 잘하는 곳`),
				withLoc(ctx, '재활치료 클리닉'),
				withLoc(ctx, '체형교정 도수치료'),
				withLoc(ctx, '물리치료 의원'),
			];
		case 'child':
			return [withLoc(ctx, `${spec} 잘하는 곳`), withLoc(ctx, '아동 언어치료 센터'), withLoc(ctx, '소아재활 클리닉')];
		case 'pain':
			return [
				withLoc(ctx, `${spec} 잘하는 의원`),
				withLoc(ctx, '통증의학과 추천'),
				withLoc(ctx, '비수술 관절치료'),
				withLoc(ctx, `${spec} 인근 클리닉`),
			];
		case 'cancer':
			return [withLoc(ctx, `${spec} 전문 병원`), '방사선종양학과', '암센터'];
		case 'dental':
			return [withLoc(ctx, `${spec} 잘하는 곳`), withLoc(ctx, '치과 야간진료')];
		default:
			return [withLoc(ctx, `${spec} 잘하는 곳`), withLoc(ctx, '야간진료 병원')];
	}
}

function legalAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk
						? `Which lawyer in ${ctx.loc} is experienced with ${spec}?`
						: `Which lawyer is experienced with ${spec}?`;
				case 1:
					return ctx.cityOk
						? `Recommend a trusted ${spec} law firm in ${ctx.loc}`
						: `Recommend a trusted ${spec} law firm`;
				case 2:
					return brand ? `${brand} consultation hours and retainer process` : `${spec} consultation hours`;
				case 3:
					return withLoc(ctx, `${spec} legal fee and case process`);
				case 4:
					return brand ? `${brand} office location and how to book a consult` : `How to book a ${spec} consult`;
				default:
					return withLoc(ctx, `highly rated ${spec} attorney`);
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 경험 많은 변호사 어디야?` : `${spec} 경험 많은 변호사 어디야?`;
			case 1:
				return ctx.cityOk
					? `${ctx.loc}에서 ${spec} 후기 좋고 신뢰할 만한 로펌 추천해줘`
					: `${spec} 후기 좋고 신뢰할 만한 로펌 추천해줘`;
			case 2:
				return brand ? `${brand} 상담시간과 수임 절차 알려줘` : `${spec} 상담시간 및 수임 절차`;
			case 3:
				return withLoc(ctx, `${spec} 상담 비용 및 진행 절차`);
			case 4:
				return brand ? `${brand} 위치 및 방문 상담 예약 방법` : `${spec} 상담 예약 방법`;
			default:
				return withLoc(ctx, `${spec} 잘하는 법률사무소`);
		}
	});
}

function taxAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk ? `Best ${spec} accountant in ${ctx.loc}?` : `Best ${spec} accountant near me?`;
				case 1:
					return ctx.cityOk ? `Recommend a reliable ${spec} tax office in ${ctx.loc}` : `Recommend a reliable ${spec} tax office`;
				case 2:
					return brand ? `${brand} booking and bookkeeping inquiry` : `${spec} consultation booking`;
				case 3:
					return withLoc(ctx, `${spec} fee and filing process`);
				case 4:
					return brand ? `${brand} location and how to book` : `How to book ${spec}`;
				default:
					return withLoc(ctx, `${spec} specialist tax firm`);
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 잘하는 세무사 어디야?` : `${spec} 잘하는 세무사 어디야?`;
			case 1:
				return ctx.cityOk
					? `${ctx.loc}에서 ${spec} 후기 좋은 세무회계 추천해줘`
					: `${spec} 후기 좋은 세무회계 추천해줘`;
			case 2:
				return brand ? `${brand} 상담 예약 및 기장 문의` : `${spec} 상담 예약`;
			case 3:
				return withLoc(ctx, `${spec} 비용 및 신고 절차`);
			case 4:
				return brand ? `${brand} 위치 및 상담 방법` : `${spec} 상담 방법`;
			default:
				return withLoc(ctx, `${spec} 전문 세무사무소`);
		}
	});
}

function beautyAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk ? `Where in ${ctx.loc} is the best ${spec} salon?` : `Where is the best ${spec} salon?`;
				case 1:
					return ctx.cityOk ? `Recommend a well-reviewed ${spec} in ${ctx.loc}` : `Recommend a well-reviewed ${spec}`;
				case 2:
					return brand ? `${brand} hours and how to book` : `${spec} hours and booking`;
				case 3:
					return withLoc(ctx, `${spec} price and appointment length`);
				case 4:
					return brand ? `${brand} location and same-day booking` : `${spec} same-day booking`;
				default:
					return withLoc(ctx, `highly rated ${spec} shop`);
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 잘하는 샵 어디야?` : `${spec} 잘하는 샵 어디야?`;
			case 1:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 후기 좋은 곳 추천해줘` : `${spec} 후기 좋은 곳 추천해줘`;
			case 2:
				return brand ? `${brand} 영업시간과 예약 방법 알려줘` : `${spec} 영업시간 및 예약`;
			case 3:
				return withLoc(ctx, `${spec} 가격과 시술 시간`);
			case 4:
				return brand ? `${brand} 위치 및 당일 예약` : `${spec} 당일 예약`;
			default:
				return withLoc(ctx, `${spec} 잘하는 미용샵`);
		}
	});
}

function interiorAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk ? `Best ${spec} firm in ${ctx.loc}?` : `Best ${spec} firm near me?`;
				case 1:
					return ctx.cityOk
						? `Recommend a well-reviewed ${spec} studio in ${ctx.loc}`
						: `Recommend a well-reviewed ${spec} studio`;
				case 2:
					return brand ? `${brand} consult booking and quote request` : `${spec} quote request`;
				case 3:
					return withLoc(ctx, `${spec} cost and project timeline`);
				case 4:
					return brand ? `${brand} portfolio and how to book a consult` : `${spec} portfolio and consult`;
				default:
					return withLoc(ctx, `${spec} specialist contractor`);
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 잘하는 업체 어디야?` : `${spec} 잘하는 업체 어디야?`;
			case 1:
				return ctx.cityOk
					? `${ctx.loc}에서 ${spec} 후기 좋은 인테리어 추천해줘`
					: `${spec} 후기 좋은 인테리어 추천해줘`;
			case 2:
				return brand ? `${brand} 상담 예약 및 견적 문의` : `${spec} 견적 문의`;
			case 3:
				return withLoc(ctx, `${spec} 시공 비용과 기간`);
			case 4:
				return brand ? `${brand} 포트폴리오 및 상담 방법` : `${spec} 상담 방법`;
			default:
				return withLoc(ctx, `${spec} 전문 인테리어`);
		}
	});
}

function b2bAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk ? `best ${spec} in ${ctx.loc} recommend` : `best ${spec} recommendation`;
				case 1:
					return brand ? `${brand} how to book a consultation` : `${spec} consultation process`;
				case 2:
					return `${spec} case study and implementation`;
				case 3:
					return ctx.cityOk ? `${ctx.loc} ${spec} trusted provider` : `${spec} vs alternatives`;
				case 4:
					return brand ? `${brand} official contact and hours` : `${spec} inquiry and demo`;
				default:
					return `${spec} recommendation`;
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc} ${spec} 추천` : `${spec} 추천`;
			case 1:
				return brand ? `${brand} 상담 방법` : `${spec} 상담 예약 방법`;
			case 2:
				return `${spec} 도입 사례와 절차`;
			case 3:
				return ctx.cityOk ? `${ctx.loc} ${spec} 잘하는 곳` : `${spec} 비교`;
			case 4:
				return brand ? `${brand} 위치 및 예약` : `${spec} 도입 문의`;
			default:
				return `${spec} 추천`;
		}
	});
}

function generalAiPrompts(ctx: PipelineCtx): string[] {
	const brand = ctx.brand;
	return cycledPrompts(ctx, (spec, slot) => {
		if (ctx.lang === 'en') {
			switch (slot) {
				case 0:
					return ctx.cityOk ? `Where in ${ctx.loc} is a trusted ${spec} provider?` : `Which ${spec} provider is trusted?`;
				case 1:
					return ctx.cityOk
						? `Recommend a reliable ${spec} in ${ctx.loc} with good reviews`
						: `Recommend a reliable ${spec} with good reviews`;
				case 2:
					return brand ? `${brand} how to book a consultation` : `${spec} consultation process`;
				case 3:
					return withLoc(ctx, `${spec} cost and process`);
				case 4:
					return brand ? `${brand} location and booking` : `How to book ${spec}`;
				default:
					return withLoc(ctx, `${spec} specialist`);
			}
		}
		switch (slot) {
			case 0:
				return ctx.cityOk ? `${ctx.loc}에서 ${spec} 잘하는 곳 어디야?` : `${spec} 잘하는 곳 어디야?`;
			case 1:
				return ctx.cityOk
					? `${ctx.loc}에서 ${spec} 후기 좋고 신뢰할 만한 곳 추천해줘`
					: `${spec} 후기 좋고 신뢰할 만한 곳 추천해줘`;
			case 2:
				return brand ? `${brand} 상담 예약 방법 알려줘` : `${spec} 상담 예약 방법`;
			case 3:
				return withLoc(ctx, `${spec} 비용 및 진행 절차`);
			case 4:
				return brand ? `${brand} 위치 및 예약 안내` : `${spec} 예약 안내`;
			default:
				return withLoc(ctx, `${spec} 전문 업체`);
		}
	});
}

function actionRows(
	ctx: PipelineCtx,
	spec: string,
	ko: [string, string, string, string],
	en: [string, string, string, string],
): string[] {
	const rows = ctx.lang === 'en' ? en : ko;
	return rows.map((row) => row.replaceAll('{spec}', spec).replaceAll('{brand}', ctx.brand || spec));
}

const medicalStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('medical').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: true,
	aiPrompts: medicalAiPrompts,
	conversionForService: medicalConversion,
	lsiForService: medicalLsi,
	extraConversion: (ctx) =>
		ctx.brand
			? ctx.lang === 'en'
				? [`${ctx.brand} ${ctx.actionName}`, `${ctx.brand} first-visit booking`]
				: [`${ctx.brand} ${ctx.actionName}`, `${ctx.brand} 첫 방문 예약`]
			: [],
	extraLsi: (ctx) => {
		const s0 = serviceAt(ctx.services, 0);
		if (!ctx.cityOk) return [];
		return ctx.lang === 'en'
			? [`${ctx.loc} evening clinic`, `${ctx.loc} nearby ${s0}`]
			: [`${ctx.loc} 야간진료 병원`, `${ctx.loc} 인근 ${s0}`];
	},
};

const legalStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('legal').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: legalAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 수임 비용`, `{brand} ${ctx.actionName}`, `${spec} 해결 후기`],
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} retainer fee`, `{brand} ${ctx.actionName}`, `${spec} case reviews`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [withLoc(ctx, `${spec} attorney`), withLoc(ctx, 'law office'), withLoc(ctx, 'law firm recommendation')]
			: [withLoc(ctx, `${spec} 변호사`), withLoc(ctx, '법률사무소'), withLoc(ctx, '로펌 추천')],
	extraConversion: (ctx) =>
		ctx.brand
			? ctx.lang === 'en'
				? [`${ctx.brand} legal consult booking`]
				: [`${ctx.brand} 법률 상담 예약`]
			: [],
	extraLsi: (ctx) => (ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} lawyer near me`] : [`${ctx.loc} 변호사 추천`]) : []),
};

const taxStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('accounting').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: taxAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 기장 문의`, `{brand} ${ctx.actionName}`, `${spec} 비용 안내`],
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} bookkeeping inquiry`, `{brand} ${ctx.actionName}`, `${spec} fee guide`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [withLoc(ctx, `${spec} CPA`), withLoc(ctx, 'tax accountant'), withLoc(ctx, 'accounting firm')]
			: [withLoc(ctx, `${spec} 세무사`), withLoc(ctx, '세무회계'), withLoc(ctx, '회계사무소')],
	extraConversion: (ctx) =>
		ctx.brand ? (ctx.lang === 'en' ? [`${ctx.brand} tax consult`] : [`${ctx.brand} 세무 상담`]) : [],
	extraLsi: (ctx) => (ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} tax office`] : [`${ctx.loc} 세무사 추천`]) : []),
};

const beautyStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('beauty').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: beautyAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 가격`, `{brand} ${ctx.actionName}`, `${spec} 시술 후기`],
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} price`, `{brand} ${ctx.actionName}`, `${spec} treatment reviews`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [withLoc(ctx, `${spec} salon`), withLoc(ctx, 'beauty shop'), withLoc(ctx, 'near me salon')]
			: [withLoc(ctx, `${spec} 샵`), withLoc(ctx, '미용실'), withLoc(ctx, '뷰티샵 추천')],
	extraConversion: (ctx) =>
		ctx.brand ? (ctx.lang === 'en' ? [`${ctx.brand} booking`] : [`${ctx.brand} 예약`]) : [],
	extraLsi: (ctx) => (ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} salon near me`] : [`${ctx.loc} 미용샵`]) : []),
};

const interiorStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('interior').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: interiorAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 상담 예약`, `{brand} ${ctx.actionName}`, `${spec} 시공 후기`],
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} consult booking`, `{brand} ${ctx.actionName}`, `${spec} project reviews`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [withLoc(ctx, `${spec} contractor`), withLoc(ctx, 'interior design'), withLoc(ctx, 'remodeling firm')]
			: [withLoc(ctx, `${spec} 업체`), withLoc(ctx, '인테리어'), withLoc(ctx, '리모델링 추천')],
	extraConversion: (ctx) =>
		ctx.brand ? (ctx.lang === 'en' ? [`${ctx.brand} ${ctx.actionName}`] : [`${ctx.brand} ${ctx.actionName}`]) : [],
	extraLsi: (ctx) =>
		ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} interior design`] : [`${ctx.loc} 인테리어 업체`]) : [],
};

const b2bStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('professional').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: b2bAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[actionPhrase(ctx, spec), `${spec} 도입 문의`, `{brand} ${ctx.actionName}`, `${spec} 도입 사례`],
			[actionPhrase(ctx, spec), `${spec} adoption inquiry`, `{brand} ${ctx.actionName}`, `${spec} case study`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [`${spec} reviews`, `${spec} specialist`, ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} nearby`]
			: [`${spec} 후기`, `${spec} 전문`, ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} 근처`],
	extraConversion: (ctx) => {
		const s1 = serviceAt(ctx.services, 1);
		if (ctx.lang === 'en') {
			return [
				ctx.brand ? `${ctx.brand} ${ctx.actionName}` : `${serviceAt(ctx.services, 0)} inquiry`,
				`${s1} implementation timeline`,
			];
		}
		return [ctx.brand ? `${ctx.brand} ${ctx.actionName}` : `${serviceAt(ctx.services, 0)} 도입 문의`, `${s1} 구축 일정`];
	},
	extraLsi: (ctx) => {
		const s0 = serviceAt(ctx.services, 0);
		if (ctx.lang === 'en') {
			return [ctx.cityOk ? `${ctx.loc} near me` : 'near me', `${s0} FAQ`];
		}
		return [ctx.cityOk ? `${ctx.loc} 근처` : '근처', `${s0} FAQ`];
	},
};

function profilePipelineStrategy(
	type: IndustryType,
	hints: { placeKo: string; placeEn: string; reviewKo: string; reviewEn: string },
): IndustryIntentStrategy {
	const profile = getIndustryProfile(type);
	return {
		placeNoun: profile.defaultCategory,
		officialSuffix: { ko: '공식', en: 'official' },
		filterAgencyLeak: false,
		aiPrompts: (ctx) =>
			profile.aiPromptGenerator({
				brandName: ctx.brand,
				location: ctx.cityOk ? ctx.loc : '',
				services: ctx.services,
				lang: ctx.lang,
			}),
		conversionForService: (spec, ctx) =>
			actionRows(
				ctx,
				spec,
				[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 비용 안내`, `{brand} ${ctx.actionName}`, `${spec} ${hints.reviewKo}`],
				[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} pricing`, `{brand} ${ctx.actionName}`, `${spec} ${hints.reviewEn}`],
			),
		lsiForService: (spec, ctx) =>
			ctx.lang === 'en'
				? [withLoc(ctx, `${spec} ${hints.placeEn}`), withLoc(ctx, hints.placeEn), ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} nearby`]
				: [withLoc(ctx, `${spec} ${hints.placeKo}`), withLoc(ctx, hints.placeKo), ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} 근처`],
		extraConversion: (ctx) =>
			ctx.brand ? (ctx.lang === 'en' ? [`${ctx.brand} ${ctx.actionName}`] : [`${ctx.brand} ${ctx.actionName}`]) : [],
		extraLsi: (ctx) => (ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} recommend`] : [`${ctx.loc} 추천`]) : []),
	};
}

const generalStrategy: IndustryIntentStrategy = {
	placeNoun: getIndustryProfile('general').defaultCategory,
	officialSuffix: { ko: '공식', en: 'official' },
	filterAgencyLeak: false,
	aiPrompts: generalAiPrompts,
	conversionForService: (spec, ctx) =>
		actionRows(
			ctx,
			spec,
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} 비용 안내`, `{brand} ${ctx.actionName}`, `${spec} 이용 후기`],
			[withLoc(ctx, actionPhrase(ctx, spec)), `${spec} pricing`, `{brand} ${ctx.actionName}`, `${spec} reviews`],
		),
	lsiForService: (spec, ctx) =>
		ctx.lang === 'en'
			? [withLoc(ctx, `${spec} reviews`), withLoc(ctx, `${spec} specialist`), ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} nearby`]
			: [withLoc(ctx, `${spec} 후기`), withLoc(ctx, `${spec} 전문`), ctx.cityOk ? `${ctx.loc} ${spec}` : `${spec} 근처`],
	extraConversion: (ctx) =>
		ctx.brand ? (ctx.lang === 'en' ? [`${ctx.brand} inquiry`] : [`${ctx.brand} 문의`]) : [],
	extraLsi: (ctx) => (ctx.cityOk ? (ctx.lang === 'en' ? [`${ctx.loc} recommend`] : [`${ctx.loc} 추천`]) : []),
};

export const INDUSTRY_STRATEGIES: Record<KeywordIndustryType, IndustryIntentStrategy> = {
	medical: medicalStrategy,
	legal: legalStrategy,
	tax: taxStrategy,
	beauty: beautyStrategy,
	interior: interiorStrategy,
	fitness: profilePipelineStrategy('fitness', {
		placeKo: '스튜디오',
		placeEn: 'studio',
		reviewKo: '수업 후기',
		reviewEn: 'class reviews',
	}),
	veterinary: profilePipelineStrategy('veterinary', {
		placeKo: '동물병원',
		placeEn: 'animal hospital',
		reviewKo: '진료 후기',
		reviewEn: 'visit reviews',
	}),
	education: profilePipelineStrategy('education', {
		placeKo: '학원',
		placeEn: 'academy',
		reviewKo: '수강 후기',
		reviewEn: 'class reviews',
	}),
	realestate: profilePipelineStrategy('realestate', {
		placeKo: '부동산',
		placeEn: 'realtor',
		reviewKo: '중개 후기',
		reviewEn: 'listing reviews',
	}),
	restaurant: profilePipelineStrategy('restaurant', {
		placeKo: '식당',
		placeEn: 'restaurant',
		reviewKo: '맛 후기',
		reviewEn: 'dining reviews',
	}),
	b2b: b2bStrategy,
	general: generalStrategy,
};

export function registryTypeFromKeyword(industry: KeywordIndustryType): IndustryType {
	if (industry === 'tax') return 'accounting';
	if (industry === 'b2b') return 'professional';
	if (
		industry === 'medical' ||
		industry === 'legal' ||
		industry === 'beauty' ||
		industry === 'interior' ||
		industry === 'fitness' ||
		industry === 'veterinary' ||
		industry === 'education' ||
		industry === 'realestate' ||
		industry === 'restaurant'
	) {
		return industry;
	}
	return 'general';
}

export function actionNameForIndustry(industry: KeywordIndustryType, lang: AuditLang): string {
	return getIndustryProfile(registryTypeFromKeyword(industry)).actionName[lang];
}

export function getIndustryStrategy(industry: KeywordIndustryType | string | undefined): IndustryIntentStrategy {
	const key = (industry || 'general').toLowerCase();
	if (key in INDUSTRY_STRATEGIES) return INDUSTRY_STRATEGIES[key as KeywordIndustryType];
	return INDUSTRY_STRATEGIES.general;
}

/** Map crawl metadata / free-text to a pipeline industry. Unknown → `general`. */
export function resolveKeywordIndustry(input: {
	industryType?: string | null;
	category?: string | null;
	primaryKeyword?: string | null;
	brandName?: string | null;
	services?: string[] | null;
	domain?: string | null;
}): KeywordIndustryType {
	const hay = [
		input.category,
		input.primaryKeyword,
		input.brandName,
		input.domain,
		...(input.services ?? []),
	]
		.filter(Boolean)
		.join(' ');
	const raw = (input.industryType || '').trim();
	const normalized = raw.toLowerCase();

	if (normalized === 'veterinary' || /동물병원|수의사|펫케어|veterinary|pet\s*hospital/i.test(hay)) {
		return 'veterinary';
	}
	if (raw === 'MEDICAL' || normalized === 'medical' || /중입자|암치료|암센터|proton|cancer|종양|항암/i.test(hay)) {
		return 'medical';
	}
	if (normalized === 'fitness' || /필라테스|헬스장|헬스클럽|피트니스|요가원|health\s*club|exercise\s*gym/i.test(hay)) {
		return 'fitness';
	}
	if (normalized === 'education' || /입시\s*학원|보습\s*학원|과외|교육기관|hagwon|exam\s*prep/i.test(hay)) {
		return 'education';
	}
	if (normalized === 'realestate' || /공인중개사|부동산\s*중개|realtor|real\s*estate\s*agent/i.test(hay)) {
		return 'realestate';
	}
	if (normalized === 'restaurant' || /레스토랑|맛집|식당|외식|franchise\s*dining/i.test(hay)) {
		return 'restaurant';
	}
	if (normalized === 'legal' || /법률|변호사|법무|attorney|law\s*firm|legal\s*service/i.test(hay)) {
		return 'legal';
	}
	if (normalized === 'tax' || /세무|회계|소득세|부가세|기장|tax\s*service|accounting|\bcpa\b/i.test(hay)) {
		return 'tax';
	}
	if (normalized === 'interior' || /인테리어|interior\s*design|리모델링/i.test(hay)) {
		return 'interior';
	}
	if (normalized === 'beauty' || /뷰티|미용|헤어|네일|salon|beauty|피부관리/i.test(hay)) {
		return 'beauty';
	}
	if (raw === 'B2B_MFG' || normalized === 'b2b') return 'b2b';
	if (PIPELINE_INDUSTRIES.has(normalized)) return normalized as KeywordIndustryType;
	return 'general';
}
