import {
	evaluateGuideAnalysis,
	siteAuditFromReport,
	type SiteAuditResult,
} from '@/lib/analysis/evaluateAiBottlenecks';
import {
	generateSmartHashtags,
	isSchemaOrStopwordToken,
	stripHashtagPrefix,
	toKoreanIndustryLabel,
} from '@/lib/analysis/generateSmartHashtags';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { ensureGuideData } from '@/lib/guide/ensure-guide-data';
import { sanitizeGuideScores } from '@/lib/guide/scores';
import { createGuideId, suggestGuideSlug } from '@/lib/guide/slug';
import type { GuideHistoryRow } from '@/lib/guide/history-picker';
import type { AuditReport } from '@/lib/site-auditor';
import { GUIDE_SEO_MAX_DEFAULT, type GuideData, type GuideFaq, type GuideSocialLinks, type SubScores } from '@/lib/guide/types';
import { withJosa } from '@/lib/utils/korean';

function uniqueStrings(values: Array<string | undefined | null>, limit = 8): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const next = (raw || '').replace(/^#/, '').replace(/\s+/g, ' ').trim();
		if (!next || seen.has(next) || isSchemaOrStopwordToken(next)) continue;
		seen.add(next);
		out.push(next);
		if (out.length >= limit) break;
	}
	return out;
}

function classifySameAs(urls: string[]): GuideSocialLinks {
	const links: GuideSocialLinks = {};
	for (const raw of urls) {
		const value = raw.trim();
		if (!value) continue;
		let host = '';
		try {
			host = new URL(value).hostname.toLowerCase();
		} catch {
			host = value.toLowerCase();
		}
		if (!links.youtube && (host.includes('youtube.com') || host.includes('youtu.be'))) {
			links.youtube = value;
		} else if (!links.instagram && host.includes('instagram.com')) {
			links.instagram = value;
		} else if (!links.facebook && host.includes('facebook.com')) {
			links.facebook = value;
		} else if (
			!links.blog &&
			(host.includes('blog.naver.com') || host.includes('tistory.com') || host.includes('blog.'))
		) {
			links.blog = value;
		}
	}
	return links;
}

function looksLatin(value: string): boolean {
	return /[a-z]/i.test(value) && !/[가-힣]/.test(value);
}

