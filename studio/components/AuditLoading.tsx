'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

interface ScanStep {
	tag: string;
	message: string;
}

const STEPS: Record<'ko' | 'en', ScanStep[]> = {
	ko: [
		{ tag: 'CONNECT', message: '대상 URL에 HTTPS 핸드셰이크 및 HTML 응답 수신 중...' },
		{ tag: 'HTML Parsing', message: '메타 태그, Canonical, OG 태그 및 Open Graph 이미지 추출 중...' },
		{ tag: 'Heading Hierarchy', message: 'H1–H3 헤딩 구조 및 중복/순서 비약 검증 중...' },
		{ tag: 'JSON-LD Schema', message: 'Schema.org 규격 대조 · NewsArticle / Organization / Person 검증 중...' },
		{ tag: 'E-E-A-T Signal', message: '저자(Author) 프로필 및 발행자(Publisher) 지식 그래프 분석 중...' },
		{ tag: 'GEO Citation Rate', message: 'Perplexity / ChatGPT Search AI 인용 신호 분석 및 리포트 생성 완료' },
	],
	en: [
		{ tag: 'CONNECT', message: 'Opening HTTPS session and fetching HTML response...' },
		{ tag: 'HTML Parsing', message: 'Extracting meta tags, canonical, OG tags & Open Graph image...' },
		{ tag: 'Heading Hierarchy', message: 'Validating H1–H3 structure, duplicates, and hierarchy skips...' },
		{ tag: 'JSON-LD Schema', message: 'Cross-checking Schema.org · NewsArticle / Organization / Person...' },
		{ tag: 'E-E-A-T Signal', message: 'Analyzing author profiles and publisher knowledge graph...' },
		{ tag: 'GEO Citation Rate', message: 'Scoring Perplexity / ChatGPT Search citation signals — report ready' },
	],
};

const TOTAL_STEPS = 6;
/** Pace while waiting on the network / parser. */
const SLOW_INTERVAL_MS = 450;
/** Pace once backend payload is ready — fast-forward remaining checks. */
const FAST_INTERVAL_MS = 180;
/** Hold 6/6 + full bar so the user can see completion before reveal. */
const COMPLETE_HOLD_MS = 300;

interface AuditLoadingProps {
	url: string;
	/** True when the audit API / cache payload is already available. */
	isDataReady?: boolean;
	/** Fires after 6/6 UI completion (+ short hold). */
	onComplete?: () => void;
	/** Force-refresh re-audit copy ("🔄 실시간 재진단 중..."). */
	forceRefresh?: boolean;
}

/**
 * Step runner for the precision-scan terminal.
 * Backend readiness and UI step progress are independent — the UI always
 * walks 1/6 → 6/6 before calling onComplete (fast-forward if data is ready).
 */
export function AuditLoading({
	url,
	isDataReady = false,
	onComplete,
	forceRefresh = false,
}: AuditLoadingProps) {
	const t = useTranslations('audit');
	const locale = useLocale() as 'ko' | 'en';
	const steps = STEPS[locale] ?? STEPS.ko;
	/** Number of checks fully activated (0–6). */
	const [completedSteps, setCompletedSteps] = useState(0);
	const completedRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	// Reset runner when URL changes (new scan session).
	useEffect(() => {
		setCompletedSteps(0);
		completedRef.current = false;
	}, [url]);

	// Sequential step timer — slow until data ready, then fast-forward.
	useEffect(() => {
		if (completedSteps >= TOTAL_STEPS) return;

		const interval = isDataReady ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
		const timer = window.setTimeout(() => {
			setCompletedSteps((prev) => Math.min(prev + 1, TOTAL_STEPS));
		}, interval);

		return () => window.clearTimeout(timer);
	}, [completedSteps, isDataReady]);

	// Reveal only after 6/6 + data ready + short hold.
	useEffect(() => {
		if (completedSteps < TOTAL_STEPS || !isDataReady || completedRef.current) return;

		const timer = window.setTimeout(() => {
			if (completedRef.current) return;
			completedRef.current = true;
			onCompleteRef.current?.();
		}, COMPLETE_HOLD_MS);

		return () => window.clearTimeout(timer);
	}, [completedSteps, isDataReady]);

	const progressPct = (completedSteps / TOTAL_STEPS) * 100;
	const activeIndex = completedSteps >= TOTAL_STEPS ? TOTAL_STEPS - 1 : completedSteps;

	return (
		<div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07090d] shadow-2xl shadow-black/40">
			<div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
				<span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
				<span className="ml-2 font-mono text-[11px] text-slate-500">{t('loadingTerminalTitle')}</span>
			</div>

			<div className="px-5 py-6 sm:px-7">
				<div className="mb-5 flex flex-col gap-1">
					<p className="text-base font-bold text-white sm:text-lg">
						{forceRefresh ? t('loadingRescanTitle') : t('loadingTitle')}
					</p>
					<p className="truncate font-mono text-xs text-cyan-400/90">{url || '—'}</p>
				</div>

				<div className="space-y-2 font-mono text-[12px] leading-relaxed sm:text-[13px]">
					{steps.map((step, index) => {
						const done = index < completedSteps;
						const active = index === activeIndex && completedSteps < TOTAL_STEPS;
						const allDone = completedSteps >= TOTAL_STEPS && index < TOTAL_STEPS;
						const isCompleteRow = done || (allDone && index === TOTAL_STEPS - 1);
						return (
							<div
								key={step.tag}
								className={`flex gap-2 rounded-lg px-2 py-1.5 transition-all duration-200 ${
									active
										? 'bg-accent/10 ring-1 ring-accent/30'
										: isCompleteRow
											? 'opacity-90'
											: 'opacity-35'
								}`}
							>
								<span
									className={`shrink-0 tabular-nums ${
										isCompleteRow && !active
											? 'text-emerald-400'
											: active
												? 'text-accent-light'
												: 'text-slate-600'
									}`}
								>
									{isCompleteRow && !active ? '✔' : active ? '▸' : '·'}
								</span>
								<span
									className={`shrink-0 font-bold ${
										active ? 'text-cyan-300' : isCompleteRow ? 'text-slate-400' : 'text-slate-600'
									}`}
								>
									[{step.tag}]
								</span>
								<span
									className={
										active ? 'text-slate-100' : isCompleteRow ? 'text-slate-400' : 'text-slate-600'
									}
								>
									{step.message}
								</span>
								{active && <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-accent-light" />}
							</div>
						);
					})}
				</div>

				<div className="mt-6">
					<div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
						<span>{t('loadingProgress')}</span>
						<span className="tabular-nums">
							{completedSteps}/{TOTAL_STEPS}
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
						<div
							className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-400 transition-all duration-300 ease-out"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
