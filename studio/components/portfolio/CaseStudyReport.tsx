import Link from 'next/link';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import type {
	CaseStudyActionTaken,
	CaseStudyAiEngine,
	CaseStudyAxis,
	CaseStudyData,
	CaseStudyDeficit,
	Severity,
	StatusTone,
} from '@/lib/case-study-types';

interface CaseStudyReportProps {
	data: CaseStudyData;
}

const TONE_STYLES: Record<
	StatusTone,
	{ text: string; bg: string; border: string; dot: string; barFill: string }
> = {
	critical: {
		text: 'text-rose-400',
		bg: 'bg-rose-500/10',
		border: 'border-rose-500/30',
		dot: 'bg-rose-400',
		barFill: 'bg-rose-500',
	},
	warning: {
		text: 'text-amber-400',
		bg: 'bg-amber-500/10',
		border: 'border-amber-500/30',
		dot: 'bg-amber-400',
		barFill: 'bg-amber-500',
	},
	good: {
		text: 'text-emerald-400',
		bg: 'bg-emerald-500/10',
		border: 'border-emerald-500/30',
		dot: 'bg-emerald-400',
		barFill: 'bg-emerald-500',
	},
	neutral: {
		text: 'text-slate-400',
		bg: 'bg-white/5',
		border: 'border-white/10',
		dot: 'bg-slate-400',
		barFill: 'bg-slate-500',
	},
};

const SEVERITY_STYLES: Record<Severity, { icon: string; text: string; bg: string; border: string }> = {
	critical: { icon: '🔴', text: 'text-rose-300', bg: 'bg-rose-500/[0.07]', border: 'border-rose-500/25' },
	high: { icon: '🟠', text: 'text-orange-300', bg: 'bg-orange-500/[0.07]', border: 'border-orange-500/25' },
	medium: { icon: '🟡', text: 'text-amber-300', bg: 'bg-amber-500/[0.07]', border: 'border-amber-500/25' },
};

