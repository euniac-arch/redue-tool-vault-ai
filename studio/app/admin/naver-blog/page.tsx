import { NaverBlogWorkspace } from '@/components/admin/naver-blog/NaverBlogWorkspace';

export const dynamic = 'force-dynamic';

export default function AdminNaverBlogPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
					해결 워크스페이스
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
					📝 네이버 블로그 AI 포스팅
				</h1>
				<p className="mt-1 text-sm text-slate-600">
					진단 프로젝트 데이터를 바탕으로 네이버 블로그 원고와 GEO FAQ를 생성·편집·발행합니다.
				</p>
			</div>

			<NaverBlogWorkspace />
		</main>
	);
}
