/**
 * Ranked 1–3 core specialties from crawled title / meta keywords / nav menus.
 * Never injects unrelated verticals (e.g. 성형외과) unless those terms are on-page.
 */

import { isUiStopword, looksLikePlasticSpecialty } from '@/lib/geo/clean-medical-entities';

export type SpecialtyLang = 'ko' | 'en';

export interface SpecialtyCorpus {
	title?: string;
	metaKeywords?: string;
	navMenuTexts?: readonly string[];
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	schemaTerms?: readonly string[];
	targetKeywords?: readonly string[];
	category?: string;
	primaryKeyword?: string;
	h2Texts?: readonly string[];
	lang?: SpecialtyLang;
}

export interface SpecialtyHit {
	phrase: string;
	cluster: string;
	weight: number;
}

const TITLE_SPLIT = /\s*[|\-–—·•\/]\s*/;

const PLASTIC_STRONG_RE =
	/성형외과|성형수술|성형시술|미용성형|쌍꺼풀|눈성형|코성형|가슴성형|윤곽성형|지방흡입|rhinoplast|blepharoplast|liposuction|plastic\s*surg/i;

const PLASTIC_INDUSTRIAL_RE = /사출성형|가소성형|압출성형|성형품/;

type SpecialtyRule = {
	test: RegExp;
	ko: string;
	en: string;
	cluster: string;
	weight: number;
	/** Require a strong on-page plastic signal before this rule can fire. */
	requiresPlastic?: boolean;
};

const SPECIALTY_RULES: SpecialtyRule[] = [
	{
		test: /정형\s*[·・\/]?\s*통증|통증\s*[·・\/]?\s*정형/i,
		ko: '정형·통증클리닉',
		en: 'ortho-pain clinic',
		cluster: 'rehab',
		weight: 13,
	},
	{ test: /스포츠\s*재활|sports?\s*rehab/i, ko: '스포츠재활', en: 'sports rehab', cluster: 'rehab', weight: 12 },
	{ test: /도수치료|도수\s*치료|manual\s*therap/i, ko: '도수치료', en: 'manual therapy', cluster: 'rehab', weight: 12 },
	{ test: /아동\s*발달|소아\s*재활|발달센터|child\s*develop|pediatric\s*rehab/i, ko: '아동발달센터', en: 'child development center', cluster: 'child', weight: 12 },
	{ test: /정형외과|orthopedic/i, ko: '정형외과', en: 'orthopedics', cluster: 'rehab', weight: 9 },
	{ test: /통증의학|통증클리닉|통증치료|pain\s*clinic/i, ko: '통증클리닉', en: 'pain clinic', cluster: 'rehab', weight: 9 },
	{ test: /재활의학|재활치료|재활의학과|physiotherapy|rehab/i, ko: '재활', en: 'rehabilitation', cluster: 'rehab', weight: 7 },
	{
		test: /성형외과|성형수술|성형시술|미용성형|plastic\s*surg/i,
		ko: '성형외과',
		en: 'plastic surgery',
		cluster: 'plastic',
		weight: 12,
		requiresPlastic: true,
	},
	{ test: /피부과|dermatolog|skin\s*clinic/i, ko: '피부과', en: 'dermatology', cluster: 'derm', weight: 9 },
	{ test: /보톡스|필러|울쎄라|리프팅|botox|filler|ulthera/i, ko: '피부시술', en: 'skin treatment', cluster: 'derm', weight: 8 },
	{ test: /임플란트|implant/i, ko: '임플란트', en: 'implants', cluster: 'dental', weight: 10 },
	{ test: /치아교정|교정치료|orthodont/i, ko: '치아교정', en: 'orthodontics', cluster: 'dental', weight: 9 },
	{ test: /치과|dentist|dental\b/i, ko: '치과', en: 'dental clinic', cluster: 'dental', weight: 8 },
	{ test: /한의원|추나|oriental\s*medicine/i, ko: '한의원', en: 'Korean medicine clinic', cluster: 'clinic', weight: 8 },
	{ test: /안과|ophthalm|eye\s*clinic/i, ko: '안과', en: 'eye clinic', cluster: 'clinic', weight: 8 },
	{ test: /이비인후|ent\s*clinic/i, ko: '이비인후과', en: 'ENT clinic', cluster: 'clinic', weight: 8 },
	{ test: /산부인|obstetric|gynecol/i, ko: '산부인과', en: 'OB/GYN', cluster: 'clinic', weight: 8 },
	{ test: /내과|internal\s*medicine/i, ko: '내과', en: 'internal medicine', cluster: 'clinic', weight: 7 },
	{ test: /중입자|탄소이온|carbon[-\s]?ion|proton[-\s]?therap/i, ko: '중입자치료', en: 'carbon-ion therapy', cluster: 'cancer', weight: 13 },
	{ test: /암치료|암센터|oncolog|cancer\s*(clinic|center|treatment)/i, ko: '암치료', en: 'cancer treatment', cluster: 'cancer', weight: 9 },
	{ test: /연예인\s*섭외|섭외\s*에이전시/i, ko: '연예인 섭외', en: 'talent booking', cluster: 'agency', weight: 11 },
	{ test: /행사\s*기획|이벤트\s*기획/i, ko: '행사 기획', en: 'event planning', cluster: 'agency', weight: 9 },
	{ test: /현장\s*운영/i, ko: '현장 운영', en: 'on-site operations', cluster: 'agency', weight: 8 },
	{ test: /행사\s*대행|이벤트\s*대행/i, ko: '행사 대행', en: 'event agency', cluster: 'agency', weight: 8 },
	{ test: /섭외/i, ko: '섭외', en: 'booking', cluster: 'agency', weight: 8 },
	{ test: /에이전시|agency/i, ko: '에이전시', en: 'agency', cluster: 'agency', weight: 7 },
];

