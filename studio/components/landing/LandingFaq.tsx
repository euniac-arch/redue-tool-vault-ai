'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ITEMS = ['renewal', 'timing', 'builder', 'rank', 'diff'] as const;

export function LandingFaq() {
	const t = useTranslations('landing.story.faq');
	const [open, setOpen] = useState<string>('renewal');

	return (
		<section id="faq" className="mt-20 scroll-mt-24 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-400">
						{t('badge')}
					</p>
					<h2 className="mt-3">
						<span className="block font-mono text-xs uppercase tracking-widest text-slate-400">{t('kicker')}</span>
						<span className="mt-1 block text-2xl font-extrabold leading-snug text-white sm:text-3xl">
							{t('title')}
						</span>
					</h2>
					<p className="mx-auto mt-2 max-w-[600px] break-keep text-sm leading-relaxed text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<ul className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1120]">
					{ITEMS.map((key) => {
						const expanded = open === key;
						return (
							<li key={key} className="border-b border-slate-800 last:border-b-0">
								<button
									type="button"
									aria-expanded={expanded}
									onClick={() => setOpen(expanded ? '' : key)}
									className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
								>
									<span className="break-keep text-[15px] font-bold leading-snug text-slate-100">
										{t(`items.${key}.q`)}
									</span>
									<ChevronDown
										className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${
											expanded ? 'rotate-180 text-cyan-300' : ''
										}`}
									/>
								</button>
								<div
									className={`grid transition-all duration-300 ${
										expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
									}`}
								>
									<div className="overflow-hidden">
										<p className="break-keep px-5 pb-4 text-[13px] leading-relaxed text-slate-400">
											{t(`items.${key}.a`)}
										</p>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
