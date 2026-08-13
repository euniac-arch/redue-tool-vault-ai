'use client';

import { useTranslations } from 'next-intl';
import type { AuditCategory } from '@/lib/site-auditor';

const CATEGORY_ICON: Record<string, string> = {
	seo: '🔎',
	performance: '⚡',
	schema: '🧩',
	accessibility: '♿',
	geo: '🤖',
};

function formatScore(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function pctOf(score: number, max: number): number {
	if (max <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((score / max) * 100)));
}

export function AuditCategoryGrid({ categories }: { categories: AuditCategory[] }) {
	const tDist = useTranslations('audit.scoreDistribution');

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			{categories.map((category) => {
				const pass = category.status === 'PASS';
				const failCount = category.checks.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) === 'fail').length;
				const warnCount = category.checks.filter((c) => c.status === 'warning').length;
				const pct = pctOf(category.score, category.maxScore);
				const isGeoComplete = category.id === 'geo' && pct >= 100;
				return (
					<div
						key={category.id}
						className={`flex flex-col gap-2 rounded-xl border p-4 ${
							pass ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-rose-500/30 bg-rose-500/[0.06]'
						}`}
					>
						<div className="flex items-center justify-between">
							<span className="text-xl">{CATEGORY_ICON[category.id] ?? '•'}</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
									pass ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
								}`}
							>
								{pass ? 'Pass' : 'Fail'}
							</span>
						</div>
						<p className="text-sm font-bold text-white">{category.label}</p>
						<p className={`text-xs ${pass ? 'text-emerald-300' : 'text-rose-300'}`}>{category.statusNote}</p>
						<div className="mt-auto">
							<p className="text-lg font-extrabold tabular-nums text-white">
								{tDist('categoryPctScore', { pct })}
							</p>
							<p className="text-xs text-slate-500">
								{isGeoComplete
									? tDist('rowRawScoreBonus', {
											score: formatScore(category.score),
											max: category.maxScore,
										})
									: tDist('rowRawScore', {
											score: formatScore(category.score),
											max: category.maxScore,
										})}
								{(failCount > 0 || warnCount > 0) && (
									<span className="ml-1 text-slate-600">
										· {failCount}F/{warnCount}W
									</span>
								)}
							</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}
