import { notFound } from 'next/navigation';
import { CaseStudyReport } from '@/components/portfolio/CaseStudyReport';
import { CASE_STUDIES, getCaseStudyById } from '@/lib/case-studies';

export function generateStaticParams() {
	return CASE_STUDIES.map((item) => ({ id: item.id }));
}

export default function CaseStudyPage({ params }: { params: { id: string } }) {
	const data = getCaseStudyById(params.id);
	if (!data) notFound();

	return (
		<main className="flex flex-col gap-6">
			<section>
				<h1 className="text-2xl font-bold text-slate-900 dark:text-white">REDUE AI SEO & GEO Engine — 진단 케이스 스터디</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					실제 진단 데이터 기반 Before → After 리포트입니다.
				</p>
			</section>

			<CaseStudyReport data={data} />
		</main>
	);
}
