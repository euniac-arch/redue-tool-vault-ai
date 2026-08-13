import { CrawlingSetupWorkspace } from '@/components/admin/crawling/CrawlingSetupWorkspace';

export default function AdminCrawlingSetupPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
					사이트 크롤링 관리
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
					크롤링 실행 / 설정
				</h1>
				<p className="mt-1 text-sm text-slate-600">
					타겟 자동 발굴·단일 수집과 엑셀 대량 등록을 한곳에서 관리하고, 정밀 진단 리스트로
					이관합니다.
				</p>
			</div>

			<CrawlingSetupWorkspace />
		</main>
	);
}
