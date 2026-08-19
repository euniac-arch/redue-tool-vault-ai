import { ContactInquiryForm } from '@/components/ContactInquiryForm';

export default function ContactPage() {
	return (
		<main className="flex flex-col gap-8">
			<section>
				<span className="rounded-md border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-cyan-400">
					Contact
				</span>
				<h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">작업 문의</h1>
				<p className="mt-2 whitespace-nowrap text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">
					진단 이후 GEO·SEO 개선 작업, 스키마 설계, 컨설팅이 필요하시면 문의를 남겨 주세요. 접수 후 1영업일 이내에 회신드립니다.
				</p>
			</section>

			<ContactInquiryForm />
		</main>
	);
}
