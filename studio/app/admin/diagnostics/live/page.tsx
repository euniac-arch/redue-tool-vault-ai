import { LiveDiagnosticWorkbench } from '@/components/admin/diagnostics/live/LiveDiagnosticWorkbench';

export const dynamic = 'force-dynamic';

export default function AdminLiveDiagnosticPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
					Live URL Diagnostic
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					실시간 URL 진단 실행
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					URL을 입력하면 사이트를 스캔하고 GEO 점수와 처방 JSON-LD 스키마를 실시간으로 도출합니다.
				</p>
			</div>
			<LiveDiagnosticWorkbench />
		</main>
	);
}