function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
	const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border ${style.border} ${style.bg} px-2.5 py-1 text-[11px] font-semibold ${style.text}`}
		>
			<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
			{children}
		</span>
	);
}

function StarRow({ stars }: { stars: number }) {
	const safe = Math.max(0, Math.min(5, Math.round(safeScore(stars))));
	return (
		<span className="font-mono tracking-tight text-amber-400" aria-label={`${safe}/5`}>
			{'★'.repeat(safe)}
			<span className="text-white/15">{'★'.repeat(5 - safe)}</span>
		</span>
	);
}

/** Top metadata bar: clinic name, domain, category badge, HTTPS / TTFB status. */
function TopBar({ data }: { data: CaseStudyData }) {
	const siteInfo = data.siteInfo;
	if (!siteInfo) return null;
	return (
		<div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-xl font-bold text-white">{siteInfo.name}</h2>
					{data.kind === 'verified' ? (
						<span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-cyan-200">
							🟢 Verified Real Case
						</span>
					) : (
						<span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
							⚪ 업종별 시뮬레이션 모델
						</span>
					)}
					{siteInfo.category ? (
						<span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
							{siteInfo.category}
						</span>
					) : null}
				</div>
				<a
					href={siteInfo.domainUrl || '#'}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-accent-light hover:underline"
				>
					{siteInfo.domain}
					<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
				</a>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400">
					{siteInfo.techStack}
				</span>
				<StatusPill tone={siteInfo.httpsEnabled ? 'good' : 'critical'}>
					HTTPS {siteInfo.httpsEnabled ? '🟢 적용' : '🔴 미적용'}
				</StatusPill>
				<StatusPill tone={siteInfo.ttfbTone}>
					TTFB <span className="font-mono">{siteInfo.ttfbMs}ms</span>{' '}
					{siteInfo.ttfbTone === 'good' ? '🟢 양호' : '🟡 개선 필요'}
				</StatusPill>
			</div>
		</div>
	);
}

/** Left hero panel — headline Before vs After normalized score with glowing lift badge. */
function safeScore(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function ScoreCompareHero({ data }: { data: CaseStudyData }) {
	const before = data.normalizedScore?.before;
	const after = data.normalizedScore?.after;
	if (!before || !after) return null;
	const hasBaseline = data.hasBaseline !== false;
	const lift = Number((safeScore(after.score) - safeScore(before.score)).toFixed(1));
	const algo = data.algorithmScore;

	return (
		<div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-black/20 p-5">
			<div className="grid grid-cols-2 gap-3">
				<ScoreBand title="BEFORE" band={before} muted={!hasBaseline} />
				<ScoreBand title="AFTER" band={after} highlight />
			</div>

			{!hasBaseline ? (
				<p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[11px] font-semibold text-slate-400">
					최초 진단 이력이 없어 After 점수만 표시합니다.
				</p>
			) : null}

			{hasBaseline && lift > 0 ? (
				<div className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-4 text-center case-study-glow">
					<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
						Score Lift
					</span>
					<span className="font-mono text-3xl font-extrabold tabular-nums text-emerald-400 sm:text-4xl">
						🚀 +{lift}pt
					</span>
					<span className="text-xs font-medium text-emerald-200/70">Increase</span>
				</div>
			) : null}

			{algo ? (
				<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
					<span className="text-[11px] font-semibold text-slate-500">가중 배점 추이 (raw)</span>
					<span className="font-mono text-sm font-bold tabular-nums text-slate-200">
						<span className="text-slate-500">
							{hasBaseline ? safeScore(algo.before).toFixed(1) : '—'}
						</span>
						<span className="mx-1.5 text-slate-600">➔</span>
						<span className="text-emerald-400">{safeScore(algo.after).toFixed(1)}</span>
						<span className="text-slate-500"> /{safeScore(algo.maxScore)}</span>
					</span>
				</div>
			) : null}
		</div>
	);
}

function ScoreBand({
	title,
	band,
	highlight,
	muted,
}: {
	title: string;
	band: CaseStudyData['normalizedScore']['before'];
	highlight?: boolean;
	muted?: boolean;
}) {
	const style = TONE_STYLES[muted ? 'neutral' : band.tone] ?? TONE_STYLES.neutral;
	return (
		<div className={`flex flex-col gap-2 rounded-xl border ${style.border} ${style.bg} p-4`}>
			<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</span>
			<span
				className={`font-mono text-4xl font-extrabold leading-none tabular-nums ${
					highlight ? style.text : 'text-slate-300'
				}`}
			>
				{muted ? '—' : band.score}
				{muted ? null : <span className="text-base font-semibold text-slate-500">/{band.maxScore}</span>}
			</span>
			<span className={`text-xs font-semibold leading-snug ${style.text}`}>
				{muted ? '최초 진단 이력 없음' : band.label}
			</span>
		</div>
	);
}

/** Right hero panel — 4-axis before/after progress comparison. */
function AxisBreakdown({ axes, hasBaseline }: { axes: CaseStudyAxis[]; hasBaseline: boolean }) {
	const rows = Array.isArray(axes) ? axes : [];
	return (
		<div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				4-Axis 상세 진단 비교
			</p>
			<div className="flex flex-1 flex-col justify-between gap-4">
				{rows.length === 0 ? (
					<p className="text-xs text-slate-500">4축 세부 점수가 아직 없습니다.</p>
				) : (
					rows.map((axis) => <AxisRow key={axis.key} axis={axis} hasBaseline={hasBaseline} />)
				)}
			</div>
		</div>
	);
}

function AxisRow({ axis, hasBaseline }: { axis: CaseStudyAxis; hasBaseline: boolean }) {
	const beforeScore = safeScore(axis.before?.score);
	const afterScore = safeScore(axis.after?.score);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<span className="text-xs font-semibold text-slate-300">{axis.label}</span>
				<span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
					<span className="text-slate-500">
						{hasBaseline ? `${beforeScore}점${axis.before?.raw ? ` (${axis.before.raw})` : ''}` : '—'}
					</span>
					{axis.before?.badge ? <AxisBadge {...axis.before.badge} /> : null}
					<span className="text-slate-600">➔</span>
					<span className="font-bold text-emerald-400">
						{afterScore}점{axis.after?.raw ? ` (${axis.after.raw})` : ''}
					</span>
					{axis.after?.badge ? <AxisBadge {...axis.after.badge} /> : null}
				</span>
			</div>
			<div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-slate-500/50"
					style={{ width: `${hasBaseline ? Math.min(beforeScore, 100) : 0}%` }}
				/>
				<div
					className={`absolute inset-y-0 left-0 rounded-full ${TONE_STYLES.good.barFill} transition-[width] duration-700 ease-out`}
					style={{ width: `${Math.min(afterScore, 100)}%` }}
				/>
			</div>
		</div>
	);
}

function AxisBadge({ label, tone }: { label: string; tone: StatusTone }) {
	const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
	return (
		<span
			className={`rounded-full border ${style.border} ${style.bg} px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.text}`}
		>
			{label}
		</span>
	);
}

/** Bottom-left card — top urgent critical deficits with business impact. */
function DeficitsCard({ deficits }: { deficits: CaseStudyDeficit[] }) {
	const rows = Array.isArray(deficits) ? deficits : [];
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				Critical Deficits & Action Taken
			</p>
			<div className="flex flex-col gap-2.5">
				{rows.length === 0 ? (
					<p className="text-xs text-slate-500">현재 리포트에서 남은 핵심 결함이 없습니다.</p>
				) : (
					rows.map((deficit, index) => {
						const style = SEVERITY_STYLES[deficit.severity] ?? SEVERITY_STYLES.medium;
						return (
							<div
								key={`${deficit.title}-${index}`}
								className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} p-3`}
							>
								<span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
									{style.icon}
								</span>
								<div className="min-w-0">
									<p className="text-sm font-semibold text-slate-100">
										<span className="mr-1.5 font-mono text-xs text-slate-500">#{index + 1}</span>
										{deficit.title}
									</p>
									<p className={`mt-0.5 text-xs leading-relaxed ${style.text}`}>
										<span className="text-slate-500">└ </span>
										{deficit.impact}
									</p>
									{deficit.resolution ? (
										<p className="mt-1.5 text-xs font-semibold text-cyan-300">
											[해결: {deficit.resolution}]
										</p>
									) : null}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

