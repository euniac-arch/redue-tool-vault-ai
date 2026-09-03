'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ASI_CARD, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';

export const ASI_SYSTEM_QUESTIONS = [
	{ id: 'now', href: '/intelligence' },
	{ id: 'changed', href: '/intelligence#asi-changed' },
	{ id: 'why', href: '/intelligence/evidence-explorer' },
	{ id: 'who', href: '/intelligence/competitor-gap' },
	{ id: 'do', href: '/intelligence/next-best-action' },
	{ id: 'worked', href: '/intelligence/visibility-monitor' },
] as const;

export type AsiSystemQuestionId = (typeof ASI_SYSTEM_QUESTIONS)[number]['id'];

export function AsiSystemQuestion({
	question,
	answer,
}: {
	question: AsiSystemQuestionId;
	answer?: string | null;
}) {
	const t = useTranslations('intelligence.system');

	return (
		<section className={`${ASI_CARD} px-4 py-4`}>
			<p className={ASI_SECTION_KICKER}>{t('questionKicker')}</p>
			<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t(`questions.${question}`)}</h2>
			{answer ? <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{answer}</p> : null}
			<ol className="mt-3 flex flex-wrap gap-1.5">
				{ASI_SYSTEM_QUESTIONS.map((item, index) => (
					<li key={item.id}>
						<Link
							href={item.href}
							className={asiFocusRing(
								`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
									item.id === question
										? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
										: 'border-slate-200 text-slate-500 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-400'
								}`,
							)}
						>
							{index + 1}. {t(`short.${item.id}`)}
						</Link>
					</li>
				))}
			</ol>
		</section>
	);
}
