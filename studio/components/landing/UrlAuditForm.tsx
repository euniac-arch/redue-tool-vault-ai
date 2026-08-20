'use client';

import { useEffect, useState } from 'react';
import { AUDIT_URL_INPUT_ID } from '@/components/landing/scroll-to-audit';
import { useAuditLaunch } from '@/components/landing/use-audit-launch';
import { useAuditQuota } from '@/components/landing/use-audit-quota';
import { AuditLimitModal } from '@/components/audit/AuditLimitModal';
import { useTranslations } from 'next-intl';

type UrlAuditFormProps = {
	initialUrl?: string;
	extraQuery?: Record<string, string>;
	autoSubmit?: boolean;
	variant?: 'hero' | 'cta' | 'sticky' | 'final';
	inputId?: string;
	buttonLabel?: string;
	placeholder?: string;
};

export function UrlAuditForm({
	initialUrl,
	extraQuery,
	autoSubmit,
	variant = 'hero',
	inputId,
	buttonLabel,
	placeholder,
}: UrlAuditFormProps) {
	const { url, setUrl, submitting, error, setError, handleDiagnose, t } = useAuditLaunch({
		initialUrl,
		extraQuery,
		autoSubmit: false,
	});
	const tQuota = useTranslations('audit.quota');
	const { quota, ready, refresh } = useAuditQuota();
	const [limitOpen, setLimitOpen] = useState(false);
	const [autoStarted, setAutoStarted] = useState(false);

	useEffect(() => {
		if (!autoSubmit || !ready || autoStarted) return;
		setAutoStarted(true);
		if (quota.exhausted && !quota.unlimited) {
			setLimitOpen(true);
			return;
		}
		handleDiagnose(url);
	}, [autoSubmit, ready, autoStarted, quota.exhausted, quota.unlimited, handleDiagnose, url]);

	const exhausted = quota.exhausted && !quota.unlimited;
	const isHero = variant === 'hero';
	const isSticky = variant === 'sticky';
	const isFinal = variant === 'final';

	function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (exhausted) {
			setLimitOpen(true);
			return;
		}
		void refresh().then((next) => {
			if (next.exhausted && !next.unlimited) {
				setLimitOpen(true);
				return;
			}
			handleDiagnose(url);
		});
	}

	return (
		<div
			className={
				isFinal
					? 'mx-auto mt-6 w-full max-w-[560px]'
					: isHero
						? 'mx-auto w-full max-w-[580px]'
						: isSticky
							? 'w-full'
							: 'mx-auto mt-6 flex w-full max-w-xl flex-col'
			}
		>
			{quota.devMode ? (
				<p className="mb-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
					{tQuota('devUnlimitedBadge')}
				</p>
			) : !quota.unlimited ? (
				<p
					className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
						exhausted
							? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
							: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200'
					}`}
				>
					{tQuota('remainingBadge', { remaining: quota.remaining, limit: quota.limit })}
				</p>
			) : null}

			<form
				onSubmit={onSubmit}
				className={
					isFinal
						? 'flex w-full flex-col items-stretch gap-2.5 sm:flex-row'
						: isHero
							? 'flex w-full flex-col items-stretch gap-2.5 rounded-2xl border border-cyan-500/30 bg-white p-1.5 shadow-inner dark:border-cyan-500/40 dark:bg-slate-950/90 sm:flex-row sm:p-2'
							: 'flex w-full flex-col gap-2 sm:flex-row sm:items-stretch'
				}
			>
				{isHero ? (
					<div className="relative flex flex-1 items-center">
						<span className="pl-3.5 text-sm text-slate-400 dark:text-slate-500" aria-hidden>
							🌐
						</span>
						<input
							id={inputId ?? AUDIT_URL_INPUT_ID}
							type="text"
							required
							value={url}
							aria-label={placeholder ?? t('placeholder')}
							onChange={(event) => {
								setUrl(event.target.value);
								if (error) setError(null);
							}}
							placeholder={placeholder ?? t('placeholder')}
							readOnly={autoSubmit && submitting}
							disabled={exhausted}
							className="w-full bg-transparent px-3 py-3 font-['Pretendard',sans-serif] text-sm tracking-tight text-slate-900 placeholder-slate-400 outline-none disabled:opacity-60 dark:text-white dark:placeholder-slate-500"
						/>
					</div>
				) : (
					<input
						id={inputId}
						type="text"
						required
						value={url}
						aria-label={placeholder ?? t('placeholder')}
						onChange={(event) => {
							setUrl(event.target.value);
							if (error) setError(null);
						}}
						placeholder={placeholder ?? t('placeholder')}
						readOnly={autoSubmit && submitting}
						disabled={exhausted}
						className={
							isFinal
								? 'flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-cyan-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/90 dark:text-white dark:placeholder-slate-500 dark:focus:border-cyan-400'
								: isSticky
									? 'landing-input py-2.5 disabled:opacity-60'
									: 'landing-input disabled:opacity-60'
						}
					/>
				)}
				<button
					type="submit"
					disabled={submitting || exhausted}
					className={
						isFinal
							? 'whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
							: isHero
								? "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 font-['Pretendard',sans-serif] text-sm font-bold tracking-tight text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
								: isSticky
									? 'whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
									: 'landing-btn-purple disabled:cursor-not-allowed'
					}
				>
					<span>
						{exhausted ? tQuota('buttonExhausted') : submitting ? t('buttonLoading') : buttonLabel ?? t('button')}
					</span>
					{isHero && !submitting && !exhausted ? <span className="text-cyan-200">➔</span> : null}
				</button>
			</form>
			{error ? (
				<p
					role="alert"
					className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
				>
					{error}
				</p>
			) : null}
			<AuditLimitModal open={limitOpen} onClose={() => setLimitOpen(false)} />
		</div>
	);
}
