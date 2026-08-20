'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { PricingModal } from '@/components/PricingModal';

interface AuditLimitModalProps {
	open: boolean;
	onClose: () => void;
}

export function AuditLimitModal({ open, onClose }: AuditLimitModalProps) {
	const t = useTranslations('audit.quota');
	const { data: session } = useSession();
	const [mounted, setMounted] = useState(false);
	const [pricingOpen, setPricingOpen] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = prev;
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [open, onClose]);

	if (!mounted || !open) return null;

	const signedIn = Boolean(session?.user?.id);

	return createPortal(
		<>
			<div
				className="print:hidden fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
				role="dialog"
				aria-modal="true"
				aria-labelledby="audit-limit-title"
				onClick={onClose}
			>
				<div
					className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:rounded-2xl sm:p-6"
					onClick={(event) => event.stopPropagation()}
				>
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-500">
								{t('kicker')}
							</p>
							<h2 id="audit-limit-title" className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
								{t('modalTitle')}
							</h2>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
							aria-label={t('modalClose')}
						>
							<X className="h-4 w-4" />
						</button>
					</div>
					<p className="mt-3 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">
						{t('modalBody')}
					</p>
					<div className="mt-5 flex flex-col gap-2">
						{signedIn ? (
							<button
								type="button"
								onClick={() => setPricingOpen(true)}
								className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white"
							>
								{t('modalUpgrade')}
							</button>
						) : (
							<Link
								href="/login?callbackUrl=/"
								className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white"
							>
								{t('modalLogin')}
							</Link>
						)}
						<Link
							href="/contact"
							className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
						>
							{t('modalContact')}
						</Link>
					</div>
				</div>
			</div>
			<PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
		</>,
		document.body,
	);
}
