'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Wrench, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ContactInquiryForm } from '@/components/ContactInquiryForm';

interface ExpertAgencyCtaProps {
	targetUrl: string;
	brandName: string;
	targetQuery?: string;
}

function consultHref(): string {
	const kakao = process.env.NEXT_PUBLIC_KAKAO_CONSULT_URL?.trim();
	if (kakao) return kakao;
	return '/contact';
}

export function ExpertAgencyCta({ targetUrl, brandName, targetQuery }: ExpertAgencyCtaProps) {
	const t = useTranslations('audit.businessConversion');
	const [open, setOpen] = useState(false);
	const href = consultHref();
	const external = /^https?:\/\//i.test(href);

	const defaultMessage = [
		t('inquiryPrefillLead', { brand: brandName, url: targetUrl }),
		targetQuery ? t('inquiryPrefillKeyword', { keyword: targetQuery }) : '',
		t('inquiryPrefillAsk'),
	]
		.filter(Boolean)
		.join('\n');

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open]);

	return (
		<div className="flex w-full flex-col rounded-xl border border-cyan-400/25 bg-gradient-to-br from-[#0B1C2C] via-[#0F172A] to-[#052016] p-4 text-white">
			<div className="w-full min-w-0">
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">{t('ctaKicker')}</p>
				<p className="mt-1 text-sm font-semibold leading-relaxed text-slate-100">{t('ctaGuarantee')}</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="h-full min-h-[48px] flex flex-col items-center justify-center text-center whitespace-normal rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-extrabold leading-tight text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
				>
					<span className="inline-flex items-center justify-center gap-2">
						<Wrench className="h-4 w-4 shrink-0" aria-hidden />
						{t('ctaPatchLine1')}
					</span>
					<span>{t('ctaPatchLine2')}</span>
				</button>
				<a
					href={href}
					target={external ? '_blank' : undefined}
					rel={external ? 'noopener noreferrer' : undefined}
					className="h-full min-h-[48px] flex items-center justify-center text-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/10"
				>
					<MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
					{t('ctaConsult')}
				</a>
			</div>

			{open && typeof document !== 'undefined'
				? createPortal(
						<div
							className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
							role="dialog"
							aria-modal="true"
							aria-labelledby="expert-patch-inquiry-title"
							onClick={() => setOpen(false)}
						>
							<div
								className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[90vh] sm:rounded-2xl"
								onClick={(event) => event.stopPropagation()}
							>
								<div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10 md:px-5">
									<div className="min-w-0">
										<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
											{t('ctaKicker')}
										</p>
										<h2
											id="expert-patch-inquiry-title"
											className="mt-1 text-base font-extrabold text-slate-900 dark:text-white md:text-lg"
										>
											{t('inquiryTitle')}
										</h2>
									</div>
									<button
										type="button"
										onClick={() => setOpen(false)}
										className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
										aria-label={t('inquiryClose')}
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="overflow-y-auto p-4 md:p-5">
									<ContactInquiryForm
										variant="embedded"
										defaults={{
											company: brandName,
											pageUrl: targetUrl,
											inquiryType: 'geo',
											message: defaultMessage,
										}}
										onSubmitted={() => setOpen(false)}
									/>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</div>
	);
}