function clamp100(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function enrichAuditFromSnapshot(audit: SiteAuditResult, report: AuditReport): SiteAuditResult {
	try {
		const snapshot = buildDiagnosisScoreSnapshot(report, null, 'ko');
		const pillarPct = (id: 'local_nap' | 'rag_authority' | 'entity'): number => {
			const pillar = snapshot.geoComprehensive.pillars[id];
			return clamp100(pillar?.percentage ?? 0);
		};
		const engineVals = Object.values(snapshot.engineScoreById).filter((n): n is number => Number.isFinite(n));
		const avgEngine = engineVals.length
			? engineVals.reduce((sum, n) => sum + n, 0) / engineVals.length
			: snapshot.externalTrustScore;
		const subScores: SubScores = {
			specialty: clamp100(snapshot.radarScores.schema),
			localPresence: pillarPct('local_nap'),
			authority: pillarPct('rag_authority'),
			uniqueness: clamp100(snapshot.radarScores.geoSignal),
			awareness: pillarPct('entity'),
		};
		const scores = sanitizeGuideScores({
			observedSeoScore: snapshot.rawTechnicalScore,
			seoMaxScore: snapshot.maxRawScore || GUIDE_SEO_MAX_DEFAULT,
			aiTrustScore: snapshot.externalTrustScore,
			aiPotentialScore: avgEngine,
			subScores,
		});
		return {
			...audit,
			seoScore: scores.observedSeoScore,
			seoMaxScore: scores.seoMaxScore,
			aiTrustScore: scores.aiTrustScore,
			aiPotentialScore: scores.aiPotentialScore,
			subScores: scores.subScores,
		};
	} catch {
		return audit;
	}
}

export function guideDataFromLatestAudit(): GuideData | null {
	return guideDataFromReport(loadLatestAuditPayload()?.report);
}

export function guideDataFromHistoryEntry(entry: { report?: AuditReport | null } | null | undefined): GuideData | null {
	return guideDataFromReport(entry?.report);
}

function normalizeAuditReport(report: AuditReport): AuditReport {
	return {
		...report,
		url: report.url || '',
		categories: Array.isArray(report.categories) ? report.categories : [],
		findings: Array.isArray(report.findings) ? report.findings : [],
		checklist: Array.isArray(report.checklist) ? report.checklist : report.checklist,
		detectedKeywords: Array.isArray(report.detectedKeywords) ? report.detectedKeywords : [],
		siteMeta: report.siteMeta || {},
	};
}

/** History-row → GuideData. Full report mapping first, then metadata fallback. Never throws. */
export function guideDataFromHistoryRow(row: GuideHistoryRow): GuideData {
	try {
		const mapped = guideDataFromReport(row?.entry?.report);
		if (mapped) {
			return ensureGuideData({
				...mapped,
				brandName: mapped.brandName || row.brandName,
				observedSeoScore: mapped.observedSeoScore || row.seoScore,
				seoMaxScore: mapped.seoMaxScore || row.seoMaxScore,
				aiTrustScore: mapped.aiTrustScore || row.aiTrustScore,
			});
		}
	} catch (error) {
		console.error('[guide] history row mapping failed, using fallback', error);
	}
	return fallbackGuideFromHistoryRow(row);
}

function fallbackGuideFromHistoryRow(row: GuideHistoryRow): GuideData {
	const report = row?.entry?.report;
	const meta = report?.siteMeta;
	const brandName = (row?.brandName || meta?.brandName || '').trim() || '해당 브랜드';
	const region = (meta?.location || meta?.broadLocation || meta?.addressRegion || '').trim();
	const address = (meta?.address || '').trim();
	const industry = toKoreanIndustryLabel(meta?.category || meta?.primaryKeyword || '', brandName, meta?.coreSpecialties || []);
	const coreFeatures = uniqueStrings([...(meta?.coreSpecialties || []), ...(meta?.serviceKeywords || [])], 6);
	const keywords = generateSmartHashtags({
		brandName,
		region,
		industry,
		address,
		coreFeatures,
	}).map(stripHashtagPrefix);
	return ensureGuideData({
		brandName,
		brandNameEng: '',
		industry,
		region,
		address,
		telephone: (meta?.telephone || '').trim(),
		coreFeatures,
		keywords,
		observedSeoScore: row?.seoScore,
		seoMaxScore: row?.seoMaxScore,
		aiTrustScore: row?.aiTrustScore,
		socialLinks: { website: row?.url || report?.url || '' },
		createdAt: row?.timestamp || new Date().toISOString(),
	});
}

export function guideDataFromReport(report: AuditReport | null | undefined): GuideData | null {
	if (!report?.url) return null;
	try {
	report = normalizeAuditReport(report);
	const meta = report.siteMeta;
	const brandName = resolveProjectSiteName(report);
	const brandNameEng =
		uniqueStrings(
			[meta?.organizationName, meta?.ogSiteName, meta?.brandName].filter((name) => looksLatin(name || '')),
			1,
		)[0] || '';

	let hostname = '';
	try {
		hostname = new URL(report.url).hostname.replace(/^www\./i, '');
	} catch {
		hostname = '';
	}

	const region = (meta?.location || meta?.broadLocation || meta?.addressRegion || '').trim();
	const rawIndustry = (meta?.category || meta?.businessEntity || meta?.primaryKeyword || '').trim();
	const address = (
		meta?.address || [meta?.addressRegion, meta?.addressLocality, meta?.streetAddress].filter(Boolean).join(' ')
	).trim();

	const coreFeatures = uniqueStrings(
		[...(meta?.coreSpecialties || []), ...(meta?.serviceKeywords || []), meta?.primaryKeyword],
		6,
	);
	const industry = toKoreanIndustryLabel(rawIndustry, brandName, coreFeatures);

	const extractedKeywords = uniqueStrings(
		[...(report.detectedKeywords || []), ...(meta?.detectedKeywords || []), ...(meta?.serviceKeywords || [])],
		8,
	);

	const keywords = generateSmartHashtags({
		brandName,
		region,
		industry,
		address,
		coreFeatures,
		extractedKeywords,
	}).map(stripHashtagPrefix);

	const socialLinks = classifySameAs(meta?.sameAs || []);
	socialLinks.website = report.url;

	const telephone = (meta?.telephone || '').trim();
	const firstFaq = meta?.faqItems?.[0];
	const faq = buildGuideFaq({
		brandName,
		region,
		address,
		industry,
		coreFeatures,
		question: firstFaq?.q,
		answer: firstFaq?.a,
	});

	const audit = enrichAuditFromSnapshot(siteAuditFromReport(report), report);
	audit.brandName = audit.brandName || brandName;
	audit.brandNameEng = audit.brandNameEng || brandNameEng;
	audit.address = audit.address || address;
	audit.industry = audit.industry || industry;
	audit.coreFeatures = coreFeatures;
	audit.coreFeatureCount = audit.coreFeatureCount || coreFeatures.length;

	const analysis = evaluateGuideAnalysis(audit);
	const scores = sanitizeGuideScores(analysis);

	return ensureGuideData({
		id: createGuideId(),
		slug: suggestGuideSlug(brandNameEng, brandName, hostname.replace(/\./g, '-')),
		brandName,
		brandNameEng,
		industry,
		region,
		address,
		telephone,
		coreFeatures,
		keywords,
		observedSeoScore: scores.observedSeoScore,
		seoMaxScore: scores.seoMaxScore,
		aiTrustScore: scores.aiTrustScore,
		aiPotentialScore: scores.aiPotentialScore,
		subScores: scores.subScores,
		channelBriefing: analysis.channelBriefing,
		socialLinks,
		faq,
		aiEngineDiagnoses: analysis.aiEngineDiagnoses,
		createdAt: new Date().toISOString(),
	});
	} catch (error) {
		console.error('[guide] failed to map audit report', error);
		return null;
	}
}

export function buildGuideFaq(input: {
	brandName: string;
	region: string;
	address: string;
	industry: string;
	coreFeatures: string[];
	question?: string;
	answer?: string;
}): GuideFaq {
	const brand = (input.brandName || '해당 브랜드').trim();
	const feature = input.coreFeatures.filter(Boolean).slice(0, 2).join('·') || input.industry || '핵심 서비스';
	const place = (input.address || input.region || '').trim() || '공식 사업장';
	return {
		question:
			input.question?.trim() ||
			(input.region.trim()
				? `${input.region.trim()}에서 ${withJosa(feature, '을/를')} 받을 수 있는 곳은 어디인가요?`
				: `${withJosa(brand, '은/는')} 어디에서 ${withJosa(feature, '을/를')} 상담하나요?`),
		answer:
			input.answer?.trim() ||
			`${place}에 위치한 ${withJosa(brand, '은/는')} ${withJosa(feature, '을/를')} 제공합니다.`,
	};
}
