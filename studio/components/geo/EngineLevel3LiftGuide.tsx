'use client';

import { useCallback, useState } from 'react';
import { Check, ClipboardCopy, Compass, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { EngineOptimizationGuide } from '@/types/geo-trigger-simulation';

interface EngineLevel3LiftGuideProps {
	guide: EngineOptimizationGuide;
	/** To-Be Level 2 still needs a stronger lift CTA. */
	emphasis?: 'current' | 'post';
}

const PATTERN_BADGE: Record<EngineOptimizationGuide['queryPattern'], string> = {
	local: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
	metro: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
	nationwide: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
};

export function EngineLevel3LiftGuide({ guide, emphasis = 'current' }: EngineLevel3LiftGuideProps) {
	const t = useTranslations('audit.aiEngineCards');
	const [copied, setCopied] = useState(false);
	const isPost = emphasis === 'post';

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(guide.level3OptimizedQuery);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}, [guide.level3OptimizedQuery]);

	return (
		<section
			className={`space-y-3 rounded-xl border p-3.5 ${
				isPost
					? 'border-amber-500/35 bg-amber-950/25'
					: 'border-indigo-500/30 bg-indigo-950/25'
			}`}
			aria-label={t('level3GuideAria', { engine: guide.engineName })}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className={`text-[11px] font-extrabold ${isPost ? 'text-amber-100' : 'text-indigo-100'}`}>
						<span aria-hidden>🎯 </span>
						{isPost ? t('level3GuideTitleToBe') : t('level3GuideTitle')}
					</p>
					<p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
						{t('level3GuideHint', {
							engine: guide.engineName,
							from: guide.currentLevel,
							to: guide.targetLevel,
						})}
					</p>
				</div>
				<span
					className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${PATTERN_BADGE[guide.queryPattern]}`}
				>
					{t(`level3Pattern.${guide.queryPattern}`)}
				</span>
			</div>

			<p className="rounded-lg border border-white/5 bg-slate-950/50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
				<Compass className="mr-1 inline-block h-3 w-3 text-slate-400" aria-hidden />
				{guide.engineCharacteristics}
			</p>

			<div className="space-y-1.5">
				<p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
					{t('level3QueryLabel')}
				</p>
				<div className="flex items-start justify-between gap-2 rounded-lg border border-indigo-500/25 bg-slate-950/70 px-2.5 py-2">
					<p className="min-w-0 text-xs font-bold leading-relaxed text-slate-100">
						“{guide.level3OptimizedQuery}”
					</p>
					<button
						type="button"
						onClick={() => void handleCopy()}
						title={t('copyPromptTitle')}
						className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 transition-colors hover:bg-slate-700"
					>
						{copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <ClipboardCopy className="h-3 w-3" aria-hidden />}
						<span>{copied ? t('copyPromptDone') : t('copyPrompt')}</span>
					</button>
				</div>
			</div>

			{guide.level3KeywordCombos.length ? (
				<div className="space-y-1.5">
					<p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
						{t('level3ComboLabel')}
					</p>
					<ul className="grid grid-cols-1 gap-1.5">
						{guide.level3KeywordCombos.map((combo) => (
							<li
								key={combo.id}
								className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2"
							>
								<p className="text-[11px] font-bold leading-relaxed text-slate-200">
									{combo.tokens.join(' + ')}
								</p>
								<p className="mt-1 text-[10px] text-slate-500">{combo.intent}</p>
								<div className="mt-1.5 flex flex-wrap gap-1">
									{combo.tokens.map((token) => (
										<span
											key={`${combo.id}-${token}`}
											className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 ring-1 ring-slate-700"
										>
											{token}
										</span>
									))}
								</div>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="space-y-1.5">
				<p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
					<span aria-hidden>💊 </span>
					{t('level3TipsLabel')}
				</p>
				<ul className="space-y-1.5">
					{guide.prescriptionTips.map((tip) => (
						<li key={tip} className="flex items-start gap-2">
							<Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" aria-hidden />
							<span className="text-[11px] leading-relaxed text-slate-200">{tip}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
