import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveReportTrack3Score } from '@/lib/audit/pagespeed';
import { gradeForHttps, type ScoreGrade } from '@/lib/audit/score-grade';
import { resolveTargetBrandName } from '@/lib/audit/target-entity';
import type { IndustryType as LegacyIndustryType } from '@/lib/audit/site-metadata';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';
import { seedTargetKeywordFromContext } from '@/lib/strategy/default-keyword';
import type {
	KnownPageRole,
	StrategyAuditContext,
	StrategyIndustryProfileRef,
	StrategyIssue,
	StrategyKnownPage,
	StrategyLoadSource,
	StrategyScoreBoard,
	StrategyStudioState,
	TargetKeywordState,
} from '@/lib/strategy/types';

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function uniquePhrases(values: readonly (string | null | undefined)[]): string[] {
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

function measured(value: number | null | undefined, grade?: ScoreGrade): StrategyScoreBoard['seo'] {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return grade ? { value: Math.round(value), grade } : { value: Math.round(value) };
}

function checkStatus(check: AuditCheckItem): 'pass' | 'fail' | 'warning' {
	if (check.status === 'pass' || check.status === 'fail' || check.status === 'warning') return check.status;
	return check.passed ? 'pass' : 'fail';
}

function collectIssues(report: AuditReport): StrategyIssue[] {
	const fromFindings: StrategyIssue[] = (report.findings || []).map((finding, index) => ({
		id: finding.checkId || `finding-${index}`,
		title: compact(finding.title),
		detail: compact(finding.detail) || undefined,
		severity: finding.severity,
	}));

	const checks = report.checklist?.length
		? report.checklist
		: report.categories?.flatMap((category) => category.checks) ?? [];

	const fromChecks: StrategyIssue[] = checks
		.filter((check) => checkStatus(check) !== 'pass')
		.map((check) => ({
			id: check.id,
			title: compact(check.label),
			detail: compact(check.evidence || check.why) || undefined,
			severity: checkStatus(check) === 'warning' ? 'warning' : 'fail',
		}));

	const seen = new Set<string>();
	const merged: StrategyIssue[] = [];
	for (const issue of [...fromFindings, ...fromChecks]) {
		if (!issue.title) continue;
		const key = `${issue.id}:${issue.title}`;
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(issue);
	}
	return merged;
}

function collectRecommendations(report: AuditReport): string[] {
	const out: string[] = [];
	const summary = report.executiveSummary;
	if (summary?.weaknessPoint?.text) out.push(compact(summary.weaknessPoint.text));
	if (summary?.expectedResult?.text) out.push(compact(summary.expectedResult.text));

	const checks = report.checklist?.length
		? report.checklist
		: report.categories?.flatMap((category) => category.checks) ?? [];
	for (const check of checks) {
		if (checkStatus(check) === 'pass') continue;
		const impact = compact(check.impact);
		if (impact) out.push(impact);
		if (out.length >= 6) break;
	}
	return uniquePhrases(out).slice(0, 6);
}

function classifyPageRole(url: string, label: string): KnownPageRole {
	const hay = `${url} ${label}`.toLowerCase();
	if (/faq|qna|질문/.test(hay)) return 'faq';
	if (/위치|오시는|찾아오|contact|location|map|direction|주차/.test(hay)) return 'local';
	if (/의료진|원장|staff|doctor|about|소개|팀|attorney|trainer|원장인사|인사말/.test(hay)) return 'person';
	if (/질환|칼럼|정보|column|blog|info|disease|증상|건강정보/.test(hay)) return 'condition';
	if (/서비스|진료|시술|메뉴|service|treat|program|lesson|상담/.test(hay)) return 'service';
	try {
		const path = new URL(url).pathname.replace(/\/+$/, '');
		if (!path || path === '/') return 'home';
	} catch {
		if (!url || url.endsWith('/')) return 'home';
	}
	return 'other';
}

function sameHost(candidate: string, origin: string): boolean {
	try {
		return new URL(candidate).hostname.replace(/^www\./, '') === new URL(origin).hostname.replace(/^www\./, '');
	} catch {
		return false;
	}
}

function absolutize(href: string, origin: string): string | null {
	try {
		return new URL(href, origin).toString();
	} catch {
		return null;
	}
}

function collectKnownPages(report: AuditReport): StrategyKnownPage[] {
	const origin = compact(report.finalUrl || report.url);
	const seen = new Map<string, StrategyKnownPage>();

	const add = (rawUrl: string, label: string, source: StrategyKnownPage['source']) => {
		const url = absolutize(rawUrl, origin);
		if (!url || !sameHost(url, origin)) return;
		const key = url.replace(/\/+$/, '').toLowerCase();
		const role = classifyPageRole(url, label);
		const next: StrategyKnownPage = { url, label: compact(label) || url, role, source };
		const prev = seen.get(key);
		if (!prev) {
			seen.set(key, next);
			return;
		}
		if (prev.label === prev.url && next.label !== next.url) seen.set(key, { ...next, role: prev.role === 'other' ? next.role : prev.role });
	};

	add(origin, resolveTargetBrandName(report) || 'Home', 'audit-url');
	for (const item of report.navItems ?? []) {
		if (item.url) add(item.url, item.name || item.menu1 || item.url, 'nav');
	}
	for (const href of report.collectedUrls ?? []) add(href, href, 'collected');
	for (const page of report.pageMetas ?? []) {
		const href = page.urlPath.startsWith('http') ? page.urlPath : page.urlPath;
		add(href, page.h1 || page.title || page.urlPath, 'page-meta');
	}
	return [...seen.values()].slice(0, 24);
}

export function mapIndustryProfile(
	report: AuditReport,
	lang: AuditLang,
): StrategyIndustryProfileRef {
	const meta = report.siteMeta;
	const config = resolveIndustryConfigFromSite({
		lang,
		brandName: meta?.brandName,
		location: meta?.location || meta?.broadLocation,
		primaryKeyword: meta?.primaryKeyword,
		category: meta?.category,
		services: meta?.coreSpecialties,
		domain: meta?.domain,
		url: report.url,
		legacyIndustry: meta?.industryType,
		title: meta?.title,
		description: meta?.metaDescription,
		keywords: meta?.detectedKeywords,
		schemaTypes: meta?.schemaEntityTypes,
		navMenuTexts: meta?.navMenuTexts,
	});
	return {
		registryType: config.type,
		legacyType: (meta?.industryType || 'GENERAL') as LegacyIndustryType,
		label: compact(config.defaultCategory) || compact(config.profile.label[lang]) || (lang === 'en' ? 'General' : '일반'),
		schemaType: config.schemaType,
		specialties: uniquePhrases(meta?.coreSpecialties ?? []),
	};
}

export function mapAuditContext(
	report: AuditReport,
	opts: { auditId?: string | null; source: StrategyLoadSource; lang?: AuditLang },
): StrategyAuditContext {
	const lang: AuditLang = opts.lang === 'en' ? 'en' : report.lang === 'en' ? 'en' : 'ko';
	const meta = report.siteMeta;
	const snapshot = buildDiagnosisScoreSnapshot(report, null, lang, {
		coreWebVitalsScore100: resolveReportTrack3Score(report),
	});
	const industry = mapIndustryProfile(report, lang);
	const location =
		compact(meta?.location) || compact(meta?.broadLocation) || compact(meta?.addressLocality) || null;
	const subIndustry = industry.specialties[0] || null;
	const schemaTypes = uniquePhrases([...(meta?.schemaEntityTypes ?? []), ...(report.metrics?.schemaTypes ?? [])]);
	const competitors = report.realCompetitors?.names?.length
		? {
				query: compact(report.realCompetitors.query) || undefined,
				names: uniquePhrases(report.realCompetitors.names),
				clientRank: report.realCompetitors.clientRank,
				source: report.realCompetitors.source,
			}
		: null;

	return {
		auditId: opts.auditId?.trim() || null,
		url: report.url,
		siteName: resolveTargetBrandName(report),
		industry: industry.label,
		industryType: industry.legacyType,
		subIndustry,
		location,
		scores: {
			seo: measured(snapshot.technicalScore, snapshot.technicalGrade),
			geo: measured(snapshot.externalTrustScore, snapshot.geoGrade),
			aeo: null,
			entity: measured(snapshot.geoComprehensive.pillars.entity?.percentage),
			local: measured(snapshot.geoComprehensive.pillars.local_nap?.percentage),
			content: null,
			trust: null,
			measured: measured(snapshot.measuredScore, snapshot.grade),
		},
		entities: {
			brandName: compact(meta?.brandName) || undefined,
			organizationName: compact(meta?.organizationName) || undefined,
			representativeName: compact(meta?.representativeName || report.ceoName) || undefined,
			businessEntity: compact(meta?.businessEntity) || undefined,
			phrases: uniquePhrases(meta?.entityPhrases ?? []),
			schemaTypes,
		},
		localSignals: {
			location: compact(meta?.location) || undefined,
			broadLocation: compact(meta?.broadLocation) || undefined,
			address: compact(meta?.address) || undefined,
			addressLocality: compact(meta?.addressLocality) || undefined,
			addressRegion: compact(meta?.addressRegion) || undefined,
			telephone: compact(meta?.telephone) || undefined,
			hasGeo: Boolean(meta?.geo?.latitude && meta?.geo?.longitude),
			hasOpeningHours: Boolean(meta?.openingHours),
			sameAsCount: meta?.sameAs?.length ?? 0,
		},
		contentSignals: {
			bodyTextLength: report.metrics?.bodyTextLength,
			h1Count: report.metrics?.h1Count,
			faqCount: meta?.faqItems?.length,
		},
		trustSignals: {
			isHttps: snapshot.isHttps,
			sameAsCount: meta?.sameAs?.length ?? 0,
		},
		schema: {
			coverage: typeof report.schemaCoverage === 'number' ? report.schemaCoverage : undefined,
			types: schemaTypes,
		},
		pages: collectKnownPages(report),
		issues: collectIssues(report),
		recommendations: collectRecommendations(report),
		competitors,
		fetchedAt: report.fetchedAt,
		source: opts.source,
	};
}

export function seedTargetKeyword(report: AuditReport, lang: AuditLang): TargetKeywordState {
	const auditContext = mapAuditContext(report, { source: 'latest-payload', lang });
	const industryProfile = mapIndustryProfile(report, lang);
	if (!auditContext || !industryProfile) {
		const seed = compact(businessConversionFromAudit(report, null, lang).targetQuery) || null;
		return { seed, value: seed || '' };
	}
	return seedTargetKeywordFromContext(auditContext, industryProfile, lang);
}

export function buildStudioState(
	report: AuditReport,
	opts: { auditId?: string | null; source: StrategyLoadSource; lang?: AuditLang },
): StrategyStudioState {
	const lang: AuditLang = opts.lang === 'en' ? 'en' : report.lang === 'en' ? 'en' : 'ko';
	const auditContext = mapAuditContext(report, { ...opts, lang });
	const industryProfile = mapIndustryProfile(report, lang);
	return {
		auditContext,
		industryProfile,
		targetKeyword:
			auditContext && industryProfile
				? seedTargetKeywordFromContext(auditContext, industryProfile, lang)
				: { seed: null, value: '' },
		strategyResult: null,
	};
}
