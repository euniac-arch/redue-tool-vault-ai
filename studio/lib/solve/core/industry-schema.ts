/**
 * Dynamic industry → Schema.org @type mapper.
 * Uses title / description / GNB / body corpus from the *current* audit only.
 * Never caches a previous site's hospital or brand name.
 */

export type IndustrySchemaBucket =
	| 'veterinary'
	| 'dental'
	| 'medical'
	| 'professional'
	| 'legal'
	| 'accounting'
	| 'education'
	| 'commerce'
	| 'local';

export type IndustrySchemaProfile = {
	bucket: IndustrySchemaBucket;
	orgTypes: string[];
	mainPageTypes: string[];
	serviceType: 'MedicalProcedure' | 'Service';
	jobTitle: string;
	knowsAbout: string[];
};

export type IndustrySchemaInput = {
	industryType?: string | null;
	siteName?: string | null;
	title?: string | null;
	description?: string | null;
	menuTexts?: readonly string[] | null;
	body?: string | null;
	footerText?: string | null;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function industryCorpus(input: IndustrySchemaInput): string {
	return [
		input.industryType,
		input.siteName,
		input.title,
		input.description,
		input.body,
		input.footerText,
		...(input.menuTexts || []),
	]
		.map(compact)
		.filter(Boolean)
		.join(' ');
}

/**
 * Priority: veterinary → dental → legal → accounting → education →
 * medical → commerce → professional → local fallback.
 */
export function classifyIndustrySchema(input: IndustrySchemaInput): IndustrySchemaProfile {
	const hay = industryCorpus(input);
	const industry = compact(input.industryType).toUpperCase();

	if (/동물병원|수의사|펫케어|반려동물|veterinary|pet\s*hospital|\bvet\b/i.test(hay)) {
		return {
			bucket: 'veterinary',
			orgTypes: ['VeterinaryCare', 'LocalBusiness'],
			mainPageTypes: ['MedicalWebPage', 'AboutPage', 'WebPage'],
			serviceType: 'MedicalProcedure',
			jobTitle: '대표원장',
			knowsAbout: ['반려동물 진료', '예방접종', '건강검진', '응급처치', '수술'],
		};
	}
	if (/치과|dental|dentist|임플란트|교정/i.test(hay) && !/법률|법무|attorney/i.test(hay)) {
		return {
			bucket: 'dental',
			orgTypes: ['Dentist', 'MedicalClinic', 'LocalBusiness'],
			mainPageTypes: ['MedicalWebPage', 'AboutPage', 'WebPage'],
			serviceType: 'MedicalProcedure',
			jobTitle: '대표원장',
			knowsAbout: ['임플란트', '치아교정', '충치치료', '스케일링', '구강검진'],
		};
	}
	if (/법률|법무|변호사|attorney|legal\s*service|law\s*firm/i.test(hay)) {
		return {
			bucket: 'legal',
			orgTypes: ['LegalService', 'LocalBusiness', 'Organization'],
			mainPageTypes: ['AboutPage', 'WebPage'],
			serviceType: 'Service',
			jobTitle: '대표변호사',
			knowsAbout: ['법률상담', '소송대리', '계약검토', '자문', '분쟁해결'],
		};
	}
	if (/세무|회계|노무|tax|accounting|bookkeep/i.test(hay)) {
		return {
			bucket: 'accounting',
			orgTypes: ['AccountingService', 'LocalBusiness', 'Organization'],
			mainPageTypes: ['AboutPage', 'WebPage'],
			serviceType: 'Service',
			jobTitle: '대표',
			knowsAbout: ['세무신고', '기장대리', '회계감사', '노무상담', '절세컨설팅'],
		};
	}
	if (/학원|교육기관|과외|입시|보습|tutoring|hagwon|academy|학교/i.test(hay)) {
		return {
			bucket: 'education',
			orgTypes: ['EducationalOrganization', 'LocalBusiness', 'Organization'],
			mainPageTypes: ['AboutPage', 'WebPage'],
			serviceType: 'Service',
			jobTitle: '원장',
			knowsAbout: ['입시상담', '교과지도', '학습컨설팅', '특강', '진학지도'],
		};
	}
	if (
		industry === 'MEDICAL' ||
		/의원|병원|클리닉|한의|의료|진료|physician|clinic|hospital/i.test(hay)
	) {
		return {
			bucket: 'medical',
			orgTypes: ['MedicalClinic', 'Physician', 'LocalBusiness'],
			mainPageTypes: ['MedicalWebPage', 'AboutPage', 'WebPage'],
			serviceType: 'MedicalProcedure',
			jobTitle: '대표원장',
			knowsAbout: ['진료상담', '건강검진', '전문치료', '예약안내', '사후관리'],
		};
	}
	if (
		industry === 'SHOP' ||
		industry === 'LOCAL_STORE' ||
		/쇼핑몰|스토어|온라인몰|커머스|영카트|youngcart|shop|store|mall|ecommerce|e-commerce/i.test(hay)
	) {
		return {
			bucket: 'commerce',
			orgTypes: ['OnlineStore', 'Store', 'LocalBusiness'],
			mainPageTypes: ['AboutPage', 'WebPage'],
			serviceType: 'Service',
			jobTitle: '대표',
			knowsAbout: ['상품안내', '주문배송', '고객지원', '교환반품', '멤버십'],
		};
	}
	if (
		/광고|마케팅|에이전시|대행사|컨설팅|디자인|IT\b|소프트웨어|agency|marketing|advertising|consulting|design/i.test(
			hay,
		)
	) {
		return {
			bucket: 'professional',
			orgTypes: ['ProfessionalService', 'LocalBusiness', 'Organization'],
			mainPageTypes: ['AboutPage', 'WebPage'],
			serviceType: 'Service',
			jobTitle: '대표',
			knowsAbout: ['전략컨설팅', '프로젝트수행', '전문상담', '성과분석', '사후관리'],
		};
	}
	return {
		bucket: 'local',
		orgTypes: ['LocalBusiness', 'Organization'],
		mainPageTypes: ['AboutPage', 'WebPage'],
		serviceType: 'Service',
		jobTitle: '대표',
		knowsAbout: ['전문 상담', '방문안내', '맞춤 서비스', '견적문의', '사후관리'],
	};
}

export function orgTypesToPhpArray(types: readonly string[]): string {
	return `array(${types.map((t) => `'${t}'`).join(', ')})`;
}

export function isMedicalIndustryBucket(bucket: IndustrySchemaBucket): boolean {
	return bucket === 'veterinary' || bucket === 'dental' || bucket === 'medical';
}

export type IndustryFaqItem = { q: string; a: string };
export type IndustryHowToStep = { position: number; name: string; text: string };

/** 3 industry-linked Q&As: 예약/상담 · 특장점 · 비용/프로세스. Uses the live site name only. */
export function buildIndustryFaqItems(
	siteName: string,
	profile: IndustrySchemaProfile,
	opts?: { telephone?: string; opens?: string; closes?: string },
): IndustryFaqItem[] {
	const site = compact(siteName) || '본 기관';
	const tel = compact(opts?.telephone);
	const opens = compact(opts?.opens) || '09:00';
	const closes = compact(opts?.closes) || '18:00';
	const telHint = tel ? ` 전화(${tel}) 또는 ` : ' ';
	const medical = isMedicalIndustryBucket(profile.bucket);

	if (profile.bucket === 'veterinary') {
		return [
			{
				q: `${site} 예약/상담은 어떻게 하나요?`,
				a: `${site}는${telHint}공식 웹사이트를 통해 진료·상담 일정을 예약하실 수 있습니다. 평일 ${opens}–${closes} 운영을 기준으로 안내합니다.`,
			},
			{
				q: `${site} 야간·응급 진료가 가능한가요?`,
				a: `${site} 야간·응급 가능 여부와 당일 접수 안내는 방문 전 공식 안내 페이지에서 확인해 주세요.`,
			},
			{
				q: `${site} 진료 비용과 이용 절차는 어떻게 되나요?`,
				a: `${site}는 상담 → 검사/진단 → 치료 계획 → 맞춤 진행 순으로 안내합니다. 상세 비용은 진료 항목에 따라 상담 시 안내됩니다.`,
			},
		];
	}
	if (medical) {
		return [
			{
				q: `${site} 예약/상담은 어떻게 하나요?`,
				a: `${site}는${telHint}공식 웹사이트를 통해 진료·상담 일정을 예약하실 수 있습니다. 평일 ${opens}–${closes} 운영을 기준으로 안내합니다.`,
			},
			{
				q: `${site}의 대표 진료 특장점은 무엇인가요?`,
				a: `${site}는 ${(profile.knowsAbout || []).slice(0, 3).join(', ') || '전문 진료'}를 중심으로 맞춤 상담과 사후관리를 제공합니다.`,
			},
			{
				q: `${site} 비용과 이용 절차는 어떻게 되나요?`,
				a: `${site}는 상담 접수 → 정밀 검사/진단 → 치료 계획 수립 → 맞춤 진행 및 사후관리 순으로 안내합니다. 상세 비용은 상담 시 안내됩니다.`,
			},
		];
	}
	if (profile.bucket === 'commerce') {
		return [
			{
				q: `${site} 주문/상담은 어떻게 하나요?`,
				a: `${site}는${telHint}공식 스토어에서 상품 문의와 주문을 진행할 수 있습니다.`,
			},
			{
				q: `${site}의 대표 서비스 특장점은 무엇인가요?`,
				a: `${site}는 ${(profile.knowsAbout || []).slice(0, 3).join(', ') || '상품 안내'}를 중심으로 주문부터 배송·고객지원까지 안내합니다.`,
			},
			{
				q: `${site} 배송/교환 프로세스는 어떻게 되나요?`,
				a: `${site}는 상담 → 주문 확인 → 출고/배송 → 교환·반품 안내 순으로 진행됩니다.`,
			},
		];
	}
	if (profile.bucket === 'education') {
		return [
			{
				q: `${site} 수강 상담은 어떻게 하나요?`,
				a: `${site}는${telHint}공식 웹사이트를 통해 상담·등록 일정을 안내받을 수 있습니다.`,
			},
			{
				q: `${site}의 교육 특장점은 무엇인가요?`,
				a: `${site}는 ${(profile.knowsAbout || []).slice(0, 3).join(', ') || '맞춤 학습'}를 중심으로 학습 설계와 진학 지도를 제공합니다.`,
			},
			{
				q: `${site} 수강 비용과 등록 절차는 어떻게 되나요?`,
				a: `${site}는 상담 접수 → 레벨/목표 진단 → 커리큘럼 설계 → 수강 및 피드백 순으로 진행됩니다.`,
			},
		];
	}
	return [
		{
			q: `${site} 상담/문의는 어떻게 하나요?`,
			a: `${site}는${telHint}공식 웹사이트를 통해 상담 일정을 안내받을 수 있습니다. 평일 ${opens}–${closes} 응대를 기준으로 합니다.`,
		},
		{
			q: `${site}의 대표 서비스 특장점은 무엇인가요?`,
			a: `${site}는 ${(profile.knowsAbout || []).slice(0, 3).join(', ') || '전문 상담'}를 중심으로 맞춤 제안과 사후관리를 제공합니다.`,
		},
		{
			q: `${site} 비용과 진행 프로세스는 어떻게 되나요?`,
			a: `${site}는 상담 접수 → 현황 진단 → 실행 계획 수립 → 맞춤 진행 및 사후관리 순으로 안내합니다.`,
		},
	];
}

/** 4-step HowTo: 접수 → 진단 → 계획 → 진행/사후관리. */
export function buildIndustryHowToSteps(
	siteName: string,
	profile: IndustrySchemaProfile,
): IndustryHowToStep[] {
	const site = compact(siteName) || '본 기관';
	if (isMedicalIndustryBucket(profile.bucket)) {
		return [
			{ position: 1, name: '상담/예약 접수', text: `온라인 또는 전화로 ${site} 상담·예약 일정을 접수합니다.` },
			{ position: 2, name: '정밀 검사/진단 및 맞춤 상담', text: '전문진이 상태를 확인하고 맞춤 상담을 진행합니다.' },
			{ position: 3, name: '서비스/치료 계획 수립', text: '검사 결과를 바탕으로 치료·케어 계획을 함께 정합니다.' },
			{ position: 4, name: '맞춤 진행 및 사후관리', text: '계획에 따라 진행한 뒤 경과 확인과 다음 일정을 안내합니다.' },
		];
	}
	if (profile.bucket === 'commerce') {
		return [
			{ position: 1, name: '상담/예약 접수', text: `${site}에서 상품 문의 또는 주문을 접수합니다.` },
			{ position: 2, name: '정밀 검사/진단 및 맞춤 상담', text: '재고·옵션·배송 조건을 확인하고 맞춤 안내를 받습니다.' },
			{ position: 3, name: '서비스/치료 계획 수립', text: '결제·출고 일정을 확정합니다.' },
			{ position: 4, name: '맞춤 진행 및 사후관리', text: '배송 후 교환·반품·고객지원을 안내합니다.' },
		];
	}
	if (profile.bucket === 'education') {
		return [
			{ position: 1, name: '상담/예약 접수', text: `${site}에 수강 상담을 신청합니다.` },
			{ position: 2, name: '정밀 검사/진단 및 맞춤 상담', text: '학습 목표와 현재 수준을 진단합니다.' },
			{ position: 3, name: '서비스/치료 계획 수립', text: '맞춤 커리큘럼과 일정 계획을 수립합니다.' },
			{ position: 4, name: '맞춤 진행 및 사후관리', text: '수업 진행과 피드백·진학 관리를 이어갑니다.' },
		];
	}
	return [
		{ position: 1, name: '상담/예약 접수', text: `${site}에 상담 또는 견적 문의를 접수합니다.` },
		{ position: 2, name: '정밀 검사/진단 및 맞춤 상담', text: '현황을 진단하고 요구사항을 정리합니다.' },
		{ position: 3, name: '서비스/치료 계획 수립', text: '범위·일정·비용을 포함한 실행 계획을 수립합니다.' },
		{ position: 4, name: '맞춤 진행 및 사후관리', text: '계획에 따라 수행하고 결과 점검과 사후관리를 진행합니다.' },
	];
}

/** PHP: never invent FAQ Q&A — only `$GLOBALS['schema_faq_items']` from live page content. */
export function buildIndustryFaqFallbackPhp(indent = '\t\t\t'): string {
	return `${indent}/* evidence-only FAQ — do not invent Q&A that is not on the page */\n`;
}

/** PHP: never invent HowTo steps — only `$GLOBALS['schema_howto_steps']`. */
export function buildIndustryHowToFallbackPhp(indent = '\t\t'): string {
	return `${indent}/* evidence-only HowTo — do not invent steps that are not on the page */\n`;
}

/** Split `상호 | 서브타이틀` into name + alternateName. */
export function splitAlternateName(raw: string): { name: string; alternateName?: string } {
	const text = compact(raw);
	if (!text) return { name: '' };
	const m = text.match(/^(.+?)\s*[|\-–—]\s+(.+)$/);
	if (!m) return { name: text };
	const name = compact(m[1]);
	const alt = compact(m[2]);
	if (!name || !alt || alt === name) return { name: text };
	return { name, alternateName: alt };
}
