import Link from 'next/link';
import { Checklist } from '@/components/Checklist';
import { DiffViewer } from '@/components/DiffViewer';
import { PatchResultTabs } from '@/components/PatchResultTabs';
import { ScoreBadge } from '@/components/ScoreBadge';
import { normalizeKnowledgeGraphDomain } from '@/lib/knowledge-graph';
import { loadResultBundle } from '@/lib/results-store';

export const dynamic = 'force-dynamic';

export default function PatchResultPage() {
	const bundle = loadResultBundle();

	if (!bundle || bundle.kind !== 'applied') {
		return (
			<main className="flex flex-col gap-4">
				<h1 className="text-2xl font-bold text-white">패치 결과</h1>
				<p className="text-sm text-slate-400">
					아직 적용된 주입 결과가 없습니다. 대시보드에서 스캔을 실행하고 마스터 스키마 주입을 적용해 주세요.
				</p>
				<Link href="/" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light">
					대시보드로 이동
				</Link>
			</main>
		);
	}

	const kgDomain = bundle.indexing?.siteUrl
		? normalizeKnowledgeGraphDomain(bundle.indexing.siteUrl)
		: normalizeKnowledgeGraphDomain(bundle.targetPathInput);

	const overview = (
		<>
			<section>
				<h1 className="text-2xl font-bold text-white">패치 결과</h1>
				<p className="mt-1 text-sm text-slate-400">
					{new Date(bundle.timestamp).toLocaleString('ko-KR')} · {bundle.cms.cmsType} · {bundle.cms.activeTheme ?? '미확인'}
				</p>
			</section>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
					<p className="text-xs uppercase tracking-wide text-slate-500">타겟 파일 (우선순위 {bundle.target.priority ?? '-'})</p>
					<p className="mt-2 break-all font-mono text-sm text-slate-200">{bundle.fileRelativePath}</p>
				</div>
				<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
					<p className="text-xs uppercase tracking-wide text-slate-500">주입 상태</p>
					<p className="mt-2 text-sm font-semibold text-emerald-400">
						{bundle.injected ? '✅ 마스터 스키마 블록 주입 완료' : '⚠️ 주입되지 않음'}
					</p>
				</div>
			</div>

			<ScoreBadge
				score={bundle.diagnostics.score}
				maxScore={bundle.diagnostics.maxScore}
				status={bundle.diagnostics.status}
				statusLabel={bundle.diagnostics.statusLabel}
			/>

			{bundle.indexing?.attempted && (
				<div className="flex flex-col gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.06] p-4">
					<p className="text-sm font-bold text-cyan-300">
						🚀 Google &amp; Bing 검색엔진에 스키마 즉시 수집(Indexing) 요청 완료
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<p className="text-xs text-slate-400">
							<span className={bundle.indexing.indexNow?.success ? 'text-emerald-400' : 'text-amber-400'}>
								{bundle.indexing.indexNow?.success ? '✅' : '⚠️'} IndexNow (Bing/Yandex/Naver)
							</span>
							<br />
							{bundle.indexing.indexNow?.message}
						</p>
						<p className="text-xs text-slate-400">
							<span className={bundle.indexing.google?.success ? 'text-emerald-400' : 'text-amber-400'}>
								{bundle.indexing.google?.success ? '✅' : '⚠️'} Google Indexing API
							</span>
							<br />
							{bundle.indexing.google?.message}
						</p>
					</div>
				</div>
			)}

			<Checklist checks={bundle.diagnostics.checks} />

			<div>
				<h2 className="mb-2 text-sm font-semibold text-slate-300">Git Diff — 마스터 스키마 블록 주입</h2>
				<DiffViewer filePath={bundle.fileRelativePath} diff={bundle.diff} />
			</div>

			<Link href="/" className="w-fit rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5">
				← 대시보드로 돌아가기
			</Link>
		</>
	);

	return (
		<main className="flex flex-col gap-8">
			<PatchResultTabs domain={kgDomain} overview={overview} />
		</main>
	);
}