/** Bottom-right card — AI search engine (GEO) visibility status. */
function AiVisibilityCard({ engines }: { engines: CaseStudyAiEngine[] }) {
	const rows = Array.isArray(engines) ? engines : [];
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				AI Search Engine Visibility Status
			</p>
			<div className="flex flex-col gap-2.5">
				{rows.length === 0 ? (
					<p className="text-xs text-slate-500">엔진별 가시성 데이터가 아직 없습니다.</p>
				) : (
					rows.map((engine, index) => (
						<div key={`${engine.engine}-${index}`} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-sm font-bold text-slate-100">{engine.engine}</p>
								<StarRow stars={engine.stars} />
							</div>
							<p
								className={`mt-1 text-xs font-semibold ${
									engine.stars >= 4 ? 'text-emerald-400' : engine.stars === 3 ? 'text-amber-400' : 'text-rose-400'
								}`}
							>
								{engine.statusLabel}
							</p>
							<p className="mt-1 text-xs leading-relaxed text-slate-400">
								<span className="text-slate-500">└ </span>
								{engine.reason}
							</p>
						</div>
					))
				)}
			</div>
		</div>
	);
}

/**
 * 도입 사례 리포트 — dark-mode dashboard card presenting a
 * project's full Before → After SEO/GEO diagnostic story: score lift,
 * 4-axis breakdown, applied REDUE actions, and a diagnose CTA.
 */
