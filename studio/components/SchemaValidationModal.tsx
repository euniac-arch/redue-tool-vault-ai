'use client';

import { buildSoftwareApplicationSchemaSample, buildWebsiteSchemaSample } from '@/lib/schema-samples';
import type { PortfolioItem } from '@/lib/portfolio-types';

export type ModalMode = 'seo' | 'schema' | 'geo';

interface SchemaValidationModalProps {
	item: PortfolioItem | null;
	mode: ModalMode | null;
	onClose: () => void;
}

const MODE_CONFIG: Record<ModalMode, { title: string; scoreKey: keyof PortfolioItem['subScores']; description: string }> = {
	seo: {
		title: '실제 SEO 진단 결과',
		scoreKey: 'seo',
		description:
			'타이틀/메타 태그, 시맨틱 마크업과 함께 header.php에 주입된 구조화 데이터(JSON-LD)를 기준으로 검색엔진 최적화 상태를 진단합니다.',
	},
	schema: {
		title: 'Schema 검증 결과',
		scoreKey: 'schema',
		description:
			"header.php에 주입된 REDUE AI Studio 마스터 블록이 is_singular('ai_tool') / is_front_page() 조건에 따라 SoftwareApplication / WebSite 스키마를 완전 매핑하고 있는지 검증합니다.",
	},
	geo: {
		title: 'GEO AI 인식률 진단',
		scoreKey: 'geo',
		description:
			'ChatGPT, Perplexity 등 생성형 검색엔진(GEO)이 페이지 내용을 얼마나 정확히 이해·인용할 수 있는지, 구조화 데이터의 완결성을 기준으로 평가합니다.',
	},
};

function CodeBlock({ title, subtitle, json }: { title: string; subtitle: string; json: Record<string, unknown> }) {
	return (
		<div className="overflow-hidden rounded-xl border border-white/10">
			<div className="flex flex-col gap-0.5 border-b border-white/10 bg-white/5 px-4 py-2">
				<span className="text-xs font-bold text-emerald-300">✅ {title}</span>
				<span className="text-[11px] text-slate-500">{subtitle}</span>
			</div>
			<pre className="max-h-64 overflow-auto bg-black/30 p-4 font-mono text-xs leading-relaxed text-emerald-200">
				{JSON.stringify(json, null, 2)}
			</pre>
		</div>
	);
}

export function SchemaValidationModal({ item, mode, onClose }: SchemaValidationModalProps) {
	if (!item || !mode) {
		return null;
	}

	const config = MODE_CONFIG[mode];
	const website = buildWebsiteSchemaSample(item);
	const app = buildSoftwareApplicationSchemaSample(item);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
			onClick={onClose}
			role="presentation"
		>
			<div
				className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-bold text-white">{config.title}</h2>
						<p className="mt-1 text-sm text-slate-400">{item.projectName}</p>
					</div>
					<button
						onClick={onClose}
						className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-400 hover:bg-white/10"
						aria-label="닫기"
					>
						✕
					</button>
				</div>

				<div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
					<span className="text-3xl font-extrabold text-emerald-400">{item.subScores[config.scoreKey]}</span>
					<p className="text-sm text-emerald-200">{config.description}</p>
				</div>

				<div className="flex flex-col gap-3">
					<CodeBlock title={website.label} subtitle={website.appliesWhen} json={website.json} />
					<CodeBlock title={app.label} subtitle={app.appliesWhen} json={app.json} />
				</div>

				<div className="flex flex-wrap gap-1.5">
					{item.injectionTags.map((tag) => (
						<span key={tag} className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300">
							{tag}
						</span>
					))}
				</div>

				<p className="text-[11px] text-slate-500">
					검증 기준일: {item.verifiedAt} · 소스: wp-content/themes/redue-tool-vault/header.php (REDUE_AI_STUDIO 마스터 블록)
				</p>
			</div>
		</div>
	);
}
