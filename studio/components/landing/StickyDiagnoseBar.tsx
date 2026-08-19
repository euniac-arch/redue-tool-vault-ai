'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
	AUDIT_HERO_ID,
	AUDIT_START_AREA_ID,
	scrollToAuditForm,
} from '@/components/landing/scroll-to-audit';

function resolveDiagnoseArea(): HTMLElement | null {
	return (
		document.getElementById(AUDIT_START_AREA_ID) ?? document.getElementById(AUDIT_HERO_ID)
	);
}

/** Full-width bottom CTA — hidden until the hero diagnose form scrolls out of view. */
export function StickyDiagnoseBar() {
	const t = useTranslations('landing.story.sticky');
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		let frame = 0;

		const sync = () => {
			const area = resolveDiagnoseArea();
			if (!area) {
				setVisible(true);
				return;
			}
			const bottom = area.getBoundingClientRect().bottom;
			setVisible(bottom < 8);
		};

		const onScrollOrResize = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				sync();
			});
		};

		const area = resolveDiagnoseArea();
		if (!area) {
			const retry = window.setTimeout(sync, 80);
			window.addEventListener('scroll', onScrollOrResize, { passive: true });
			window.addEventListener('resize', onScrollOrResize);
			return () => {
				window.clearTimeout(retry);
				window.removeEventListener('scroll', onScrollOrResize);
				window.removeEventListener('resize', onScrollOrResize);
			};
		}

		sync();
		window.addEventListener('scroll', onScrollOrResize, { passive: true });
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScrollOrResize);
			window.removeEventListener('resize', onScrollOrResize);
		};
	}, []);

	if (!visible) return null;

	return (
		<div className="print:hidden fixed inset-x-0 bottom-0 z-50 w-full border-t border-cyan-500/30 bg-[#070B14]/95 shadow-[0_-8px_30px_rgba(0,0,0,0.7)] backdrop-blur-md">
			<div className="mx-auto flex max-w-[960px] flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row sm:px-6 sm:py-3.5">
				<div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-start sm:gap-3">
					<div className="flex shrink-0 items-center gap-2">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
						</span>
						<span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 font-['Pretendard',sans-serif] text-[11px] font-bold tracking-tight text-cyan-400 sm:text-xs">
							{t('badge')}
						</span>
					</div>
					<p className="min-w-0 break-keep font-['Pretendard',sans-serif] text-xs font-medium tracking-tight text-slate-200 sm:text-sm">
						{t.rich('title', {
							score: (chunks) => (
								<strong className="font-bold text-white underline decoration-cyan-400 decoration-2 underline-offset-2">
									{chunks}
								</strong>
							),
						})}
					</p>
				</div>

				<div className="flex w-full justify-end sm:w-auto">
					<button
						type="button"
						onClick={scrollToAuditForm}
						className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 font-['Pretendard',sans-serif] text-xs font-bold text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] sm:w-auto sm:text-sm"
					>
						<span>{t('button')}</span>
						<span className="text-base leading-none text-cyan-200">➔</span>
					</button>
				</div>
			</div>
		</div>
	);
}
