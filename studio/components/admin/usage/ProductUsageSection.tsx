import type { ProductUsageRow } from '@/lib/admin/api-quota';

export function ProductUsageSection({ rows }: { rows: ProductUsageRow[] }) {
	if (rows.length === 0) {
		return (
			<section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
				오늘 집계된 상품 API 사용량이 없습니다.
			</section>
		);
	}

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="mb-4">
				<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">회원 / 비회원 일일 쿼터</h2>
				<p className="mt-0.5 text-[11px] text-slate-500">AI 리서치 · 유튜브 검색 · 진단 API</p>
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				{rows.map((row) => (
					<article key={row.service} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
						<p className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.label}</p>
						<dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
							<div className="flex justify-between gap-2">
								<dt>회원</dt>
								<dd>
									{row.memberDaily} / {row.memberLimit} · 잔여 {row.memberRemaining}
								</dd>
							</div>
							<div className="flex justify-between gap-2">
								<dt>비회원</dt>
								<dd>
									{row.guestDaily} / {row.guestLimit} · 잔여 {row.guestRemaining}
								</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}
