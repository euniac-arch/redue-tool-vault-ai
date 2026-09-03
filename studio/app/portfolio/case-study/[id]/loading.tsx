export default function CaseStudyLoading() {
	return (
		<main className="flex flex-col gap-6">
			<div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1117] sm:p-7">
				<div className="h-7 w-48 rounded bg-slate-200 dark:bg-white/10" />
				<div className="mt-3 h-4 w-72 rounded bg-slate-100 dark:bg-white/5" />
				<div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5" />
					<div className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5" />
				</div>
				<p className="mt-6 text-sm text-slate-500">진단 요약 리포트를 불러오는 중입니다...</p>
			</div>
		</main>
	);
}
