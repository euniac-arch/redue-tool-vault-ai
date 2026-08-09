'use client';

import { useState } from 'react';

export function WpPluginBuilderPanel() {
	const [building, setBuilding] = useState(false);
	const [meta, setMeta] = useState<{ fileName: string; bytes: number } | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function buildAndDownload() {
		setBuilding(true);
		setError(null);
		try {
			const metaRes = await fetch('/api/builder/wp-plugin', { method: 'POST' });
			const metaJson = await metaRes.json();
			if (!metaRes.ok) throw new Error(metaJson.error ?? '빌드 실패');
			setMeta({ fileName: metaJson.fileName, bytes: metaJson.bytes });

			const zipRes = await fetch('/api/builder/wp-plugin');
			if (!zipRes.ok) throw new Error('ZIP 다운로드 실패');
			const blob = await zipRes.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = metaJson.fileName ?? 'redue-ai-seo-1.0.0.zip';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setBuilding(false);
		}
	}

	return (
		<section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
			<div className="flex flex-wrap items-center gap-2">
				<span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
					WordPress.org
				</span>
				<span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
					GPL-2.0
				</span>
			</div>
			<h2 className="mt-3 text-lg font-bold text-white">플러그인 ZIP 자동 생성</h2>
			<p className="mt-1 text-xs text-slate-400">
				공식 디렉토리 제출 규격: <code className="text-cyan-300/90">redue-ai-seo.php</code>,{' '}
				<code className="text-cyan-300/90">readme.txt</code>, <code className="text-cyan-300/90">assets/</code>
			</p>

			<ul className="mt-4 flex flex-col gap-2 text-xs text-slate-400">
				<li>· API Key 1회 입력 → 사이트 전체 마스터 스키마 실시간 동기화</li>
				<li>· <code className="text-slate-300">POST /api/v1/schema/generate</code> 연동 (Bearer redue_live_sk_…)</li>
				<li>· CLI: <code className="text-slate-300">npm run build:wp-plugin</code></li>
			</ul>

			{error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
			{meta && (
				<p className="mt-3 text-xs text-emerald-400">
					빌드 완료 · {meta.fileName} ({Math.round(meta.bytes / 1024)} KB)
				</p>
			)}

			<button
				type="button"
				onClick={() => void buildAndDownload()}
				disabled={building}
				className="mt-5 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-3 text-sm font-bold text-[#0C0D0E] shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:opacity-90 disabled:opacity-50"
			>
				{building ? '패키징 중...' : 'redue-ai-seo-1.0.0.zip 다운로드'}
			</button>
		</section>
	);
}
