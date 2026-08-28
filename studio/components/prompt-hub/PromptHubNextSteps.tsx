import Link from 'next/link';

const STEPS = [
	{ href: '/audit', kicker: '문제를 찾는다', label: '진단 엔진' },
	{ href: '/strategy', kicker: '전략을 만든다', label: '검색 전략 설계' },
	{ href: '/contact', kicker: 'REDUE에 맡긴다', label: '작업 문의' },
] as const;

export function PromptHubNextSteps({ compact = false }: { compact?: boolean }) {
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1f3a5a] dark:bg-[#0b1726] sm:p-5">
			<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400">
				Next in REDUE
			</p>
			<h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
				프롬프트 허브는 범용 AI 활용법입니다
			</h2>
			<p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
				특정 사이트의 작업안(Title, H1, Schema 초안)은 Execution Blueprint에서 다룹니다. 사이트 문제를 찾은 뒤
				검색 전략과 실행 순서로 이어지세요.
			</p>
			<div className={`mt-4 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
				{STEPS.map((step) => (
					<Link
						key={step.href}
						href={step.href}
						className="rounded-xl border border-slate-200 px-3 py-3 transition hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-slate-700 dark:hover:border-cyan-500/40 dark:hover:bg-[#13233a]/60"
					>
						<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{step.kicker}</p>
						<p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">{step.label} →</p>
					</Link>
				))}
			</div>
		</section>
	);
}

export function PromptHubRoleMap() {
	const roles = [
		{ href: '/insights?tab=aeo-geo', learn: '배운다', label: 'AEO · GEO 가이드' },
		{ href: '/insights?tab=ai-hub', learn: '도구를 찾는다', label: '글로벌 AI 도구' },
		{ href: '/insights?tab=prompts', learn: 'AI를 활용한다', label: 'AI 프롬프트 허브' },
		{ href: '/insights?tab=insights', learn: '동향을 본다', label: '인사이트 칼럼' },
	] as const;

	return (
		<nav
			aria-label="인사이트 & AI 허브 역할"
			className="grid grid-cols-2 gap-2 sm:grid-cols-4"
		>
			{roles.map((role) => (
				<Link
					key={role.href}
					href={role.href}
					className={`rounded-xl border px-3 py-2.5 transition hover:border-cyan-300 dark:hover:border-cyan-500/40 ${
						role.href.includes('tab=prompts')
							? 'border-cyan-300 bg-cyan-50/80 dark:border-cyan-600/40 dark:bg-[#13233a]'
							: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50'
					}`}
				>
					<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{role.learn}</p>
					<p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">{role.label}</p>
				</Link>
			))}
		</nav>
	);
}
