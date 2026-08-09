'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Checklist } from '@/components/Checklist';
import { DiffViewer } from '@/components/DiffViewer';
import { FreeAuditHero } from '@/components/FreeAuditHero';
import { PricingModal } from '@/components/PricingModal';
import { ScoreBadge } from '@/components/ScoreBadge';
import type { ScanBundle } from '@/lib/types';

const CMS_BADGE_STYLES: Record<string, string> = {
	WORDPRESS: 'bg-accent/15 text-accent-light border-accent/30',
	UNKNOWN: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export default function DashboardPage() {
	const t = useTranslations('dashboard');
	const router = useRouter();
	const { status } = useSession();
	const [targetPath, setTargetPath] = useState('');
	const [themeOverride, setThemeOverride] = useState('');
	const [siteUrl, setSiteUrl] = useState('');
	const [scanning, setScanning] = useState(false);
	const [injecting, setInjecting] = useState(false);
	const [result, setResult] = useState<ScanBundle | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pricingOpen, setPricingOpen] = useState(false);

	async function runScan() {
		setScanning(true);
		setError(null);
		try {
			const res = await fetch('/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetPath, themeOverride }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error ?? '스캔 중 오류가 발생했습니다.');
			}
			setResult(data as ScanBundle);
		} catch (err) {
			setError((err as Error).message);
			setResult(null);
		} finally {
			setScanning(false);
		}
	}

	async function runInject() {
		if (status !== 'authenticated') {
			router.push('/login?callbackUrl=/');
			return;
		}

		setInjecting(true);
		setError(null);
		try {
			const res = await fetch('/api/patch/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetPath, themeOverride, siteUrl }),
			});
			const data = await res.json();
			if (res.status === 401) {
				router.push('/login?callbackUrl=/');
				return;
			}
			if (res.status === 402) {
				setPricingOpen(true);
				return;
			}
			if (!res.ok) {
				throw new Error(data.error ?? '주입 중 오류가 발생했습니다.');
			}
			router.push('/patch/result');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setInjecting(false);
		}
	}

	const canInject = result?.cms.cmsType === 'WORDPRESS' && result?.target.found;

	return (
		<main className="flex flex-col gap-8">
			<FreeAuditHero />

			<section>
				<h2 className="text-lg font-bold text-white">{t('title')}</h2>
				<p className="mt-1 text-sm text-slate-400">{t('description')}</p>
			</section>

			<section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="flex flex-col gap-1.5 text-sm">
						<span className="font-semibold text-slate-300">스캔 대상 폴더 경로</span>
						<input
							className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent"
							placeholder="비워두면 이 저장소의 워드프레스 루트를 자동 사용합니다"
							value={targetPath}
							onChange={(event) => setTargetPath(event.target.value)}
						/>
					</label>
					<label className="flex flex-col gap-1.5 text-sm">
						<span className="font-semibold text-slate-300">활성 테마 슬러그 재정의 (선택)</span>
						<input
							className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent"
							placeholder="예: redue-tool-vault"
							value={themeOverride}
							onChange={(event) => setThemeOverride(event.target.value)}
						/>
					</label>
				</div>
				<label className="flex flex-col gap-1.5 text-sm">
					<span className="font-semibold text-slate-300">배포 도메인 URL (선택 — IndexNow / Google 색인 핑 발송용)</span>
					<input
						className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent"
						placeholder="예: https://euniac.mycafe24.com/tool-vault"
						value={siteUrl}
						onChange={(event) => setSiteUrl(event.target.value)}
					/>
					<span className="text-[11px] text-slate-500">
						입력 시 주입 성공 직후 이 URL을 Google/Bing 검색엔진에 즉시 수집 요청합니다.
					</span>
				</label>
				<div>
					<button
						onClick={runScan}
						disabled={scanning}
						className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
					>
						{scanning ? '스캔 중...' : '스캔 시작'}
					</button>
				</div>
			</section>

			{error && (
				<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
			)}

			{result && (
				<section className="flex flex-col gap-6">
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">CMS Type</p>
							<span
								className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-bold ${
									CMS_BADGE_STYLES[result.cms.cmsType]
								}`}
							>
								{result.cms.cmsType}
							</span>
						</div>
						<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">활성 테마</p>
							<p className="mt-2 font-mono text-sm text-slate-200">{result.cms.activeTheme ?? '미확인'}</p>
							<p className="mt-1 text-[11px] text-slate-500">{result.cms.detectionNote}</p>
						</div>
						<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">타겟 파일 (우선순위 {result.target.priority ?? '-'})</p>
							<p className="mt-2 break-all font-mono text-sm text-slate-200">{result.fileRelativePath ?? '미확인'}</p>
						</div>
					</div>

					<ScoreBadge
						score={result.diagnostics.score}
						maxScore={result.diagnostics.maxScore}
						status={result.diagnostics.status}
						statusLabel={result.diagnostics.statusLabel}
					/>

					<Checklist checks={result.diagnostics.checks} />

					<div>
						<h2 className="mb-2 text-sm font-semibold text-slate-300">주입 미리보기 (Dry-run)</h2>
						<DiffViewer filePath={result.fileRelativePath} diff={result.diff} />
					</div>

					{canInject && (
						<div>
							<button
								onClick={runInject}
								disabled={injecting}
								className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
							>
								{injecting ? '주입 적용 중...' : '마스터 스키마 주입 적용'}
							</button>
							<p className="mt-2 text-xs text-slate-500">
								실제로 {result.fileRelativePath} 파일에 마스터 스키마 블록을 기록하고, /patch/result 화면으로 이동합니다.
							</p>
						</div>
					)}
				</section>
			)}

			<PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
		</main>
	);
}
