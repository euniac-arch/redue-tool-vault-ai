'use client';

import { useState } from 'react';
import type { PortfolioItem } from '@/lib/portfolio-types';
import type { ModalMode } from './SchemaValidationModal';

interface PortfolioCardProps {
	item: PortfolioItem;
	onVerify: (item: PortfolioItem, mode: ModalMode) => void;
}

const SUB_SCORE_LABELS: { key: keyof PortfolioItem['subScores']; label: string }[] = [
	{ key: 'seo', label: 'SEO' },
	{ key: 'performance', label: '웹 성능' },
	{ key: 'schema', label: '스키마 검증' },
	{ key: 'accessibility', label: '웹 접근성' },
	{ key: 'geo', label: 'GEO AI 인식률' },
];

function microlinkScreenshotUrl(domainUrl: string): string {
	return `https://api.microlink.io/?url=${encodeURIComponent(domainUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
}

export function PortfolioCard({ item, onVerify }: PortfolioCardProps) {
	const [thumbFailed, setThumbFailed] = useState(false);

	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:flex-row">
			<div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-800 sm:aspect-auto sm:w-64">
				{!thumbFailed ? (
					// eslint-disable-next-line @next/next/no-img-element -- external, unpredictable-size screenshot from microlink.io
					<img
						src={microlinkScreenshotUrl(item.domainUrl)}
						alt={`${item.projectName} 캡쳐 썸네일`}
						className="h-full w-full object-cover object-top"
						onError={() => setThumbFailed(true)}
					/>
				) : (
					<div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-accent/30 to-slate-900 text-center text-xs text-slate-300">
						<span className="text-2xl">📸</span>
						<span>썸네일을 불러올 수 없습니다</span>
					</div>
				)}
				<span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
					{item.category}
				</span>
			</div>

			<div className="flex flex-1 flex-col gap-3 p-5">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<h3 className="text-lg font-bold text-white">{item.projectName}</h3>
						<a
							href={item.domainUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-accent-light hover:underline"
						>
							{item.domainUrl}
						</a>
					</div>
					<div className="flex flex-col items-end gap-1">
						<span className="rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-light">
							{item.cmsType}
						</span>
						<span className="text-2xl font-extrabold text-emerald-400">
							{item.overallScore.toFixed(1)}
							<span className="text-sm font-medium text-slate-400"> / {item.maxScore}</span>
						</span>
						<span className="text-xs font-semibold text-emerald-400">{item.statusLabel}</span>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{SUB_SCORE_LABELS.map(({ key, label }) => (
						<span key={key} className="rounded-md bg-black/20 px-2 py-1 text-[11px] text-slate-300">
							{label} <span className="font-bold text-slate-100">{item.subScores[key]}</span>
						</span>
					))}
				</div>

				<div className="flex flex-wrap gap-1.5">
					{item.injectionTags.map((tag) => (
						<span key={tag} className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300">
							{tag}
						</span>
					))}
				</div>

				<div className="mt-auto flex flex-wrap gap-2 pt-2">
					<button
						onClick={() => onVerify(item, 'seo')}
						className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
					>
						실제 SEO 진단
					</button>
					<button
						onClick={() => onVerify(item, 'schema')}
						className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
					>
						Schema 검증
					</button>
					<button
						onClick={() => onVerify(item, 'geo')}
						className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
					>
						GEO 대응
					</button>
				</div>
			</div>
		</article>
	);
}
