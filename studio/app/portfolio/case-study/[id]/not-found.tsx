import Link from 'next/link';

export default function CaseStudyNotFound() {
	return (
		<main className="flex flex-col items-center gap-4 py-16 text-center">
			<p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
				해당 도입 사례를 찾을 수 없습니다.
			</p>
			<Link href="/portfolio" className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
				도입 사례 목록으로
			</Link>
		</main>
	);
}