export function CaseStudyReport({ data }: CaseStudyReportProps) {
	if (!data?.siteInfo || !data.normalizedScore) return null;
	const axes = Array.isArray(data.axes) ? data.axes : [];
	const deficits = Array.isArray(data.deficits) ? data.deficits : [];
	const engines = Array.isArray(data.aiEngines) ? data.aiEngines : [];
	const actions = Array.isArray(data.actionsTaken) ? data.actionsTaken : [];
	const extraActions = actions.filter((action) => !deficits.some((deficit) => deficit.title === action.title));

	return (
		<article className="rounded-3xl border border-emerald-500/20 bg-[#0d1117] p-5 shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)] sm:p-7">
			<div className="flex flex-col gap-6">
				<TopBar data={data} />

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<ScoreCompareHero data={data} />
					<AxisBreakdown axes={axes} hasBaseline={data.hasBaseline !== false} />
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<DeficitsCard deficits={deficits} />
					<AiVisibilityCard engines={engines} />
				</div>

				{extraActions.length > 0 ? <ActionTakenCard actions={extraActions} /> : null}

				<div className="flex flex-wrap items-center justify-between gap-3">
					{data.verifiedAt ? (
						<p className="text-[11px] text-slate-500">진단 검증일: {data.verifiedAt}</p>
					) : (
						<span />
					)}
					{data.resultHref || data.latestAuditId ? (
						<Link
							href={data.resultHref || `/audit/result?id=${encodeURIComponent(data.latestAuditId || '')}`}
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:underline"
						>
							진단 결과보기
							<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
						</Link>
					) : null}
				</div>

				<DiagnoseCtaBanner />
			</div>
		</article>
	);
}

function ActionTakenCard({ actions }: { actions: CaseStudyActionTaken[] }) {
	return (
		<section
			aria-labelledby="action-taken-title"
			className="flex flex-col gap-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-5"
		>
			<div>
				<p id="action-taken-title" className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300/85">
					적용된 REDUE AI 핵심 조치 (Action Taken)
				</p>
				<p className="mt-1 text-xs text-slate-400">스키마 주입 · 인용 소스 구조화 · E-E-A-T 보정</p>
			</div>
			<ol className="flex flex-col gap-3">
				{actions.map((action, index) => (
					<li
						key={action.title}
						className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3.5"
					>
						<span
							className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 font-mono text-[11px] font-bold text-cyan-300"
							aria-hidden="true"
						>
							{index + 1}
						</span>
						<div className="min-w-0">
							<p className="flex items-start gap-2 text-sm font-semibold text-slate-100">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2.25} aria-hidden />
								{action.title}
							</p>
							{action.detail ? (
								<p className="mt-1 text-xs leading-relaxed text-slate-400">{action.detail}</p>
							) : null}
						</div>
					</li>
				))}
			</ol>
		</section>
	);
}

function DiagnoseCtaBanner() {
	return (
		<section
			aria-labelledby="diagnose-cta-title"
			className="relative overflow-hidden rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-cyan-500/15 via-[#0d1117] to-emerald-500/15 px-5 py-6 sm:px-7"
		>
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(6,182,212,0.16),transparent_55%)]"
				aria-hidden="true"
			/>
			<div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h3 id="diagnose-cta-title" className="text-lg font-extrabold text-white sm:text-xl">
						귀사의 웹사이트도 Gemini, ChatGPT, Perplexity에 제대로 인용되고 있을까요?
					</h3>
					<p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
						REDUE AI 스키마 주입 및 GEO 진단으로 브랜드 가시성을 확보하세요.
					</p>
				</div>
				<Link
					href="/audit"
					className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition-all duration-300 hover:brightness-110"
				>
					지금 우리 사이트 무료 진단하기
					<ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
				</Link>
			</div>
		</section>
	);
}
