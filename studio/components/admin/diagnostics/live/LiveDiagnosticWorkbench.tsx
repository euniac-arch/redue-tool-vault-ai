'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import {
	Check,
	Copy,
	Database,
	FileDown,
	Loader2,
	Radar,
	TriangleAlert,
	Zap,
} from 'lucide-react';
import {
	LIVE_INDUSTRY_LABEL,
	LIVE_INDUSTRY_OPTIONS,
	LIVE_SCAN_STEPS,
	copyTextToClipboard,
	downloadClientProposalReport,
	runLiveUrlDiagnostic,
	saveLiveDiagnosticResult,
	type LiveDiagnosticIndustry,
	type LiveDiagnosticResult,
	type LiveScanStepId,
	type LiveScanStepStatus,
} from '@/lib/admin/liveDiagnosticService';
import {
	LiveSeverityBadge,
	scoreBarClass,
	scoreRingClass,
	scoreToneClass,
} from './live-severity-badges';

const CARD =
	'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none';

const FIELD =
	'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-white/10';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

const EMPTY_STEPS: Record<LiveScanStepId, LiveScanStepStatus> = {
	crawl: 'pending',
	meta: 'pending',
	schema: 'pending',
	geo: 'pending',
};

export function LiveDiagnosticWorkbench() {
	const [url, setUrl] = useState('');
	const [industry, setIndustry] = useState<LiveDiagnosticIndustry>('medical');
	const [targetFocus, setTargetFocus] = useState('대구 동구 / 덴서티 리프팅');
	const [running, setRunning] = useState(false);
	const [steps, setSteps] = useState(EMPTY_STEPS);
	const [result, setResult] = useState<LiveDiagnosticResult | null>(null);
	const [saving, setSaving] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [copied, setCopied] = useState<'jsonld' | 'head' | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const doneCount = useMemo(
		() => LIVE_SCAN_STEPS.filter((step) => steps[step.id] === 'done').length,
		[steps],
	);
	const progressPct = running
		? Math.round(((doneCount + (LIVE_SCAN_STEPS.some((step) => steps[step.id] === 'running') ? 0.45 : 0)) / LIVE_SCAN_STEPS.length) * 100)
		: result
			? 100
			: 0;
	const showProgress = running || Boolean(result);

	async function handleStart(event: FormEvent) {
		event.preventDefault();
		if (running) return;
		setResult(null);
		setCopied(null);
		setSteps({ ...EMPTY_STEPS });
		setRunning(true);
		try {
			const next = await runLiveUrlDiagnostic(
				url,
				{ industry, targetFocus },
				(stepId, status) => {
					setSteps((prev) => ({ ...prev, [stepId]: status }));
				},
			);
			setResult(next);
			pushToast(`${next.siteName} 실시간 진단을 완료했습니다.`);
		} catch (error) {
			setSteps({ ...EMPTY_STEPS });
			pushToast(error instanceof Error ? error.message : '실시간 진단을 실행하지 못했습니다.', 'error');
		} finally {
			setRunning(false);
		}
	}

	async function handleCopy(kind: 'jsonld' | 'head') {
		if (!result) return;
		try {
			await copyTextToClipboard(kind === 'jsonld' ? result.jsonLdPretty : result.headInjectSnippet);
			setCopied(kind);
			pushToast(kind === 'jsonld' ? 'JSON-LD 코드를 복사했습니다.' : 'head 태그 주입 코드를 복사했습니다.');
			window.setTimeout(() => setCopied((prev) => (prev === kind ? null : prev)), 1600);
		} catch {
			pushToast('클립보드 복사에 실패했습니다.', 'error');
		}
	}

	async function handleSave() {
		if (!result || saving) return;
		setSaving(true);
		try {
			const saved = await saveLiveDiagnosticResult(result);
			pushToast(`진단 이력을 저장했습니다. (${saved.id})`);
		} catch (error) {
			pushToast(error instanceof Error ? error.message : '저장에 실패했습니다.', 'error');
		} finally {
			setSaving(false);
		}
	}

	function handleDownload() {
		if (!result || downloading) return;
		setDownloading(true);
		try {
			const filename = downloadClientProposalReport(result);
			pushToast(`${filename} 다운로드를 시작했습니다.`);
		} catch (error) {
			pushToast(error instanceof Error ? error.message : '리포트 다운로드에 실패했습니다.', 'error');
		} finally {
			setDownloading(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<form
				onSubmit={handleStart}
				className={`${CARD} p-4 sm:p-5`}
				aria-label="실시간 URL 진단 컨트롤"
			>
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_11rem_minmax(0,1fr)_auto]">
					<label className="min-w-0">
						<span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							도메인 URL
						</span>
						<input
							type="text"
							inputMode="url"
							autoComplete="url"
							placeholder="https://example.com"
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							className={FIELD}
							required
						/>
					</label>
					<label className="min-w-0">
						<span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							업종
						</span>
						<select
							value={industry}
							onChange={(event) => setIndustry(event.target.value as LiveDiagnosticIndustry)}
							className={`${FIELD} font-semibold`}
							aria-label="업종 선택"
						>
							{LIVE_INDUSTRY_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className="min-w-0">
						<span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							타겟 지역 / 핵심 키워드
						</span>
						<input
							type="text"
							placeholder="대구 동구 / 덴서티 리프팅"
							value={targetFocus}
							onChange={(event) => setTargetFocus(event.target.value)}
							className={FIELD}
						/>
					</label>
					<div className="flex items-end">
						<button
							type="submit"
							disabled={running}
							className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 lg:min-w-[11.5rem]"
						>
							{running ? (
								<>
									<span className="relative flex h-4 w-4">
										<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50 dark:bg-slate-900/30" />
										<Loader2 className="relative h-4 w-4 animate-spin" />
									</span>
									진단 중…
								</>
							) : (
								<>
									<Zap className="h-4 w-4" />
									실시간 진단 시작
								</>
							)}
						</button>
					</div>
				</div>
			</form>

			{showProgress ? (
				<section className={`${CARD} p-4 sm:p-5`} aria-live="polite" aria-label="실시간 진단 진행">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
								Live Progress
							</p>
							<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
								{running ? '사이트를 실시간으로 스캔하고 있습니다' : '4단계 스캔이 완료되었습니다'}
							</h2>
						</div>
						<span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
							{Math.min(100, progressPct)}%
						</span>
					</div>
					<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
						<div
							className={`h-full rounded-full transition-[width] duration-500 ${
								running ? 'bg-sky-500' : 'bg-emerald-500'
							}`}
							style={{ width: `${Math.min(100, progressPct)}%` }}
						/>
					</div>
					<ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
						{LIVE_SCAN_STEPS.map((step, index) => {
							const status = steps[step.id];
							const active = status === 'running';
							const done = status === 'done';
							return (
								<li
									key={step.id}
									className={`rounded-xl border px-3 py-3 transition-colors ${
										done
											? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30'
											: active
												? 'animate-pulse border-sky-200 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/30'
												: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'
									}`}
								>
									<div className="flex items-start gap-2.5">
										<span
											className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
												done
													? 'bg-emerald-500 text-white'
													: active
														? 'bg-sky-500 text-white'
														: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
											}`}
										>
											{done ? <Check className="h-3.5 w-3.5" /> : index + 1}
										</span>
										<div className="min-w-0">
											<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{step.label}</p>
											<p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{step.hint}</p>
											<p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
												{done ? '완료' : active ? '진행 중' : '대기'}
											</p>
										</div>
									</div>
								</li>
							);
						})}
					</ol>
				</section>
			) : (
				<section className={`${CARD} flex flex-col items-center justify-center px-6 py-16 text-center`}>
					<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
						<Radar className="h-6 w-6" />
					</span>
					<h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
						진단할 URL을 입력하고 실시간 스캔을 시작하세요
					</h2>
					<p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
						크롤링 → 메타태그 파싱 → 스키마 검증 → GEO 인용도 분석 순으로 진행되며, 완료 후 점수·취약점·처방
						JSON-LD가 3단 대시보드로 표시됩니다.
					</p>
				</section>
			)}

			{result ? (
				<>
					<section className="grid gap-4 xl:grid-cols-3" aria-label="진단 결과 대시보드">
						<article className={`${CARD} p-5`}>
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
								Score Card
							</p>
							<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">종합 GEO 점수</h3>
							<div className="mt-4 flex items-center gap-5">
								<ScoreGauge score={result.scores.overall} />
								<div className="min-w-0 flex-1 space-y-3">
									<ScoreMeter label="스키마 점수" score={result.scores.schema} />
									<ScoreMeter label="지식그래프 연동 지수" score={result.scores.knowledgeGraph} />
									<ScoreMeter label="GEO 인용도" score={result.scores.geo} />
								</div>
							</div>
							<dl className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
								<div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
									<dt className="font-semibold">사이트</dt>
									<dd className="mt-0.5 truncate font-bold text-slate-800 dark:text-slate-100">
										{result.siteName}
									</dd>
								</div>
								<div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
									<dt className="font-semibold">업종</dt>
									<dd className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
										{LIVE_INDUSTRY_LABEL[result.industry]}
									</dd>
								</div>
							</dl>
							<p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{result.summary}</p>
							{result.detected?.types?.length ? (
								<div className="mt-3 flex flex-wrap gap-1">
									{result.detected.types.slice(0, 8).map((type) => (
										<span
											key={type}
											className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300"
										>
											{type}
										</span>
									))}
								</div>
							) : null}
							<MetaStatusGrid result={result} />
						</article>

						<article className={`${CARD} flex min-h-[22rem] flex-col p-5`}>
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
								Risk Factors
							</p>
							<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
								감점 요인 & 취약점
							</h3>
							<ul className="mt-4 space-y-2.5">
								{result.issues.map((issue) => (
									<li
										key={issue.id}
										className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40"
									>
										<div className="flex items-start justify-between gap-2">
											<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{issue.title}</p>
											<LiveSeverityBadge severity={issue.severity} />
										</div>
										<p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
											{issue.description}
										</p>
									</li>
								))}
							</ul>
						</article>

						<article className={`${CARD} flex min-h-[22rem] flex-col p-5`}>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
										Prescription Schema
									</p>
									<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
										자동 생성된 처방 스키마
									</h3>
								</div>
							</div>
							<div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
								<pre className="max-h-[22rem] overflow-auto p-4 text-[11px] leading-5 text-slate-100">
									<code>{result.jsonLdPretty}</code>
								</pre>
							</div>
							<div className="mt-3 grid gap-2 sm:grid-cols-2">
								<button
									type="button"
									onClick={() => handleCopy('jsonld')}
									className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
								>
									{copied === 'jsonld' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
									JSON-LD 코드 복사
								</button>
								<button
									type="button"
									onClick={() => handleCopy('head')}
									className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
								>
									{copied === 'head' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
									head 태그 주입 코드 복사
								</button>
							</div>
						</article>
					</section>

					<footer className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5`}>
						<p className="text-xs text-slate-500 dark:text-slate-400">
							결과 ID <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{result.id}</span>
							<span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
							{result.scannedAt} · {result.targetFocus}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
							>
								{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
								진단 결과 DB에 저장하기
							</button>
							<button
								type="button"
								onClick={handleDownload}
								disabled={downloading}
								className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
								고객 제안용 리포트 다운로드
							</button>
						</div>
					</footer>
				</>
			) : null}

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-300'
									: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
							}`}
						>
							{toast.tone === 'error' && <TriangleAlert className="h-3.5 w-3.5" />}
							{toast.message}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ScoreGauge({ score }: { score: number }) {
	const radius = 38;
	const circ = 2 * Math.PI * radius;
	const offset = circ * (1 - score / 100);
	return (
		<div className="relative h-[108px] w-[108px] shrink-0">
			<svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="10"
					className="text-slate-100 dark:text-slate-700"
				/>
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="10"
					strokeDasharray={circ}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className={`transition-[stroke-dashoffset] duration-700 ${scoreRingClass(score)}`}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className={`text-2xl font-bold tabular-nums leading-none ${scoreToneClass(score)}`}>{score}</span>
				<span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">GEO</span>
			</div>
		</div>
	);
}

function MetaStatusGrid({ result }: { result: LiveDiagnosticResult }) {
	const rows = [
		{ label: 'HTTPS', value: result.crawl ? (result.crawl.https ? '적용' : '미적용') : '-', ok: result.crawl?.https },
		{ label: 'HTTP', value: result.crawl?.status != null ? String(result.crawl.status) : '-', ok: result.crawl?.ok },
		{ label: 'title', value: result.meta?.title || '없음', ok: Boolean(result.meta?.title) },
		{ label: 'description', value: result.meta?.description || '없음', ok: Boolean(result.meta?.description) },
		{ label: 'og:title', value: result.meta?.ogTitle || '없음', ok: Boolean(result.meta?.ogTitle) },
		{ label: 'og:image', value: result.meta?.ogImage || '없음', ok: Boolean(result.meta?.ogImage) },
		{ label: 'canonical', value: result.meta?.canonical || '없음', ok: Boolean(result.meta?.canonical) },
		{
			label: 'JSON-LD',
			value: result.detected ? `${result.detected.blockCount}블록` : '-',
			ok: (result.detected?.blockCount ?? 0) > 0,
		},
	];
	return (
		<dl className="mt-4 grid grid-cols-2 gap-1.5">
			{rows.map((row) => (
				<div key={row.label} className="rounded-lg border border-slate-100 px-2.5 py-1.5 dark:border-slate-700">
					<dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
						{row.label}
					</dt>
					<dd
						className={`mt-0.5 truncate text-[11px] font-semibold ${
							row.ok
								? 'text-emerald-700 dark:text-emerald-300'
								: 'text-rose-600 dark:text-rose-300'
						}`}
						title={row.value}
					>
						{row.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

function ScoreMeter({ label, score }: { label: string; score: number }) {
	return (
		<div>
			<div className="mb-1 flex items-center justify-between gap-2">
				<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
				<span className={`text-[11px] font-bold tabular-nums ${scoreToneClass(score)}`}>{score}</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
				<div
					className={`h-full rounded-full transition-[width] duration-700 ${scoreBarClass(score)}`}
					style={{ width: `${score}%` }}
				/>
			</div>
		</div>
	);
}
