import { ContactInquiryForm } from '@/components/ContactInquiryForm';

export default function ContactPage() {
	return (
		<main className="flex flex-col gap-8">
			<section>
				<span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent dark:text-accent-light">
					Contact
				</span>
				<h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">작업 문의</h1>
				<p className="mt-2 whitespace-nowrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
					진단 이후 GEO·SEO 개선 작업, 스키마 설계, 컨설팅이 필요하시면 문의를 남겨 주세요. 접수 후 1영업일 이내에 회신드립니다.
				</p>
			</section>

			<ContactInquiryForm />
		</main>
	);
}
