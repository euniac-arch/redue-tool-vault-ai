'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const STAR_COUNT = 5;

/** Customer story carousel + press/partner logo grid. */
export function SocialProofSection() {
	const t = useTranslations('landing.stories');
	const press = useTranslations('landing.press');
	const [index, setIndex] = useState(0);
	const total = 1;

	return (
		<section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
			<article className={LANDING_CARD}>
				<h2 className="mb-4 text-base font-bold text-white">{t('title')}</h2>
				<div className="relative rounded-xl border border-[#1E2640] bg-[#080B11]/60 px-10 py-5">
					<button
						type="button"
						aria-label={t('prev')}
						onClick={() => setIndex((prev) => (prev - 1 + total) % total)}
						className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#1E2640] text-[#94A3B8] transition hover:text-white"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<blockquote>
						<p className="text-sm leading-relaxed text-[#CBD5E1]">
							{t('quoteLine1')}
							<br />
							{t('quoteLine2')}
						</p>
						<p className="mt-2 text-base tracking-wide text-[#FBBF24]" aria-label="5">
							{'★'.repeat(STAR_COUNT)}
						</p>
						<footer className="mt-2 text-xs text-[#64748B]">{t('author')}</footer>
					</blockquote>
					<button
						type="button"
						aria-label={t('next')}
						onClick={() => setIndex((prev) => (prev + 1) % total)}
						className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#1E2640] text-[#94A3B8] transition hover:text-white"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
				<span className="sr-only">{index + 1}</span>
			</article>

			<article className={LANDING_CARD}>
				<h2 className="mb-4 text-base font-bold text-white">{press('title')}</h2>
				<div className="flex flex-col items-center justify-center gap-6 py-4">
					<div className="flex flex-wrap items-center justify-center gap-8">
						<span className="text-xl font-extrabold tracking-tight text-[#03C75A]">NAVER</span>
						<GoogleWordmark />
						<MicrosoftWordmark />
					</div>
					<span className="text-xl font-semibold tracking-tight text-[#FEE500]">kakao</span>
				</div>
			</article>
		</section>
	);
}

function GoogleWordmark() {
	return (
		<span className="text-xl font-medium tracking-tight" aria-label="Google">
			<span className="text-[#4285F4]">G</span>
			<span className="text-[#EA4335]">o</span>
			<span className="text-[#FBBC05]">o</span>
			<span className="text-[#4285F4]">g</span>
			<span className="text-[#34A853]">l</span>
			<span className="text-[#EA4335]">e</span>
		</span>
	);
}

function MicrosoftWordmark() {
	return (
		<span className="inline-flex items-center gap-2" aria-label="Microsoft">
			<span className="grid h-4 w-4 grid-cols-2 gap-px" aria-hidden>
				<span className="bg-[#F25022]" />
				<span className="bg-[#7FBA00]" />
				<span className="bg-[#00A4EF]" />
				<span className="bg-[#FFB900]" />
			</span>
			<span className="text-[15px] font-semibold text-[#CBD5E1]">Microsoft</span>
		</span>
	);
}
