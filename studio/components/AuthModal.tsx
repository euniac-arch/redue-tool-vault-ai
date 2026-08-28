'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

interface AuthModalProps {
	open: boolean;
	onClose: () => void;
	/** Feature-specific pitch shown above the CTA (e.g. "가입하고 PDF 다운로드하세요"). */
	message?: string;
}

/**
 * Smart-Lock signup funnel modal.
 * Shown when a guest taps a member-only action (PDF / email report) so the
 * click still "does something" instead of the button silently failing.
 */
export function AuthModal({ open, onClose, message }: AuthModalProps) {
	const t = useTranslations('audit.authModal');
	const [mounted, setMounted] = useState(false);
	const [callbackUrl, setCallbackUrl] = useState('/');

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (open && typeof window !== 'undefined') {
			setCallbackUrl(window.location.href);
		}
	}, [open]);

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

	const encodedCallback = encodeURIComponent(callbackUrl);

	return createPortal(
		<div
			className="print:hidden fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="auth-modal-title"
			onClick={onClose}
		>
			<div
				className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:rounded-2xl sm:p-6"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
							{t('kicker')}
						</p>
						<h2
							id="auth-modal-title"
							className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white"
						>
							{t('title')}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
						aria-label={t('close')}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<p className="mt-3 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-300">
					{message ?? t('defaultMessage')}
				</p>

				<ul className="mt-4 flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
					<li className="flex items-center gap-2">
						<span aria-hidden>📄</span> {t('benefit1')}
					</li>
					<li className="flex items-center gap-2">
						<span aria-hidden>✉️</span> {t('benefit2')}
					</li>
					<li className="flex items-center gap-2">
						<span aria-hidden>🗂️</span> {t('benefit3')}
					</li>
				</ul>

				<div className="mt-5 flex flex-col gap-2">
					<Link
						href={`/login?mode=signup&callbackUrl=${encodedCallback}`}
						className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#e0c15a] px-4 py-3 text-sm font-extrabold text-[#0B1C2C] transition hover:from-[#e0c15a] hover:to-[#eccf7a]"
					>
						<span aria-hidden>🔓</span>
						{t('signupCta')}
					</Link>
					<Link
						href={`/login?callbackUrl=${encodedCallback}`}
						className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
					>
						{t('loginCta')}
					</Link>
				</div>
			</div>
		</div>,
		document.body,
	);
}
