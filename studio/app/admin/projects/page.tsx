import { ProjectWorkspace } from '@/components/admin/projects/ProjectWorkspace';

export const dynamic = 'force-dynamic';

export default function AdminProjectsPage() {
	// TEMP: auth incomplete — open /admin/projects without login redirect
	return (
		<main className="flex flex-col gap-4">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">진단 결과 프로젝트</h1>
				<p className="mt-1 text-sm text-slate-600">진단이 완료된 프로젝트를 관리합니다.</p>
			</div>

			<ProjectWorkspace />
		</main>
	);
}