function clean(value: unknown, max = 60): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function uniq(items: string[], limit = 8): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = clean(raw, 40);
		if (!v || v.length < 2) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

export function hasStrongPlasticSignal(corpus: string): boolean {
	if (!corpus) return false;
	if (PLASTIC_INDUSTRIAL_RE.test(corpus) && !PLASTIC_STRONG_RE.test(corpus)) return false;
	return PLASTIC_STRONG_RE.test(corpus);
}

export function filterNavMenuTexts(raw: readonly string[] | undefined | null): string[] {
	if (!raw?.length) return [];
	return uniq(
		raw.filter((name) => {
			const v = clean(name, 40);
			if (!v || v.length > 28) return false;
			if (isUiStopword(v)) return false;
			return true;
		}),
		16,
	);
}

function sourceBonus(rule: SpecialtyRule, bags: { nav: string; title: string; meta: string; rest: string }): number {
	let bonus = 0;
	if (rule.test.test(bags.nav)) bonus += 8;
	if (rule.test.test(bags.title)) bonus += 6;
	if (rule.test.test(bags.meta)) bonus += 5;
	if (rule.test.test(bags.rest)) bonus += 2;
	return bonus;
}

function phraseFor(rule: SpecialtyRule, lang: SpecialtyLang): string {
	return lang === 'en' ? rule.en : rule.ko;
}

/**
 * Ranked 1–3 specialties actually evidenced on the page.
 * Related-cluster extras are not invented.
 */
export function extractCoreSpecialties(input: SpecialtyCorpus): string[] {
	const lang: SpecialtyLang = input.lang === 'en' ? 'en' : 'ko';
	const nav = filterNavMenuTexts(input.navMenuTexts).join(' · ');
	const title = [input.title, input.ogTitle].filter(Boolean).join(' · ');
	const onPageMeta = [input.metaKeywords, input.description, input.ogDescription, ...(input.h2Texts ?? [])]
		.filter(Boolean)
		.join(' · ');
	/** Leftover session keywords / prior category must not unlock plastic. */
	const onPageEvidence = `${nav} ${title} ${onPageMeta}`;
	const meta = [input.metaKeywords, ...(input.targetKeywords ?? [])].filter(Boolean).join(' · ');
	const rest = [
		input.description,
		input.ogDescription,
		...(input.schemaTerms ?? []),
		...(input.h2Texts ?? []),
		input.category,
		input.primaryKeyword,
	]
		.filter(Boolean)
		.join(' · ');
	const full = `${nav} ${title} ${meta} ${rest}`;
	const plasticOk = hasStrongPlasticSignal(onPageEvidence);
	const bags = { nav, title, meta, rest };

	const hits: SpecialtyHit[] = [];
	for (const rule of SPECIALTY_RULES) {
		if (rule.requiresPlastic && !plasticOk) continue;
		if (rule.cluster === 'plastic' && !plasticOk) continue;
		rule.test.lastIndex = 0;
		if (!rule.test.test(full)) continue;
		const weight = rule.weight + sourceBonus(rule, bags);
		hits.push({ phrase: phraseFor(rule, lang), cluster: rule.cluster, weight });
	}

	const hasOrtho = hits.some((h) => /정형/.test(h.phrase) || /ortho/i.test(h.phrase));
	const hasPain = hits.some((h) => /통증|pain/i.test(h.phrase));
	if (hasOrtho && hasPain) {
		const combo = lang === 'en' ? 'ortho-pain clinic' : '정형·통증클리닉';
		const comboWeight = Math.max(...hits.filter((h) => h.cluster === 'rehab').map((h) => h.weight), 0) + 3;
		hits.unshift({ phrase: combo, cluster: 'rehab', weight: comboWeight });
	}

	hits.sort((a, b) => b.weight - a.weight);

	const seenClusterPhrase = new Set<string>();
	const ranked: string[] = [];
	for (const hit of hits) {
		const key = hit.phrase.toLowerCase();
		if (seenClusterPhrase.has(key)) continue;
		if (hit.phrase === (lang === 'en' ? 'ortho-pain clinic' : '정형·통증클리닉')) {
			seenClusterPhrase.add(lang === 'en' ? 'orthopedics' : '정형외과');
			seenClusterPhrase.add(lang === 'en' ? 'pain clinic' : '통증클리닉');
		}
		if (
			ranked.some((existing) => {
				const left = existing.toLowerCase();
				const right = key;
				return left.includes(right) || right.includes(left);
			})
		) {
			continue;
		}
		seenClusterPhrase.add(key);
		ranked.push(hit.phrase);
		if (ranked.length >= 3) break;
	}

	if (ranked.length) return ranked;

	const fallbacks = uniq(
		[input.primaryKeyword, input.category, ...(input.targetKeywords ?? []), ...title.split(TITLE_SPLIT)].filter(
			(v): v is string =>
				Boolean(
					v &&
						!isUiStopword(v) &&
						(!looksLikePlasticSpecialty(v) || plasticOk),
				),
		),
		3,
	);
	return fallbacks.slice(0, 3);
}

/** Query-facing noun: keep 센터/클리닉 as-is, otherwise leave the specialty phrase. */
export function specialtyQueryNoun(spec: string, lang: SpecialtyLang = 'ko'): string {
	const v = (spec || '').replace(/\s+/g, ' ').trim();
	if (!v) return lang === 'en' ? 'clinic' : '진료';
	if (/정형·통증|ortho-pain/i.test(v)) return lang === 'en' ? 'ortho-pain clinic' : '정형외과 통증의원';
	return v;
}
