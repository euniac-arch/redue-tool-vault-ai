import { attachPostposition, attachQuotedPostposition } from '@/lib/korean-josa';
import { getIndustryProfile } from '@/lib/registry/universalIndustryRegistry';
import { buildAiCitationModules } from '@/lib/strategy/ai-citation';
import { focusPhrase, hasDistrictLocation, locationLabel } from '@/lib/strategy/normalize-keyword';
import type {
	BlueprintAction,
	BlueprintContentBlock,
	BlueprintInternalLink,
	BlueprintLocal,
	BlueprintPageStrategy,
	BlueprintSchema,
	BlueprintSchemaCandidate,
	BlueprintSeo,
	ExecutionBlueprint,
	ExecutionCopyUnit,
	KnownPageRole,
	NormalizedKeyword,
	PageStrategyKind,
	SearchIntentId,
	StrategyActionPlan,
	StrategyAuditContext,
	StrategyExecutionSample,
	StrategyGap,
	StrategyIndustryProfileRef,
	StrategyKnownPage,
	StrategyLang,
} from '@/lib/strategy/types';

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function unique(values: readonly (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = compact(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

function squeeze(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

const INTENT_LABEL: Record<SearchIntentId, { ko: string; en: string }> = {
	local: { ko: 'LOCAL', en: 'LOCAL' },
	category: { ko: 'CATEGORY', en: 'CATEGORY' },
	service: { ko: 'SERVICE', en: 'SERVICE' },
	problem: { ko: 'PROBLEM', en: 'PROBLEM' },
	comparison: { ko: 'COMPARISON', en: 'COMPARISON' },
	recommendation: { ko: 'RECOMMENDATION', en: 'RECOMMENDATION' },
	list: { ko: 'LIST', en: 'LIST' },
	naturalLanguage: { ko: 'NATURAL LANGUAGE', en: 'NATURAL LANGUAGE' },
	aiRecommendation: { ko: 'AI RECOMMENDATION', en: 'AI RECOMMENDATION' },
};

const PAGE_TYPE_LABEL: Record<PageStrategyKind, { ko: string; en: string }> = {
	local_industry_guide: { ko: '지역 + 업종 가이드', en: 'Local + category guide' },
	service_hub: { ko: '서비스 허브', en: 'Service hub' },
	specialist_content: { ko: '전문 콘텐츠', en: 'Specialist content' },
	selection_guide: { ko: '선택 가이드', en: 'Selection guide' },
};

const ROLE_LABEL: Record<KnownPageRole, { ko: string; en: string }> = {
	home: { ko: '홈', en: 'Home' },
	service: { ko: '서비스 페이지', en: 'Service page' },
	condition: { ko: '주제 / 질환 콘텐츠', en: 'Topic / condition page' },
	person: { ko: '담당자 / 소개', en: 'People / about' },
	local: { ko: '지역 / 위치 페이지', en: 'Location page' },
	faq: { ko: 'FAQ', en: 'FAQ' },
	other: { ko: '기타 확인 페이지', en: 'Other confirmed page' },
};

function resolvePageType(intents: SearchIntentId[], parsed: NormalizedKeyword): PageStrategyKind {
	if (intents.includes('problem') || parsed.problem) return 'specialist_content';
	if (intents.includes('service') && parsed.service) return 'service_hub';
	if (intents.includes('recommendation') || intents.includes('list') || intents.includes('comparison')) {
		return 'selection_guide';
	}
	return 'local_industry_guide';
}

function draftSlug(parsed: NormalizedKeyword, keyword: string): string {
	const structured = unique([...parsed.location, parsed.industry, parsed.service, parsed.problem]).filter(Boolean);
	const parts = structured.length ? structured : [keyword];
	return (
		parts
			.join('-')
			.replace(/\s+/g, '-')
			.replace(/[^\w가-힣-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 80) || 'guide'
	);
}

function hasType(types: readonly string[], needle: string): boolean {
	return types.some((type) => type.toLowerCase() === needle.toLowerCase());
}

function isLocalBusinessFamily(type: string): boolean {
	return /localbusiness|medicalclinic|medicalbusiness|dentist|hospital|legalservice|accountingservice|beautysalon|healthclub|veterinarycare|restaurant|realestateagent|professionalservice/i.test(
		type,
	);
}

function buildPageStrategy(
	keyword: string,
	intents: SearchIntentId[],
	parsed: NormalizedKeyword,
	lang: StrategyLang,
): BlueprintPageStrategy {
	const pageType = resolvePageType(intents, parsed);
	return {
		keyword,
		pageType,
		pageTypeLabel: PAGE_TYPE_LABEL[pageType][lang],
		intents,
		intentLabel: intents.map((intent) => INTENT_LABEL[intent][lang]).join(' + ') || (lang === 'en' ? 'Unclassified' : '미분류'),
	};
}

function buildSeo(
	sample: StrategyExecutionSample,
	parsed: NormalizedKeyword,
	ctx: StrategyAuditContext,
	lang: StrategyLang,
): BlueprintSeo {
	return {
		title: sample.title,
		metaDescription: sample.metaDescription,
		h1: sample.h1,
		h2: sample.h2,
		urlSlug: `/${draftSlug(parsed, sample.keyword)}`,
		slugNote:
			lang === 'en'
				? 'Draft slug for a page you may create. It is not a live URL.'
				: '신규 페이지용 초안 슬러그입니다. 존재하는 URL이 아닙니다.',
		canonical: ctx.url,
		canonicalNote:
			lang === 'en'
				? 'Canonical stays on the official audited URL unless you publish a dedicated page.'
				: '전용 페이지를 발행하기 전에는 진단된 공식 URL을 canonical로 둡니다.',
	};
}

function buildAeo(
	sample: StrategyExecutionSample,
	parsed: NormalizedKeyword,
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): ExecutionBlueprint['aeo'] {
	const catalog = getIndustryProfile(profile.registryType);
	const loc = locationLabel(parsed) || compact(ctx.location);
	const focus = focusPhrase(parsed);
	const brand = compact(ctx.siteName || ctx.entities.brandName) || catalog.label[lang];
	const faq = sample.faqs[0];
	const related = unique([parsed.service, parsed.industry, ...profile.specialties, catalog.mainService[lang]]).slice(0, 3);
	const shortAnswer = sample.answer;
	const detail = loc
		? lang === 'en'
			? `On the official ${brand} page, keep the ${catalog.personJobTitle.en}, the named scope of ${focus}, and the ${loc} address and phone on the same screen. If those three match, treat the page as the official source.`
			: `${brand} 공식 페이지에서 ${catalog.personJobTitle.ko}, ${focus} 범위, ${loc} 주소와 전화를 같은 화면에서 확인할 수 있어야 합니다. 세 가지가 같으면 공식 출처로 삼을 수 있습니다.`
		: lang === 'en'
			? `On the official ${brand} page, keep the ${catalog.personJobTitle.en} and the named scope of ${focus} together.`
			: `${brand} 공식 페이지에서 ${attachPostposition(catalog.personJobTitle.ko, '과/와')} ${focus} 범위를 함께 확인할 수 있어야 합니다.`;
	return {
		question:
			faq?.q ||
			(lang === 'en' ? `What should I check when choosing ${focus}?` : `${attachPostposition(focus, '을/를')} 선택할 때 무엇을 확인해야 하나요?`),
		shortAnswer,
		detail,
		relatedServices: related,
	};
}

function buildGeo(
	sample: StrategyExecutionSample,
	parsed: NormalizedKeyword,
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): ExecutionBlueprint['geo'] {
	const catalog = getIndustryProfile(profile.registryType);
	const brand = compact(ctx.siteName || ctx.entities.brandName) || catalog.label[lang];
	const loc = locationLabel(parsed) || compact(ctx.location);
	const chain = [
		{ id: 'brand', role: 'Brand', label: brand },
		{ id: 'institution', role: catalog.defaultCategory[lang], label: catalog.schemaType },
		parsed.industry || profile.specialties[0]
			? { id: 'category', role: lang === 'en' ? 'Category' : '업종', label: parsed.industry || profile.specialties[0] }
			: null,
		parsed.service || catalog.mainService[lang]
			? {
					id: 'service',
					role: lang === 'en' ? 'Service' : '서비스',
					label: parsed.service || catalog.mainService[lang],
				}
			: null,
		parsed.problem
			? { id: 'condition', role: lang === 'en' ? 'Condition' : '증상 / 주제', label: parsed.problem }
			: null,
		loc ? { id: 'location', role: lang === 'en' ? 'Location' : '지역', label: loc } : null,
	].filter((node): node is NonNullable<typeof node> => Boolean(node));
	return { chain, entitySentence: sample.entitySentence };
}

function buildContent(
	seo: BlueprintSeo,
	aeo: ExecutionBlueprint['aeo'],
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): BlueprintContentBlock[] {
	const catalog = getIndustryProfile(profile.registryType);
	const brand = compact(ctx.siteName) || catalog.label[lang];
	const loc = compact(ctx.location);
	return [
		{ id: 'h1', label: 'H1', text: seo.h1 },
		{
			id: 'introduction',
			label: 'Introduction',
			text:
				lang === 'en'
					? `${brand} publishes official selection facts for this query${loc ? ` in ${loc}` : ''}.`
					: `${loc ? `${loc}에서 ` : ''}${aeo.question.includes('선택') ? '선택 기준을' : '확인 기준을'} ${brand} 공식 정보로 안내합니다.`,
		},
		{ id: 'question', label: 'Question', text: aeo.question },
		{ id: 'answer', label: 'Answer', text: aeo.shortAnswer },
		{
			id: 'evidence',
			label: 'Evidence',
			text:
				lang === 'en'
					? `Publish matching address and phone, the named service scope, and the ${catalog.personJobTitle.en}.`
					: `주소·전화, 명시한 서비스 범위, ${attachPostposition(catalog.personJobTitle.ko, '을/를')} 같은 페이지에 공개하세요.`,
		},
		{
			id: 'service',
			label: 'Service',
			text: aeo.relatedServices.join(lang === 'en' ? ' · ' : ' · ') || catalog.mainService[lang],
		},
		{ id: 'faq', label: 'FAQ', text: `${aeo.question} / ${aeo.shortAnswer}` },
		{
			id: 'cta',
			label: 'CTA',
			text:
				lang === 'en'
					? `Review the official ${catalog.actionName.en} facts on this site before treating it as a source.`
					: `출처로 삼기 전에 이 사이트의 공식 ${catalog.actionName.ko} 정보를 확인하세요.`,
		},
	];
}

function buildSchema(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	parsed: NormalizedKeyword,
	intents: SearchIntentId[],
	lang: StrategyLang,
): BlueprintSchema {
	const catalog = getIndustryProfile(profile.registryType);
	const present = ctx.schema.types;
	const candidates: BlueprintSchemaCandidate[] = [];

	const push = (type: string, status: BlueprintSchemaCandidate['status'], reason: string) => {
		if (candidates.some((item) => item.type === type)) return;
		candidates.push({ type, status, reason });
	};

	push(
		catalog.schemaType,
		hasType(present, catalog.schemaType) ? 'already_present' : 'consider',
		lang === 'en'
			? 'Core type from the industry profile. Prefer this over a generic parent.'
			: '업종 프로필의 핵심 타입입니다. 상위 일반 타입보다 이것을 우선합니다.',
	);

	if (isLocalBusinessFamily(catalog.schemaType) && catalog.schemaType !== 'LocalBusiness') {
		push(
			'LocalBusiness',
			'skip',
			lang === 'en'
				? `${catalog.schemaType} is already more specific. Do not add LocalBusiness on top.`
				: `${attachPostposition(catalog.schemaType, '이/가')} 더 구체적입니다. LocalBusiness를 추가로 넣지 않습니다.`,
		);
	} else if (ctx.location || ctx.localSignals.address) {
		push(
			'LocalBusiness',
			hasType(present, 'LocalBusiness') ? 'already_present' : 'consider',
			lang === 'en' ? 'Use only when a more specific local type is missing.' : '더 구체적인 로컬 타입이 없을 때만 검토합니다.',
		);
	}

	push(
		'Organization',
		hasType(present, 'Organization') ? 'already_present' : 'consider',
		lang === 'en'
			? 'Brand identity wrapper. Skip if the local type already carries name/url/logo.'
			: '브랜드 정체성용입니다. 로컬 타입에 name/url/logo가 있으면 중복 삽입하지 않습니다.',
	);

	if (profile.registryType === 'medical' && catalog.schemaType !== 'MedicalBusiness') {
		push(
			'MedicalBusiness',
			'skip',
			lang === 'en'
				? `${catalog.schemaType} is the tighter medical type. MedicalBusiness is optional, not required.`
				: `${attachPostposition(catalog.schemaType, '이/가')} 더 구체적입니다. MedicalBusiness는 필수가 아닙니다.`,
		);
	}

	const wantsFaq = intents.includes('problem') || intents.includes('aiRecommendation') || intents.includes('recommendation');
	push(
		'FAQPage',
		hasType(present, 'FAQPage') ? 'already_present' : wantsFaq ? 'consider' : 'skip',
		wantsFaq
			? lang === 'en'
				? 'This query shape benefits from one question/answer unit.'
				: '이 질의 형태는 질문-답변 단위가 있으면 좋습니다.'
			: lang === 'en'
				? 'Not required for this query shape. Add only if you publish real Q&A.'
				: '이 질의 형태에서는 필수가 아닙니다. 실제 Q&A를 쓸 때만 추가합니다.',
	);

	if (ctx.entities.representativeName || intents.includes('recommendation')) {
		push(
			'Person',
			hasType(present, 'Person') ? 'already_present' : 'consider',
			lang === 'en'
				? 'Add only when a named person is published on-page.'
				: '페이지에 실명 인물이 있을 때만 추가합니다.',
		);
	}

	const jsonLd: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': catalog.schemaType,
		name: compact(ctx.siteName || ctx.entities.brandName) || undefined,
		url: ctx.url,
	};
	if (ctx.localSignals.telephone) jsonLd.telephone = ctx.localSignals.telephone;
	const locality = ctx.localSignals.addressLocality || parsed.location[0] || compact(ctx.localSignals.broadLocation);
	if (ctx.localSignals.address || locality) {
		jsonLd.address = {
			'@type': 'PostalAddress',
			...(ctx.localSignals.address ? { streetAddress: ctx.localSignals.address } : {}),
			...(locality ? { addressLocality: locality } : {}),
			...(ctx.localSignals.addressRegion ? { addressRegion: ctx.localSignals.addressRegion } : {}),
		};
	}

	return {
		candidates,
		jsonLd,
		jsonLdText: JSON.stringify(jsonLd, null, 2),
		note:
			lang === 'en'
				? 'Preview only. Do not inject every type. Use types that match published facts.'
				: '미리보기입니다. 모든 타입을 넣지 마세요. 공개된 사실과 맞는 타입만 사용합니다.',
	};
}

function buildInternalLinks(ctx: StrategyAuditContext, lang: StrategyLang): BlueprintInternalLink[] {
	const wanted: KnownPageRole[] = ['service', 'condition', 'person', 'local'];
	const pages = ctx.pages || [];
	return wanted.map((role) => {
		const page = pages.find((item) => item.role === role);
		return {
			role,
			roleLabel: ROLE_LABEL[role][lang],
			url: page?.url ?? null,
			pageLabel: page?.label ?? null,
			note: page
				? lang === 'en'
					? 'Confirmed on the audited site.'
					: '진단에서 확인된 페이지입니다.'
				: lang === 'en'
					? 'No matching page was confirmed. A URL was not invented.'
					: '해당하는 확인 페이지가 없습니다. URL을 만들지 않았습니다.',
		};
	});
}

function auditPlaceCorpus(ctx: StrategyAuditContext): string {
	return squeeze(
		[
			ctx.location,
			ctx.localSignals.location,
			ctx.localSignals.broadLocation,
			ctx.localSignals.address,
			ctx.localSignals.addressLocality,
			ctx.localSignals.addressRegion,
		].join(' '),
	);
}

function tokensFromPlace(value: string | null | undefined): string[] {
	const text = compact(value);
	if (!text) return [];
	const out: string[] = [];
	for (const token of text.split(/\s+/)) {
		if (/[가-힣]{2,}|[A-Za-z]{3,}/.test(token)) out.push(token.replace(/광역시|특별시|자치시/g, '') || token);
	}
	const extras = text.match(/[가-힣]{1,6}(?:구|군|동|읍|면|역)/g) || [];
	return unique([...out, ...extras]).filter((token) => token !== '광역' && token.length > 1);
}

function buildLocal(parsed: NormalizedKeyword, ctx: StrategyAuditContext, lang: StrategyLang): BlueprintLocal {
	const corpus = auditPlaceCorpus(ctx);
	const fromAudit = unique([
		...tokensFromPlace(ctx.localSignals.broadLocation),
		...tokensFromPlace(ctx.location),
		...tokensFromPlace(ctx.localSignals.location),
		...tokensFromPlace(ctx.localSignals.addressLocality),
		...tokensFromPlace(ctx.localSignals.addressRegion),
		...tokensFromPlace(ctx.localSignals.address),
	]).filter((token) => corpus.includes(squeeze(token)));

	const overlap = parsed.location.filter((token) => corpus.includes(squeeze(token)));
	const chain = unique([...fromAudit, ...overlap]).map((label) => ({
		label,
		source: (overlap.includes(label) ? 'keyword-overlap' : ctx.localSignals.address?.includes(label) ? 'address' : 'audit') as BlueprintLocal['chain'][number]['source'],
	}));

	return {
		chain,
		note:
			chain.length === 0
				? lang === 'en'
					? 'No place tokens overlap the audited NAP. Nearby landmarks were not invented.'
					: '진단 NAP와 겹치는 지역 토큰이 없습니다. 주변 생활권을 만들지 않았습니다.'
				: lang === 'en'
					? 'Only tokens that appear in the audited location or address are linked.'
					: '진단 지역·주소에 있는 토큰만 연결했습니다. 없는 생활권은 추가하지 않습니다.',
	};
}

function buildAction(gaps: StrategyGap[], parsed: NormalizedKeyword, lang: StrategyLang): BlueprintAction {
	const focus = focusPhrase(parsed);
	const high = gaps.filter((gap) => gap.priority === 'HIGH').map((gap) => gap.strategy);
	const medium = gaps.filter((gap) => gap.priority === 'MEDIUM').map((gap) => gap.strategy);
	const low = gaps.filter((gap) => gap.priority === 'LOW').map((gap) => gap.strategy);
	const first =
		parsed.problem
			? lang === 'en'
				? `Publish a short official answer for “${parsed.problem}”`
				: `“${parsed.problem}”에 대한 짧은 공식 답변을 페이지에 올립니다`
			: parsed.service
				? lang === 'en'
					? `Name “${parsed.service}” in the official entity sentence`
					: `공식 Entity 문장에 ${attachQuotedPostposition(parsed.service, '을/를')} 명시합니다`
				: lang === 'en'
					? `Lock Title / H1 / first answer to ${focus}`
					: `Title · H1 · 첫 답변을 ${focus} 기준으로 고정합니다`;
	return {
		p0: unique([first, ...high]).slice(0, 3),
		p1: unique(medium.length ? medium : [lang === 'en' ? `Add FAQPage only if real Q&A exists for ${focus}` : `${focus} 실제 Q&A가 있을 때만 FAQPage를 추가합니다`]).slice(0, 3),
		p2: unique(low.length ? low : [lang === 'en' ? 'Re-audit after the content/schema pass' : '콘텐츠·스키마 반영 후 재진단']).slice(0, 3),
	};
}

function toActionPlan(action: BlueprintAction): StrategyActionPlan {
	return {
		today: action.p0,
		thisWeek: action.p1,
		next: action.p2,
		p0: action.p0,
		p1: action.p1,
		p2: action.p2,
	};
}

function copyUnits(seo: BlueprintSeo, aeo: ExecutionBlueprint['aeo'], geo: ExecutionBlueprint['geo'], schema: BlueprintSchema): ExecutionCopyUnit[] {
	return [
		{ id: 'title', label: 'Title', text: seo.title },
		{ id: 'meta', label: 'Meta', text: seo.metaDescription },
		{ id: 'h1', label: 'H1', text: seo.h1 },
		{ id: 'faq', label: 'FAQ', text: `Q. ${aeo.question}\nA. ${aeo.shortAnswer}` },
		{ id: 'answer', label: 'Answer', text: aeo.shortAnswer },
		{ id: 'entitySentence', label: 'Entity Sentence', text: geo.entitySentence },
		{ id: 'schema', label: 'Schema', text: schema.jsonLdText },
	];
}

export function confirmedInternalUrls(pages: StrategyKnownPage[] | undefined): string[] {
	return (pages || []).map((page) => page.url);
}

export function buildExecutionBlueprint(input: {
	keyword: string;
	sample: StrategyExecutionSample;
	parsed: NormalizedKeyword;
	intents: SearchIntentId[];
	gaps: StrategyGap[];
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
}): { blueprint: ExecutionBlueprint; actionPlan: StrategyActionPlan } {
	const { keyword, sample, parsed, intents, gaps, ctx, profile, lang } = input;
	const pageStrategy = buildPageStrategy(keyword, intents, parsed, lang);
	const seo = buildSeo(sample, parsed, ctx, lang);
	const aeo = buildAeo(sample, parsed, ctx, profile, lang);
	const geo = buildGeo(sample, parsed, ctx, profile, lang);
	const content = buildContent(seo, aeo, ctx, profile, lang);
	const schema = buildSchema(ctx, profile, parsed, intents, lang);
	const internalLinks = buildInternalLinks(ctx, lang);
	const local = buildLocal(parsed, ctx, lang);
	const action = buildAction(gaps, parsed, lang);
	const citation = buildAiCitationModules({ keyword, parsed, ctx, profile, lang });
	const blueprint: ExecutionBlueprint = {
		version: 1,
		keyword,
		pageStrategy,
		seo,
		aeo,
		geo,
		entity: geo,
		content,
		schema,
		internalLinks,
		local,
		action,
		copyUnits: copyUnits(seo, aeo, geo, schema),
		decisionMatrix: citation.decisionMatrix,
		ragChunks: citation.ragChunks,
		informationGain: citation.informationGain,
		safetySignals: citation.safetySignals,
		llmsTxt: citation.llmsTxt,
	};
	return { blueprint, actionPlan: toActionPlan(action) };
}

/** Stable export payload for a later Markdown/HTML/JSON/CSV download step. */
export function toBlueprintExportPayload(blueprint: ExecutionBlueprint): ExecutionBlueprint {
	return { ...blueprint, version: 1 };
}
