'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Globe } from 'lucide-react';
import { AUDIT_URL_INPUT_ID } from '@/components/landing/scroll-to-audit';
import { useAuditLaunch } from '@/components/landing/use-audit-launch';
import { useAuditQuota } from '@/components/landing/use-audit-quota';
import { AuditLimitModal } from '@/components/audit/AuditLimitModal';
import { useTranslations } from 'next-intl';

type UrlAuditFormProps = {
	initialUrl?: string;
	extraQuery?: Record<string, string>;
	autoSubmit?: boolean;
	variant?: 'hero' | 'cta' | 'sticky' | 'final' | 'engine';
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
	const { data: session } = useSession();
	const signedIn = Boolean(session?.user?.id);
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
	const isEngine = variant === 'engine';
	const isSticky = variant === 'sticky';
	const isFinal = variant === 'final';
	const isWideField = isHero || isEngine;

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
					: isEngine
						? 'mx-auto w-full'
						: isWideField
							? 'mx-auto w-full max-w-[580px]'
							: isSticky
								? 'w-full'
								: 'mx-auto mt-6 flex w-full max-w-xl flex-col'
			}
		>
			{!quota.unlimited ? (
				<div className={isEngine ? 'mb-4 flex justify-center' : 'mb-2'}>
					<p
						className={`inline-flex items-center rounded-full border text-xs ${
							isEngine
								? 'border-slate-200/30 bg-slate-100 px-3 py-1 text-slate-500 dark:border-white/30 dark:bg-slate-800/80 dark:text-slate-300'
								: exhausted
									? 'border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300'
									: 'border-slate-200/30 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 dark:border-white/30 dark:bg-cyan-500/15 dark:text-cyan-200'
						}`}
					>
						{signedIn
							? tQuota('remainingBadge', { remaining: quota.remaining, limit: quota.limit })
							: tQuota('guestRemainingBadge', { remaining: quota.remaining, limit: quota.limit })}
					</p>
				</div>
			) : null}

			<form
				onSubmit={onSubmit}
				className={
					isFinal
						? 'flex w-full flex-col items-stretch gap-2.5 sm:flex-row'
						: isEngine
							? 'flex w-full flex-col items-stretch gap-2.5 sm:flex-row'
							: isHero
								? 'flex w-full flex-col items-stretch gap-2.5 rounded-2xl border border-cyan-500/30 bg-white p-1.5 shadow-inner dark:border-cyan-500/40 dark:bg-slate-950/90 sm:flex-row sm:p-2'
								: 'flex w-full flex-col gap-2 sm:flex-row sm:items-stretch'
				}
			>
				{isWideField ? (
					<div className="relative flex flex-1 items-center">
						{isEngine ? (
							<Globe
								className="pointer-events-none absolute left-4 h-4 w-4 text-slate-400"
								aria-hidden
							/>
						) : (
							<span className="pl-3.5 text-sm text-slate-400 dark:text-zinc-500" aria-hidden>
								🌐
							</span>
						)}
						<input
							id={inputId ?? AUDIT_URL_INPUT_ID}
							type="text"
							required={!exhausted}
							value={url}
							aria-label={placeholder ?? t('placeholder')}
							onChange={(event) => {
								setUrl(event.target.value);
								if (error) setError(null);
							}}
							placeholder={placeholder ?? t('placeholder')}
							readOnly={autoSubmit && submitting}
							className={
								isEngine
									? 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pl-11 text-sm tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-60 dark:border-slate-700/80 dark:bg-[#070d1a] dark:text-white dark:placeholder:text-slate-500'
									: "w-full bg-transparent px-3 py-3 font-['Pretendard',sans-serif] text-sm tracking-tight text-slate-900 placeholder-slate-400 outline-none disabled:opacity-60 dark:text-white dark:placeholder-zinc-500"
							}
						/>
					</div>
				) : (
					<input
						id={inputId}
						type="text"
						required={!exhausted}
						value={url}
						aria-label={placeholder ?? t('placeholder')}
						onChange={(event) => {
							setUrl(event.target.value);
							if (error) setError(null);
						}}
						placeholder={placeholder ?? t('placeholder')}
						readOnly={autoSubmit && submitting}
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
					disabled={submitting}
					className={
						isFinal
							? 'whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:text-base'
							: isEngine
								? exhausted
									? 'inline-flex cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-slate-200 px-6 py-3.5 text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
									: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
								: isHero
									? "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 font-['Pretendard',sans-serif] text-sm font-bold tracking-tight text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:text-base"
									: isSticky
										? 'whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
										: 'landing-btn-purple disabled:cursor-not-allowed'
					}
				>
					<span>
						{exhausted
							? signedIn
								? tQuota('buttonExhausted')
								: tQuota('guestButtonExhausted')
							: submitting
								? t('buttonLoading')
								: buttonLabel ?? t('button')}
					</span>
					{(isHero || isEngine) && !submitting && !exhausted ? (
						<span className="text-white/70">➔</span>
					) : null}
				</button>
			</form>
			{isEngine && submitting ? (
				<div className="mt-3 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-slate-400">
					{t('buttonLoading')}
				</div>
			) : null}
			{error ? (
				<p
					role="alert"
					className={`mt-3 rounded-lg px-3 py-2 text-sm ${
						isEngine
							? 'border border-rose-500/20 bg-rose-500/10 text-rose-300'
							: 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
					}`}
				>
					{error}
				</p>
			) : null}
			<AuditLimitModal open={limitOpen} onClose={() => setLimitOpen(false)} />
		</div>
	);
}
