import { DiagnosticsDashboard } from '@/components/admin/diagnostics/DiagnosticsDashboard';

export const dynamic = 'force-dynamic';

export default function AdminDiagnosticsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
					Diagnostic History
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					진단 이력 및 리포트 조회
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					사이트별 GEO 진단 이력과 처방 리포트를 검색하고, 상세 결과를 슬라이드 패널에서 확인합니다.
				</p>
			</div>
			<DiagnosticsDashboard />
		</main>
	);
}
