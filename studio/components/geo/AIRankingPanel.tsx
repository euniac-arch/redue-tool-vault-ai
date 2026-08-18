'use client';

import { useEffect, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import {
	ENGINE_SHARE_BAR_CLASS,
	formatKstYmd,
	getDailyAIRankings,
	isAIShareRates,
	type AIShareRates,
	type AIShareTrend,
	type DailyAIRanking,
} from '@/lib/geo/ai-rankings';
import { AI_ENGINE_IDS, type AIEngineId } from '@/types/geo-diagnostic';

const EMPTY_RANKINGS: DailyAIRanking[] = [];

const RANK_BADGE: Record<DailyAIRanking['rank'], string> = {
	1: 'bg-[#D4AF37] text-slate-950 ring-1 ring-[#D4AF37]/40',
	2: 'bg-slate-200 text-slate-800 ring-1 ring-slate-300 dark:bg-slate-500/30 dark:text-slate-100 dark:ring-white/15',
	3: 'bg-amber-700 text-amber-50 ring-1 ring-amber-500/40',
	4: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
	5: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
	6: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
};

const ENGINE_ID_SET = new Set<string>(AI_ENGINE_IDS);

function isEngineId(value: string | undefined): value is AIEngineId {
	return Boolean(value && ENGINE_ID_SET.has(value));
}

function formatShareRate(value: number): string {
	if (!Number.isFinite(value)) return '0';
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function TrendChip({ trend }: { trend: AIShareTrend }) {
	const t = useTranslations('audit.aiRankingModal');
	if (trend === 'up') {
		return (
			<span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
				<TrendingUp className="h-3 w-3" aria-hidden />
				{t('trendUp')}
			</span>
		);
	}
	if (trend === 'down') {
		return (
			<span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-px text-[10px] font-extrabold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
				<TrendingDown className="h-3 w-3" aria-hidden />
				{t('trendDown')}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-extrabold text-slate-500 dark:bg-white/10 dark:text-slate-300">
			<Minus className="h-3 w-3" aria-hidden />
			{t('trendStable')}
		</span>
	);
}

function ShareGauge({
	id,
	label,
	shareRate,
}: {
	id: AIEngineId;
	label: string;
	shareRate: number;
}) {
	const safeRate = Number.isFinite(shareRate) ? Math.min(100, Math.max(0, shareRate)) : 0;
	return (
		<div className="flex shrink-0 items-center gap-2">
			<div
				className="h-1.5 w-[4.75rem] overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 sm:w-24"
				role="meter"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={safeRate}
				aria-label={label}
			>
				<div
					className={`h-full rounded-full ${ENGINE_SHARE_BAR_CLASS[id] ?? 'bg-slate-400'}`}
					style={{ width: `${safeRate}%` }}
				/>
			</div>
			<p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
				<span className="text-[10px] font-bold text-slate-400">~</span>
				{formatShareRate(shareRate)}
				<span className="text-[11px] font-bold text-slate-500">%</span>
			</p>
		</div>
	);
}

export function AIRankingPanel() {
	const t = useTranslations('audit.aiRankingModal');
	const [aiShareRates, setAiShareRates] = useState<AIShareRates | null>(null);
	const [loadError, setLoadError] = useState(false);

	useEffect(() => {
		const today = formatKstYmd(new Date(), '-');
		const fallback = getDailyAIRankings(today);
		setAiShareRates((prev) => prev ?? fallback);
		setLoadError(false);

		const controller = new AbortController();
		fetch(`/api/geo/ai-rankings?date=${encodeURIComponent(today)}`, {
			cache: 'no-store',
			signal: controller.signal,
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json: unknown = await res.json();
				const payload =
					json && typeof json === 'object' && 'aiShareRates' in json
						? (json as { aiShareRates: unknown }).aiShareRates
						: json;
				if (!isAIShareRates(payload)) throw new Error('invalid payload');
				setAiShareRates(payload);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				if (error instanceof DOMException && error.name === 'AbortError') return;
				setLoadError(true);
			});

		return () => controller.abort();
	}, []);

	const snapshot = aiShareRates;
	const rankings = snapshot?.rankings ?? EMPTY_RANKINGS;
	const asOfDisplay = snapshot?.asOfDisplay ?? '';
	const snapshotDate = snapshot?.date ?? '';

	if (!snapshot) {
		return (
			<p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t('loading')}</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-1.5">
					<span
						className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[#8a6d14] dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/15 dark:text-[#E8C766]"
						title={snapshot.lastUpdated}
					>
						<span aria-hidden>🕒</span>
						{asOfDisplay ? (
							<time dateTime={`${snapshotDate}T00:00:00+09:00`}>
								{t('asOfBadge', { date: asOfDisplay })}
							</time>
						) : null}
					</span>
				</div>
				<p
					id="ai-ranking-modal-subtitle"
					className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-sm"
				>
					{t('subtitle')}
				</p>
				{asOfDisplay ? (
					<p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
						<span aria-hidden>🕒 </span>
						{t('asOfTimestamp', { date: asOfDisplay })}
					</p>
				) : null}
			</div>

			{loadError ? (
				<p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{t('loadError')}</p>
			) : null}

			{rankings.length === 0 ? (
				<p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10">
					{t('loading')}
				</p>
			) : (
				<ul className="flex flex-col gap-2.5">
					{rankings.map((row, index) => {
						if (!isEngineId(row?.id)) return null;
						const Glyph = ENGINE_GLYPH[row.id];
						const theme = ENGINE_CHAT_THEME[row.id];
						if (!Glyph || !theme) return null;
						const engineName = t(`engines.${row.id}.name`);
						const rank = (row.rank >= 1 && row.rank <= 6 ? row.rank : index + 1) as DailyAIRanking['rank'];
						return (
							<li
								key={row.id}
								className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.04] sm:px-3.5"
							>
								<div className="flex items-start gap-2.5 sm:gap-3">
									<span
										className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums ${RANK_BADGE[rank] ?? RANK_BADGE[6]}`}
									>
										{rank}
									</span>
									<span
										className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.logoWrap}`}
									>
										<Glyph className="h-4 w-4" />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
											<p className="text-sm font-extrabold text-slate-900 dark:text-white">{engineName}</p>
											<div className="flex items-center gap-2">
												<ShareGauge id={row.id} label={engineName} shareRate={row.shareRate} />
												<TrendChip trend={row.trend ?? 'stable'} />
											</div>
										</div>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
											<span className="mr-1.5 inline-flex rounded-full bg-slate-200/80 px-1.5 py-px text-[10px] font-extrabold text-slate-600 dark:bg-white/10 dark:text-slate-300">
												{t('rankLabel', { rank })}
											</span>
											{t(`engines.${row.id}.note`)}
										</p>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-3.5 py-3.5 dark:border-indigo-400/25 dark:from-indigo-500/[0.12] dark:via-[#0B1028] dark:to-cyan-500/[0.08] sm:px-4">
				<p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 sm:text-[13px]">
					<span className="mr-1" aria-hidden>
						💡
					</span>
					<span className="font-extrabold text-indigo-800 dark:text-indigo-300">{t('insightKicker')}</span>
					<span className="mx-1.5 text-slate-300 dark:text-white/20" aria-hidden>
						:
					</span>
					{t.rich('insight', {
						b: (chunks) => (
							<strong className="font-extrabold text-slate-900 dark:text-white">{chunks}</strong>
						),
					})}
				</p>
			</div>

			{asOfDisplay ? (
				<p className="text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
					<span aria-hidden>🕒 </span>
					<time dateTime={`${snapshotDate}T00:00:00+09:00`}>
						{t('asOfTimestamp', { date: asOfDisplay })}
					</time>
				</p>
			) : null}
			<p className="text-[10px] leading-relaxed text-slate-400">{t('disclaimer')}</p>
		</div>
	);
}
