'use client';

/**
 * "AI 팩트체크 이슈 리포트" — sits above the raw JSON-LD code viewer
 * (`AuditTechnicalEvidence`'s snippet block). Surfaces the Step 1
 * `/api/seo/fact-check` issue list with a severity-colored summary banner,
 * per-issue detail cards, a best-effort "clean JSON-LD" copy action, and a
 * manual re-check button.
 */
import { useMemo, useState } from 'react';
import { buildCleanSchemaBlocks, formatCleanSchemaAsScriptTag } from '@/lib/audit/fact-check-clean-schema';
import { useFactCheck } from '@/lib/audit/fact-check-client';
import type { FactCheckSeverity } from '@/lib/audit/fact-check';

interface SchemaFactCheckIssueReportProps {
	url: string;
}

const SEVERITY_META: Record<FactCheckSeverity, { label: string; badge: string; dot: string }> = {
	high: {
		label: 'High',
		badge: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
		dot: 'bg-rose-500',
	},
	medium: {
		label: 'Medium',
		badge:
			'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
		dot: 'bg-amber-500',
	},
	low: {
		label: 'Low',
		badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
		dot: 'bg-slate-400',
	},
};

/** Banner tone follows the worst severity present, not the raw score. */
function bannerToneFromIssues(hasHigh: boolean, hasMedium: boolean) {
	if (hasHigh) {
		return {
			border: 'border-rose-300 dark:border-rose-500/30',
			bg: 'bg-rose-50 dark:bg-rose-500/[0.06]',
			text: 'text-rose-800 dark:text-rose-200',
		};
	}
	if (hasMedium) {
		return {
			border: 'border-amber-300 dark:border-amber-500/30',
			bg: 'bg-amber-50 dark:bg-amber-500/[0.06]',
			text: 'text-amber-800 dark:text-amber-200',
		};
	}
	return {
		border: 'border-slate-300 dark:border-slate-600/40',
		bg: 'bg-slate-50 dark:bg-slate-500/[0.06]',
		text: 'text-slate-700 dark:text-slate-200',
	};
}

function LoadingSkeleton() {
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-6">
			<div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
			<div className="h-16 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
			<div className="h-20 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
			<div className="h-20 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
		</div>
	);
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/[0.06] dark:text-rose-300 sm:p-6">
			<p className="font-bold">AI 팩트체크를 불러오지 못했습니다.</p>
			<p className="text-xs text-rose-600/90 dark:text-rose-300/80">{message}</p>
			<button
				type="button"
				onClick={onRetry}
				className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-500/10"
			>
				다시 시도
			</button>
		</div>
	);
}

function CleanCopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable — no-op */
		}
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-2 text-xs font-bold text-[#8B6914] transition hover:bg-[#D4AF37]/20 dark:text-[#E8C547]"
		>
			{copied ? '✅ 복사 완료' : '🧹 정제된 클린 JSON-LD 복사'}
		</button>
	);
}

export function SchemaFactCheckIssueReport({ url }: SchemaFactCheckIssueReportProps) {
	const { state, refresh } = useFactCheck(url);

	const clean = useMemo(() => {
		if (state.kind !== 'ready' || state.data.issues.length === 0) return null;
		const { cleaned, removedFields } = buildCleanSchemaBlocks(state.data.schemaBlocks, state.data.issues);
		if (removedFields.length === 0) return null;
		return { code: formatCleanSchemaAsScriptTag(cleaned), removedFields };
	}, [state]);

	if (state.kind === 'loading') return <LoadingSkeleton />;
	if (state.kind === 'error') return <ErrorState message={state.message} onRetry={() => refresh(true)} />;

	const { data } = state;
	const isClean = data.issues.length === 0;
	const hasHigh = data.issues.some((issue) => issue.severity === 'high');
	const hasMedium = data.issues.some((issue) => issue.severity === 'medium');
	const tone = bannerToneFromIssues(hasHigh, hasMedium);

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">AI SCHEMA FACT-CHECK</p>
					<h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">AI 팩트체크 이슈 리포트</h3>
				</div>
				<button
					type="button"
					onClick={() => refresh(true)}
					className="print:hidden inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
				>
					🔁 AI 재검증 실행
				</button>
			</div>

			{/* Header alert banner — robot icon + overall verdict, severity-colored */}
			<div className={`flex items-start gap-3 rounded-xl border p-4 ${tone.border} ${tone.bg}`}>
				<span className="mt-0.5 shrink-0 text-2xl" aria-hidden>
					🤖
				</span>
				<div className={`text-sm leading-relaxed ${tone.text}`}>
					<p className="font-bold">
						AI 감사관 판정 · 무결성 {data.integrity_score}/100
						{!isClean && ` · 이슈 ${data.issues.length}건`}
					</p>
					<p className="mt-1">{data.summary}</p>
				</div>
			</div>

			{isClean ? (
				<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
					✅ 실제 사이트 내용과 스키마가 완벽히 일치합니다. 검색엔진 E-E-A-T 기준을 만족합니다.
				</div>
			) : (
				<>
					<div className="flex flex-col gap-3">
						{data.issues.map((issue, index) => {
							const meta = SEVERITY_META[issue.severity];
							return (
								<div
									key={`${issue.field}-${index}`}
									className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-black/20"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
											<span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
											{meta.label}
										</span>
										<span className="text-sm font-bold text-slate-900 dark:text-slate-100">{issue.type}</span>
										{issue.field && (
											<code className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-white/10 dark:text-slate-300">
												{issue.field}
											</code>
										)}
									</div>

									{issue.detected_value && (
										<p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
											<span className="font-bold text-slate-700 dark:text-slate-300">발견된 내용: </span>
											<span className="font-mono text-rose-700 dark:text-rose-300">{issue.detected_value}</span>
										</p>
									)}

									<p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
										<span className="font-bold text-slate-700 dark:text-slate-300">원인: </span>
										{issue.description}
									</p>

									{issue.recommendation && (
										<p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
											<span className="font-bold">💡 AI 수정 가이드: </span>
											{issue.recommendation}
										</p>
									)}
								</div>
							);
						})}
					</div>

					{clean && (
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-black/20">
							<p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
								감지된 필드({clean.removedFields.join(', ')})를 제거한 참고용 스니펫입니다. 적용 전 반드시 재검토하세요.
							</p>
							<CleanCopyButton code={clean.code} />
						</div>
					)}
				</>
			)}
		</div>
	);
}
