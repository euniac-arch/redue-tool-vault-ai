import { CollectedDataList } from '@/components/admin/crawling/CollectedDataList';

export default function AdminCrawlingListPage() {
	return (
		<div className="flex w-full min-w-0 flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
					사이트 크롤링 관리
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
					수집된 데이터 리스트
				</h1>
				<p className="mt-1 text-sm text-slate-600">
					크롤링으로 수집된 페이지·콘텐츠를 국가·지역·업종으로 세분화 필터링하고 조회·관리합니다.
				</p>
			</div>

			<CollectedDataList />
		</div>
	);
}
