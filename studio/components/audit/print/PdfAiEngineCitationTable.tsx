'use client';

import { useTranslations } from 'next-intl';
import {
	PDF_TABLE,
	PDF_TABLE_TD,
	PDF_TABLE_TH,
	PDF_TABLE_WRAP,
	PdfStageHeading,
	PdfStatusBadge,
	type PdfCellStatus,
} from '@/components/audit/print/pdf-print-shared';
import { buildAiCrawlerStatusesFromAudit } from '@/lib/geo/precision-diagnostics';
import {
	buildKeywordRecommendations,
	collectDetectedKeywords,
	type KeywordCategoryId,
} from '@/lib/audit/keyword-recommendations';
import type { DiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { LIVE_GROUNDING_ENGINE_IDS, type AIEngineId } from '@/types/geo-diagnostic';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

interface PdfAiEngineCitationTableProps {
	report: AuditReport;
	scoreSnapshot: DiagnosisScoreSnapshot;
	lang: AuditLang;
}

const ENGINE_ORDER: AIEngineId[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'copilot', 'clova'];

/** Engine → robots.txt bot id used for the crawler-access column. Copilot/Clova have no dedicated bot in this catalog. */
const ENGINE_TO_BOT: Partial<Record<AIEngineId, 'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended'>> = {
	chatgpt: 'gptbot',
	perplexity: 'perplexitybot',
	claude: 'claudebot',
	gemini: 'google-extended',
};

const KEYWORD_CATEGORY_ORDER: KeywordCategoryId[] = ['geoPrompt', 'primary', 'longTail', 'lsiLocal'];

function statusFromExposure(status: string): PdfCellStatus {
	if (status === 'optimal') return 'pass';
	if (status === 'partial') return 'warning';
	return 'fail';
}

/**
 * Stage 2 — per-AI-engine citation readiness table (unchanged), plus the
 * llms.txt / AI-bot access detail block and the AI 브랜드 가시성·키워드
 * 연관도 block — full parity with the on-screen `LlmsTxtCopyBox` and
 * `KeywordRecommendationPanel`. Every figure comes from the same rule-based
 * `scoreSnapshot.engines` + crawled `siteMeta`/`metrics` the dashboard uses;
 * Live Grounding stays an async probe not run during PDF capture.
 */
export function PdfAiEngineCitationTable({ report, scoreSnapshot, lang }: PdfAiEngineCitationTableProps) {
	const t = useTranslations('audit.pdfReport.engineTable');
	const hasLlmsTxt = Boolean(report.metrics?.hasLlmsTxt);
	const botStatuses = buildAiCrawlerStatusesFromAudit(report, lang);
	const botById = new Map(botStatuses.map((b) => [b.id, b]));
	const engineById = new Map((scoreSnapshot?.engines ?? []).map((e) => [e.engine, e]));

	const rows = ENGINE_ORDER.map((id) => engineById.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));

	const keywordPack = buildKeywordRecommendations(report.siteMeta, lang);
	const keywordById = new Map(keywordPack.categories.map((c) => [c.id, c.keywords]));
	const detectedKeywords = collectDetectedKeywords(report);

	return (
		<section
			id="sec-pdf-engine-table"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={2} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			<div className={`m-5 sm:m-6 ${PDF_TABLE_WRAP}`}>
				<table className={PDF_TABLE}>
					<thead>
						<tr>
							<th className={PDF_TABLE_TH}>{t('colEngine')}</th>
							<th className={PDF_TABLE_TH}>{t('colReadiness')}</th>
							<th className={PDF_TABLE_TH}>{t('colLlmsTxt')}</th>
							<th className={PDF_TABLE_TH}>{t('colCrawler')}</th>
							<th className={PDF_TABLE_TH}>{t('colLiveGrounding')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((engine) => {
							const bot = ENGINE_TO_BOT[engine.engine] ? botById.get(ENGINE_TO_BOT[engine.engine]!) : undefined;
							const isLive = (LIVE_GROUNDING_ENGINE_IDS as readonly string[]).includes(engine.engine);
							const readinessStatus = statusFromExposure(engine.status);
							return (
								<tr key={engine.engine} className="pdf-table-row">
									<td className={`${PDF_TABLE_TD} font-bold text-slate-900`}>{engine.engineName}</td>
									<td className={PDF_TABLE_TD}>
										<PdfStatusBadge status={readinessStatus}>
											{t('scoreLabel', { score: engine.score })}
										</PdfStatusBadge>
									</td>
									<td className={PDF_TABLE_TD}>
										<PdfStatusBadge status={hasLlmsTxt ? 'pass' : 'fail'}>
											{hasLlmsTxt ? t('llmsTxtYes') : t('llmsTxtNo')}
										</PdfStatusBadge>
									</td>
									<td className={PDF_TABLE_TD}>
										{bot ? (
											<PdfStatusBadge status={bot.allowed ? 'pass' : 'fail'}>
												{bot.allowed ? t('crawlerAllowed') : t('crawlerBlocked')}
											</PdfStatusBadge>
										) : (
											<PdfStatusBadge status="neutral">{t('crawlerNotTracked')}</PdfStatusBadge>
										)}
									</td>
									<td className={PDF_TABLE_TD}>
										{isLive ? (
											<PdfStatusBadge status={readinessStatus}>{t('liveGroundingEligible')}</PdfStatusBadge>
										) : (
											<PdfStatusBadge status="neutral">{t('liveGroundingProxy')}</PdfStatusBadge>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<p className="px-5 pb-2 text-[10.5px] leading-relaxed text-slate-500 sm:px-6">{t('footnote')}</p>

			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('llmsTxtSectionTitle')}</p>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<PdfStatusBadge status={hasLlmsTxt ? 'pass' : 'fail'}>
						{hasLlmsTxt ? t('llmsTxtSupported') : t('llmsTxtNotSupported')}
					</PdfStatusBadge>
					{report.metrics?.llmsTxtEvidence ? (
						<span className="text-[10.5px] font-mono text-slate-500">{report.metrics.llmsTxtEvidence}</span>
					) : null}
				</div>
				{botStatuses.length > 0 ? (
					<div className="mt-2.5">
						<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('botAccessTitle')}</p>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							{botStatuses.map((bot) => (
								<PdfStatusBadge key={bot.id} status={bot.allowed ? 'pass' : 'fail'}>
									{bot.label} · {bot.allowed ? t('crawlerAllowed') : t('crawlerBlocked')}
								</PdfStatusBadge>
							))}
						</div>
					</div>
				) : null}
			</div>

			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('keywordSectionTitle')}</p>
				<div className="mt-2.5">
					<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('keywordDetectedTitle')}</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{detectedKeywords.length > 0 ? (
							detectedKeywords.map((kw, idx) => (
								<span
									key={`${kw}-${idx}`}
									className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-700"
								>
									#{kw}
								</span>
							))
						) : (
							<span className="text-[10.5px] text-slate-400">{t('keywordEmpty')}</span>
						)}
					</div>
				</div>
				<div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					{KEYWORD_CATEGORY_ORDER.map((id) => {
						const keywords = keywordById.get(id) ?? [];
						if (keywords.length === 0) return null;
						return (
							<div key={id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
								<p className="text-[10.5px] font-bold text-slate-800">{t(`keywordCategory.${id}`)}</p>
								<div className="mt-1.5 flex flex-wrap gap-1.5">
									{keywords.slice(0, 12).map((kw) => (
										<span
											key={kw}
											className="inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
										>
											{kw}
										</span>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
