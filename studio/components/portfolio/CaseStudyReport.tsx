import type {
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
	const style = TONE_STYLES[tone];
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
	return (
		<span className="font-mono tracking-tight text-amber-400" aria-label={`${stars}/5`}>
			{'★'.repeat(stars)}
			<span className="text-white/15">{'★'.repeat(5 - stars)}</span>
		</span>
	);
}

/** Top metadata bar: clinic name, domain, category badge, HTTPS / TTFB status. */
function TopBar({ data }: { data: CaseStudyData }) {
	const { siteInfo } = data;
	return (
		<div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="text-xl font-bold text-white">{siteInfo.name}</h2>
					<span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
						{siteInfo.category}
					</span>
				</div>
				<a
					href={siteInfo.domainUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1 inline-block font-mono text-sm text-accent-light hover:underline"
				>
					{siteInfo.domain}
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
function ScoreCompareHero({ data }: { data: CaseStudyData }) {
	const { normalizedScore, algorithmScore } = data;
	const lift = Number((normalizedScore.after.score - normalizedScore.before.score).toFixed(1));

	return (
		<div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-black/20 p-5">
			<div className="grid grid-cols-2 gap-3">
				<ScoreBand title="BEFORE" band={normalizedScore.before} />
				<ScoreBand title="AFTER" band={normalizedScore.after} highlight />
			</div>

			<div className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-4 text-center case-study-glow">
				<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
					Score Lift
				</span>
				<span className="font-mono text-3xl font-extrabold tabular-nums text-emerald-400 sm:text-4xl">
					🚀 +{lift}pt
				</span>
				<span className="text-xs font-medium text-emerald-200/70">Increase</span>
			</div>

			<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
				<span className="text-[11px] font-semibold text-slate-500">알고리즘 배점 (raw)</span>
				<span className="font-mono text-sm font-bold tabular-nums text-slate-200">
					<span className="text-slate-500">{algorithmScore.before.toFixed(1)}</span>
					<span className="mx-1.5 text-slate-600">➔</span>
					<span className="text-emerald-400">{algorithmScore.after.toFixed(1)}</span>
					<span className="text-slate-500"> /{algorithmScore.maxScore}</span>
				</span>
			</div>
		</div>
	);
}

function ScoreBand({
	title,
	band,
	highlight,
}: {
	title: string;
	band: CaseStudyData['normalizedScore']['before'];
	highlight?: boolean;
}) {
	const style = TONE_STYLES[band.tone];
	return (
		<div className={`flex flex-col gap-2 rounded-xl border ${style.border} ${style.bg} p-4`}>
			<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</span>
			<span
				className={`font-mono text-4xl font-extrabold leading-none tabular-nums ${
					highlight ? style.text : 'text-slate-300'
				}`}
			>
				{band.score}
				<span className="text-base font-semibold text-slate-500">/{band.maxScore}</span>
			</span>
			<span className={`text-xs font-semibold leading-snug ${style.text}`}>{band.label}</span>
		</div>
	);
}

/** Right hero panel — 4-axis before/after progress comparison. */
function AxisBreakdown({ axes }: { axes: CaseStudyAxis[] }) {
	return (
		<div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				4-Axis 상세 진단 비교
			</p>
			<div className="flex flex-1 flex-col justify-between gap-4">
				{axes.map((axis) => (
					<AxisRow key={axis.key} axis={axis} />
				))}
			</div>
		</div>
	);
}

function AxisRow({ axis }: { axis: CaseStudyAxis }) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<span className="text-xs font-semibold text-slate-300">{axis.label}</span>
				<span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
					<span className="text-slate-500">
						{axis.before.score}점{axis.before.raw ? ` (${axis.before.raw})` : ''}
					</span>
					{axis.before.badge ? <AxisBadge {...axis.before.badge} /> : null}
					<span className="text-slate-600">➔</span>
					<span className="font-bold text-emerald-400">
						{axis.after.score}점{axis.after.raw ? ` (${axis.after.raw})` : ''}
					</span>
					{axis.after.badge ? <AxisBadge {...axis.after.badge} /> : null}
				</span>
			</div>
			<div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-slate-500/50"
					style={{ width: `${axis.before.score}%` }}
				/>
				<div
					className={`absolute inset-y-0 left-0 rounded-full ${TONE_STYLES.good.barFill} transition-[width] duration-700 ease-out`}
					style={{ width: `${axis.after.score}%` }}
				/>
			</div>
		</div>
	);
}

function AxisBadge({ label, tone }: { label: string; tone: StatusTone }) {
	const style = TONE_STYLES[tone];
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
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				Critical Deficits & Business Impact
			</p>
			<div className="flex flex-col gap-2.5">
				{deficits.map((deficit, index) => {
					const style = SEVERITY_STYLES[deficit.severity];
					return (
						<div
							key={deficit.title}
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
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

/** Bottom-right card — AI search engine (GEO) visibility status. */
function AiVisibilityCard({ engines }: { engines: CaseStudyAiEngine[] }) {
	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
				AI Search Engine Visibility Status
			</p>
			<div className="flex flex-col gap-2.5">
				{engines.map((engine) => (
					<div key={engine.engine} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
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
				))}
			</div>
		</div>
	);
}

/**
 * Portfolio Case Study report — dark-mode dashboard card presenting a
 * project's full Before → After SEO/GEO diagnostic story: score lift,
 * 4-axis breakdown, top critical deficits, and AI engine visibility.
 */
export function CaseStudyReport({ data }: CaseStudyReportProps) {
	return (
		<article className="rounded-3xl border border-emerald-500/20 bg-[#0d1117] p-5 shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)] sm:p-7">
			<div className="flex flex-col gap-6">
				<TopBar data={data} />

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<ScoreCompareHero data={data} />
					<AxisBreakdown axes={data.axes} />
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<DeficitsCard deficits={data.deficits} />
					<AiVisibilityCard engines={data.aiEngines} />
				</div>

				{data.verifiedAt ? (
					<p className="text-[11px] text-slate-500">진단 검증일: {data.verifiedAt}</p>
				) : null}
			</div>
		</article>
	);
}
