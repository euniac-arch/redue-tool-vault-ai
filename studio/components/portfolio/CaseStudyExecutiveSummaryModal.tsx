'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ExternalLink, FileText, FlaskConical, Newspaper, Share2, X } from 'lucide-react';
import {
	axisDisplayMeta,
	buildAxisCommentary,
	buildExecutiveNarrative,
	buildImprovementItems,
	buildNextSteps,
	formatCaseStudyScore,
	resolveCaseStudyResultHref,
	schemaInjectionLabel,
} from '@/lib/case-studies/executive-summary';
import type { CaseStudyData } from '@/lib/case-study-types';
import { useModalA11y } from '@/lib/ui/use-modal-a11y';

const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

interface CaseStudyExecutiveSummaryModalProps {
	isOpen: boolean;
	data: CaseStudyData | null;
	onClose: () => void;
	resultHref?: string;
}

export function CaseStudyExecutiveSummaryModal({
	isOpen,
	data,
	onClose,
	resultHref,
}: CaseStudyExecutiveSummaryModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useModalA11y(isOpen && Boolean(data), onClose, panelRef);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && data ? (
				<motion.div
					key="case-study-exec-layer"
					className="print:hidden fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm motion-reduce:backdrop-blur-none sm:p-4"
					role="presentation"
					onClick={onClose}
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? undefined : { opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.2 }}
				>
					<motion.div
						ref={panelRef}
						tabIndex={-1}
						role="dialog"
						aria-modal="true"
						aria-labelledby="case-study-exec-title"
						aria-describedby="case-study-exec-desc"
						className="relative flex max-h-[90vh] w-[92%] max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#0b1324]/95 shadow-[0_0_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl outline-none motion-reduce:backdrop-blur-none"
						onClick={(event) => event.stopPropagation()}
						initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
						transition={{ duration: reduceMotion ? 0 : 0.28, ease: PREMIUM_EASE }}
					>
						<button
							type="button"
							onClick={onClose}
							aria-label="닫기"
							className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-[#0b1324]/80 p-1.5 text-slate-400 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white motion-reduce:transition-none md:right-6 md:top-6"
						>
							<X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</button>
						<div className="custom-scrollbar overflow-y-auto p-6 md:p-8">
							<ModalBody data={data} resultHref={resultHref} onClose={onClose} />
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

function ModalBody({
	data,
	resultHref,
	onClose,
}: {
	data: CaseStudyData;
	resultHref?: string;
	onClose: () => void;
}) {
	const { siteInfo, normalizedScore } = data;
	const verified = data.kind === 'verified';
	const hasBaseline = data.hasBaseline !== false;
	const lift = Number((normalizedScore.after.score - normalizedScore.before.score).toFixed(1));
	const narrative = buildExecutiveNarrative(data);
	const improvements = buildImprovementItems(data);
	const nextSteps = buildNextSteps(data);
	const fullReportHref = resolveCaseStudyResultHref(data, resultHref);

	return (
		<>
			<header className="pr-10">
				<div className="flex flex-wrap items-center gap-1.5">
					{verified ? (
						<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-emerald-200">
							🟢 Verified Real Case
						</span>
					) : (
						<span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
							<FlaskConical className="h-3 w-3" strokeWidth={2} aria-hidden />
							업종별 시뮬레이션 모델
						</span>
					)}
					{siteInfo.category ? (
						<span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
							{siteInfo.category}
						</span>
					) : null}
				</div>
				<h2 id="case-study-exec-title" className="mt-3 text-2xl font-extrabold tracking-tight text-white md:text-[28px]">
					{siteInfo.name}
				</h2>
				<a
					href={siteInfo.domainUrl || '#'}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-cyan-300/90 hover:underline"
				>
					{siteInfo.domain}
					<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
				</a>
				<p id="case-study-exec-desc" className="mt-3 text-sm font-medium leading-relaxed text-slate-300">
					실제 진단 데이터 기반 AI 검색 최적화 성과 요약 리포트
				</p>
			</header>

			<section className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
					Before ➔ After 종합 성과
				</p>
				<div className="mt-4 flex flex-wrap items-end justify-center gap-4 sm:gap-8">
					<div className="flex flex-col items-center">
						<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">초기 점수</span>
						<p className="mt-1.5 font-mono leading-none">
							<span className="text-3xl font-semibold tabular-nums text-slate-400 md:text-4xl">
								{hasBaseline ? formatCaseStudyScore(normalizedScore.before.score) : '—'}
							</span>
							{hasBaseline ? (
								<span className="ml-1 text-xs font-medium text-slate-500">
									/{normalizedScore.before.maxScore}
								</span>
							) : null}
						</p>
					</div>
					<div className="mb-2 text-cyan-300/70" aria-hidden>
						➔
					</div>
					<div className="flex flex-col items-center">
						<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/90">최신 점수</span>
						<p className="mt-1.5 font-mono leading-none">
							<span className="bg-gradient-to-br from-emerald-200 via-emerald-400 to-teal-300 bg-clip-text text-5xl font-extrabold tabular-nums text-transparent [text-shadow:0_0_18px_rgba(52,211,153,0.4)] md:text-6xl">
								{formatCaseStudyScore(normalizedScore.after.score)}
							</span>
							<span className="ml-1 text-sm font-semibold text-emerald-500/70">
								/{normalizedScore.after.maxScore}
							</span>
						</p>
					</div>
				</div>
				{hasBaseline && lift > 0 ? (
					<p className="mt-4 text-center">
						<span className="inline-flex items-center rounded-md border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-sm font-extrabold text-cyan-200">
							🚀 +{formatCaseStudyScore(lift)} pt
						</span>
					</p>
				) : null}
				<p className="mt-5 text-sm leading-relaxed text-slate-300">
					<NarrativeCopy narrative={narrative} />
				</p>
			</section>

			<section className="mt-5">
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
					4-Axis 핵심 지표 전후 비교
				</p>
				<div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
					{data.axes.map((axis) => {
						const meta = axisDisplayMeta(axis);
						const hint =
							axis.key === 'schema' ? schemaInjectionLabel(axis, hasBaseline) : meta.hint;
						const delta = Number((axis.after.score - axis.before.score).toFixed(1));
						const isImproved = hasBaseline && delta > 0;
						const { commentary, keyFixes } = buildAxisCommentary(axis, siteInfo.category, hasBaseline);
						return (
							<div
								key={axis.key}
								className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 transition-colors hover:border-white/20"
							>
								<div>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-sm font-semibold text-slate-100">{meta.title}</p>
											{hint ? <p className="mt-0.5 text-[11px] text-cyan-300/80">{hint}</p> : null}
										</div>
										<p className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-xs font-bold tabular-nums">
											<span className="text-slate-500">
												{hasBaseline ? formatCaseStudyScore(axis.before.score) : '—'}
											</span>
											<span className="text-slate-600">➔</span>
											<span className={axis.after.score >= 90 ? 'text-sm text-emerald-400' : 'text-sm text-cyan-300'}>
												{formatCaseStudyScore(axis.after.score)}
											</span>
											{isImproved ? (
												<span className="ml-0.5 text-[10px] font-semibold text-emerald-400">
													(+{formatCaseStudyScore(delta)}pt)
												</span>
											) : null}
										</p>
									</div>
									<div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
										<div
											className="absolute inset-y-0 left-0 rounded-full bg-slate-500/45"
											style={{ width: `${hasBaseline ? Math.min(axis.before.score, 100) : 0}%` }}
										/>
										<div
											className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-300"
											style={{ width: `${Math.min(axis.after.score, 100)}%` }}
										/>
									</div>
									<div className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
										<p className="text-xs font-normal leading-relaxed text-slate-300">{commentary}</p>
									</div>
								</div>
								{keyFixes.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
										{keyFixes.map((fix) => (
											<span
												key={fix}
												className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200"
											>
												<span aria-hidden>✓</span>
												{fix}
											</span>
										))}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
				<div className="mt-3 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-[11px] text-slate-500">
					<span className="flex items-start gap-1.5">
						<span aria-hidden>🛡️</span>
						<span>
							본 결과는 Google PageSpeed Insights(Lighthouse) 및 Schema.org 구조화 데이터 정밀
							검증 스냅샷을 기반으로 합니다.
						</span>
					</span>
					<span className="block pl-[22px] font-mono text-slate-400">
						{data.verifiedAt ? `Verified ${data.verifiedAt}` : 'Lighthouse Verified'}
					</span>
				</div>
			</section>

			<section className="mt-6">
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
					이번 최적화로 개선된 주요 내용
				</p>
				<ul className="mt-3 flex flex-col gap-2.5">
					{improvements.map((item) => (
						<li
							key={item.title}
							className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3.5 py-3"
						>
							<p className="text-sm font-semibold text-emerald-100">
								🟢 {item.title}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-slate-400">{item.detail}</p>
						</li>
					))}
				</ul>
			</section>

			<section className="mt-6">
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
					향후 AI 검색 1위 선점을 위한 권장 조치
				</p>
				<ul className="mt-3 flex flex-col gap-2.5">
					{nextSteps.map((item) => (
						<li
							key={item.title}
							className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.05] px-3.5 py-3"
						>
							<p className="text-sm font-semibold text-cyan-100">📌 {item.title}</p>
							<p className="mt-1 text-xs leading-relaxed text-slate-400">{item.detail}</p>
						</li>
					))}
				</ul>
			</section>

			<section className="mt-8 border-t border-white/10 pt-6">
				<p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Next Stage Roadmap</p>
				<h4 className="mt-1 text-lg font-bold text-white">
					기초공사 완료 후, AI 검색 상위 선점을 위한 필수 3대 활동
				</h4>
				<p className="mt-1 text-xs leading-relaxed text-slate-400">
					스키마 주입으로 AI가 사이트를 읽을 수 있는 토대를 마쳤다면, 이제 최신성과 신뢰도 점수(E-E-A-T)를
					꾸준히 공급해야 생성형 AI 추천 1위를 유지할 수 있습니다.
				</p>

				<div className="my-4 grid grid-cols-1 gap-3.5 md:grid-cols-3">
					<div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-cyan-500/30">
						<div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
							<FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
						</div>
						<p className="mb-1 text-xs font-bold text-slate-200">홈페이지 심층 콘텐츠</p>
						<p className="text-[11px] leading-relaxed text-slate-400">
							주 1~2회 전문 칼럼·심층 FAQ·실제 사례 업데이트로 ChatGPT·Perplexity의 필수 인용
							출처(Citation Source)로 자리 잡습니다.
						</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-cyan-500/30">
						<div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
							<Share2 className="h-4 w-4" strokeWidth={2} aria-hidden />
						</div>
						<p className="mb-1 text-xs font-bold text-slate-200">소셜 & 풋프린트 동기화</p>
						<p className="text-[11px] leading-relaxed text-slate-400">
							인스타그램·블로그·유튜브 등 공식 채널을 홈페이지 엔티티와 교차 연결해 AI가 신뢰하는
							복합 평판 신호(Brand Authority)를 형성합니다.
						</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-cyan-500/30">
						<div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
							<Newspaper className="h-4 w-4" strokeWidth={2} aria-hidden />
						</div>
						<p className="mb-1 text-xs font-bold text-slate-200">디지털 PR & 공신력 배포</p>
						<p className="text-[11px] leading-relaxed text-slate-400">
							언론 기사·학술/전문 매체 인용을 확보해 AI 검색 엔진의 환각(Hallucination) 방지
							알고리즘에서 가장 높은 가중치를 받는 인용 자산을 구축합니다.
						</p>
					</div>
				</div>

				<div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900/60 p-5 shadow-[0_0_25px_rgba(6,182,212,0.1)] sm:flex-row sm:items-center md:p-6">
					<div className="min-w-0">
						<p className="text-sm font-bold text-white">
							지속적인 AI 검색 상위 노출 관리, 직접 하기 번거로우신가요?
						</p>
						<p className="mt-1 text-xs leading-relaxed text-slate-400">
							콘텐츠 기획부터 언론 배포, AI 인용 최적화 운영까지 REDUE 전문 엔지니어팀이 전담해
							드립니다.
						</p>
					</div>
					<Link
						href="/contact"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:brightness-110 md:text-sm"
					>
						<span>AI 상위 노출 운영 작업 의뢰하기</span>
						<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
					</Link>
				</div>
			</section>

			<footer className="mt-7 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
				<a
					href={fullReportHref}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-300/60 hover:bg-cyan-500/20 motion-reduce:transition-none"
				>
					전체 상세 진단 결과 원본 보기
					<ArrowUpRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
				</a>
				<button
					type="button"
					onClick={onClose}
					className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.28)] transition hover:brightness-110 motion-reduce:transition-none"
				>
					닫기
				</button>
			</footer>
		</>
	);
}

function NarrativeCopy({
	narrative,
}: {
	narrative: ReturnType<typeof buildExecutiveNarrative>;
}) {
	if (narrative.variant === 'after-only') {
		return (
			<>
				최신 진단 점수 <strong className="font-bold text-white">{narrative.afterScore}점</strong>을
				기준으로, 주요 생성형 AI(ChatGPT, Perplexity, Gemini)가 사이트 엔티티를 명확히 인지하고 인용할
				수 있는 <strong className="font-bold text-emerald-300">{narrative.foundation}</strong>
				했습니다.
			</>
		);
	}

	if (narrative.variant === 'stable') {
		return (
			<>
				현재 종합 점수 <strong className="font-bold text-white">{narrative.afterScore}점</strong>을
				유지하고 있으며, 주요 생성형 AI(ChatGPT, Perplexity, Gemini)가 사이트 엔티티를 인지·인용할 수
				있는 <strong className="font-bold text-emerald-300">{narrative.foundation}</strong>했습니다.
			</>
		);
	}

	return (
		<>
			기존 <strong className="font-bold text-white">{narrative.beforeScore}점</strong>에서{' '}
			<strong className="font-bold text-white">{narrative.afterScore}점</strong>으로 {narrative.intensity}
			, 주요 생성형 AI(ChatGPT, Perplexity, Gemini)가 사이트 엔티티를 명확히 인지하고 인용할 수 있는{' '}
			<strong className="font-bold text-emerald-300">{narrative.foundation}</strong>했습니다.
		</>
	);
}
