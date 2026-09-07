'use client';

import { useEffect, useState } from 'react';
import { Copy, FileDown, Loader2, X } from 'lucide-react';
import type { DiagnosticDetail, RecommendationPriority } from '@/lib/admin/diagnostic-management';
import { DiagnosticCategoryBadge, DiagnosticScoreBadge, DiagnosticScoreBar } from './diagnostic-badges';

interface DiagnosticReportDrawerProps {
	open: boolean;
	loading: boolean;
	detail: DiagnosticDetail | null;
	onClose: () => void;
	onCopyLink: (url: string) => void;
	onDownloadPdf: (detail: DiagnosticDetail) => void;
}

const PRIORITY_STYLE: Record<RecommendationPriority, string> = {
	high: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	medium: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600',
};

const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
	high: '긴급',
	medium: '권장',
	low: '선택',
};

export function DiagnosticReportDrawer({
	open,
	loading,
	detail,
	onClose,
	onCopyLink,
	onDownloadPdf,
}: DiagnosticReportDrawerProps) {
	const [entered, setEntered] = useState(false);

	useEffect(() => {
		if (!open) {
			setEntered(false);
			return;
		}
		const frame = window.requestAnimationFrame(() => setEntered(true));
		return () => window.cancelAnimationFrame(frame);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKey);
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50" role="presentation">
			<button
				type="button"
				className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${
					entered ? 'opacity-100' : 'opacity-0'
				}`}
				aria-label="리포트 닫기"
				onClick={onClose}
			/>
			<aside
				role="dialog"
				aria-modal="true"
				aria-labelledby="diagnostic-report-title"
				className={`absolute inset-y-0 right-0 flex w-full max-w-xl transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-slate-700 dark:bg-slate-800 ${
					entered ? 'translate-x-0' : 'translate-x-full'
				}`}
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div className="min-w-0">
						<p className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
							{detail?.id ?? 'DIAG-······'}
						</p>
						<h2 id="diagnostic-report-title" className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-slate-100">
							{detail?.siteName ?? '진단 리포트'}
						</h2>
						{detail ? (
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<DiagnosticCategoryBadge category={detail.category} />
								<DiagnosticScoreBadge score={detail.totalScore} />
							</div>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						aria-label="닫기"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					{loading || !detail ? (
						<div className="flex h-48 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
							<span className="inline-flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								리포트 상세를 불러오는 중…
							</span>
						</div>
					) : (
						<>
							<section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
								<div className="flex items-end justify-between gap-3">
									<div>
										<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
											종합 점수
										</p>
										<p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
											{detail.totalScore}
										</p>
									</div>
									<a
										href={detail.url || detail.reportData?.url || `https://${detail.domain}`}
										target="_blank"
										rel="noopener noreferrer"
										className="max-w-[14rem] truncate text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
									>
										{detail.url || detail.reportData?.url || detail.domain}
									</a>
								</div>
								<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail.summary}</p>
								<dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
									<div>
										<dt className="font-semibold">요청자</dt>
										<dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{detail.requestedBy}</dd>
									</div>
									<div>
										<dt className="font-semibold">진단일시</dt>
										<dd className="mt-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">{detail.createdAt}</dd>
									</div>
								</dl>
							</section>

							<section className="mt-6">
								<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">세부 진단 결과</h3>
								<div className="mt-3 grid gap-3">
									<ScoreRow label="스키마 완성도" score={detail.schemaScore} hint="JSON-LD / 필수 속성 커버리지" />
									<ScoreRow
										label="지식그래프"
										score={detail.reportData?.knowledgeGraphScore ?? detail.knowledgeGraphScore}
										hint="엔티티 · sameAs · 대표자 연결"
									/>
									<ScoreRow
										label="로컬 SoV"
										score={detail.reportData?.localSovScore ?? detail.localSovScore}
										hint="NAP 일관성 · 플레이스 인용"
									/>
									<ScoreRow label="GEO 종합" score={detail.geoScore} hint="AI 엔진 인용 가능 점수" />
								</div>
							</section>

							<section className="mt-6">
								<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">발견된 문제점</h3>
								<ul className="mt-3 space-y-2">
									{detail.issues.map((issue) => (
										<li
											key={issue}
											className="rounded-lg border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
										>
											{issue}
										</li>
									))}
								</ul>
							</section>

							<section className="mt-6">
								<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">추천 조치 사항</h3>
								<ul className="mt-3 space-y-3">
									{(detail.reportData?.recommendations ?? detail.recommendations).map((item) => (
										<li
											key={item.title}
											className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
										>
											<div className="flex items-start justify-between gap-2">
												<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
												<span
													className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${PRIORITY_STYLE[item.priority]}`}
												>
													{PRIORITY_LABEL[item.priority]}
												</span>
											</div>
											<p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{item.description}</p>
										</li>
									))}
								</ul>
							</section>
						</>
					)}
				</div>

				<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
					<button
						type="button"
						disabled={!detail}
						onClick={() => detail && onCopyLink(detail.reportShareUrl)}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						<Copy className="h-3.5 w-3.5" />
						리포트 링크 복사
					</button>
					<button
						type="button"
						disabled={!detail}
						onClick={() => detail && onDownloadPdf(detail)}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<FileDown className="h-3.5 w-3.5" />
						PDF 다운로드 (Mock)
					</button>
				</footer>
			</aside>
		</div>
	);
}

function ScoreRow({ label, score, hint }: { label: string; score: number; hint: string }) {
	return (
		<div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
			<DiagnosticScoreBar score={score} label={label} />
			<p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
		</div>
	);
}
