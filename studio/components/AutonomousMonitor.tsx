'use client';

import { useCallback, useEffect, useState } from 'react';

interface AgentStats {
	schemasAutoUpdated: number;
	algorithmUpToDatePercent: number;
	autoRollbacks: number;
	sitesMonitored: number;
	lastCronAt: string | null;
	lastCronDurationMs: number | null;
}

interface TimelineEvent {
	id: string;
	siteId: string | null;
	domain: string | null;
	kind: string;
	message: string;
	schemaType?: string | null;
	success: boolean;
	createdAt: string;
}

interface StatusPayload {
	role: 'admin' | 'user';
	stats: AgentStats;
	timeline: TimelineEvent[];
	adminAlerts: string[];
}

const KIND_STYLE: Record<string, string> = {
	scan: 'border-cyan-400/40 text-cyan-300',
	change_detected: 'border-amber-400/40 text-amber-300',
	schema_regen: 'border-violet-400/40 text-violet-300',
	inject: 'border-emerald-400/40 text-emerald-300',
	rollback: 'border-rose-400/40 text-rose-300',
	notify: 'border-sky-400/40 text-sky-300',
	error: 'border-rose-400/40 text-rose-300',
	ok: 'border-white/20 text-slate-300',
};

interface AutonomousMonitorProps {
	/** When true, show "Run cron now" for admins. */
	allowManualCron?: boolean;
	compact?: boolean;
}

export function AutonomousMonitor({ allowManualCron = false, compact = false }: AutonomousMonitorProps) {
	const [data, setData] = useState<StatusPayload | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [cronMsg, setCronMsg] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/agent/status');
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? '상태를 불러오지 못했습니다.');
			setData(json as StatusPayload);
			setError(null);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		const id = setInterval(() => void load(), 8000);
		return () => clearInterval(id);
	}, [load]);

	async function runCron() {
		setRunning(true);
		setCronMsg(null);
		try {
			const res = await fetch('/api/agent/cron', { method: 'POST' });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Cron 실행 실패');
			setCronMsg(
				`Cron OK — schemas ${json.schemasUpdated}, rollbacks ${json.rollbacks}, ${json.durationMs}ms`
			);
			await load();
		} catch (err) {
			setCronMsg((err as Error).message);
		} finally {
			setRunning(false);
		}
	}

	if (loading && !data) {
		return <p className="text-sm text-slate-500">자율 운영 상태를 불러오는 중...</p>;
	}

	if (error && !data) {
		return <p className="text-sm text-rose-400">{error}</p>;
	}

	if (!data) return null;

	const { stats, timeline, adminAlerts } = data;

	return (
		<div className="flex flex-col gap-6">
			<section
				className={`relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#0a1218] via-[#0C0D0E] to-[#061018] ${
					compact ? 'p-5' : 'p-7'
				}`}
			>
				<div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
				<div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-64 bg-cyan-500/5 blur-2xl" />
				<div className="relative flex flex-wrap items-start justify-between gap-4">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
								Self-Healing
							</span>
							<span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
								<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
								AGENT LIVE
							</span>
						</div>
						<h2 className={`mt-3 font-extrabold text-white ${compact ? 'text-xl' : 'text-2xl'}`}>
							AI 자율 운영 현황
						</h2>
						<p className="mt-1 text-xs text-slate-400">
							검색엔진 알고리즘 변동에 대응하는 Autonomous Webmaster Agent
							{stats.lastCronAt
								? ` · 최근 크론 ${new Date(stats.lastCronAt).toLocaleString('ko-KR')}`
								: ' · 아직 크론 미실행'}
						</p>
					</div>
					{allowManualCron && data.role === 'admin' && (
						<button
							type="button"
							onClick={() => void runCron()}
							disabled={running}
							className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-xs font-bold text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:bg-cyan-400/25 disabled:opacity-50"
						>
							{running ? '실행 중...' : '지금 Self-Healing 실행'}
						</button>
					)}
				</div>
				{cronMsg && <p className="relative mt-3 text-xs text-cyan-300/90">{cronMsg}</p>}
			</section>

			<section className="grid gap-3 sm:grid-cols-3">
				<Metric
					label="자동 갱신 완료된 스키마 수"
					value={`${stats.schemasAutoUpdated}`}
					hint="SoftwareApplication · Article · LocalBusiness"
				/>
				<Metric
					label="알고리즘 대응 상태"
					value={`${stats.algorithmUpToDatePercent}%`}
					hint="Up-to-date"
					accent
				/>
				<Metric
					label="자동 롤백"
					value={`${stats.autoRollbacks}건`}
					hint={`모니터링 ${stats.sitesMonitored}개 사이트`}
				/>
			</section>

			{adminAlerts.length > 0 && (
				<section className="rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-4">
					<p className="text-xs font-bold uppercase tracking-wide text-rose-300">Admin Alerts</p>
					<ul className="mt-2 flex flex-col gap-1">
						{adminAlerts.slice(0, 5).map((alert) => (
							<li key={alert} className="font-mono text-[11px] text-rose-200/90">
								{alert}
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-bold text-white">자율 에이전트 작업 타임라인</h3>
					<span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
						{timeline.length} events
					</span>
				</div>
				<ol className="relative flex flex-col gap-0 border-l border-cyan-400/20 pl-4">
					{timeline.length === 0 ? (
						<li className="text-xs text-slate-500">아직 실행 로그가 없습니다. 크론을 실행해 보세요.</li>
					) : (
						timeline.map((event) => (
							<li key={event.id} className="relative pb-4">
								<span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-cyan-300/60 bg-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
											KIND_STYLE[event.kind] ?? KIND_STYLE.ok
										}`}
									>
										{event.kind}
									</span>
									{event.domain && (
										<span className="font-mono text-[11px] text-slate-400">{event.domain}</span>
									)}
									<span className="text-[10px] text-slate-600">
										{new Date(event.createdAt).toLocaleString('ko-KR')}
									</span>
								</div>
								<p className={`mt-1 text-xs leading-relaxed ${event.success ? 'text-slate-300' : 'text-rose-300'}`}>
									{event.message}
								</p>
							</li>
						))
					)}
				</ol>
			</section>
		</div>
	);
}

function Metric({
	label,
	value,
	hint,
	accent,
}: {
	label: string;
	value: string;
	hint: string;
	accent?: boolean;
}) {
	return (
		<div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5 shadow-[inset_0_0_30px_rgba(34,211,238,0.04)]">
			<p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
			<p className={`mt-2 text-2xl font-extrabold ${accent ? 'text-cyan-300' : 'text-white'}`}>{value}</p>
			<p className="mt-1 text-[11px] text-slate-500">{hint}</p>
		</div>
	);
}
