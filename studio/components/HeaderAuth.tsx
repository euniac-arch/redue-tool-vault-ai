'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { PricingModal } from './PricingModal';

interface MeResponse {
	authenticated: boolean;
	planId?: string;
	creditsRemaining?: number;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	role?: string;
}

const PLAN_LABEL: Record<string, string> = {
	starter: 'Starter',
	pro: 'Pro',
	agency: 'Agency',
};

interface HeaderAuthProps {
	variant?: 'dark' | 'light';
	stacked?: boolean;
	onNavigate?: () => void;
}

export function HeaderAuth({ variant = 'dark', stacked = false, onNavigate }: HeaderAuthProps) {
	const t = useTranslations('nav');
	const { status } = useSession();
	const [me, setMe] = useState<MeResponse | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [pricingOpen, setPricingOpen] = useState(false);

	const forceLight = variant === 'light';

	useEffect(() => {
		if (status !== 'authenticated') {
			setMe(null);
			return;
		}
		let cancelled = false;
		fetch('/api/me')
			.then((res) => res.json())
			.then((data: MeResponse) => {
				if (!cancelled) setMe(data);
			});
		return () => {
			cancelled = true;
		};
	}, [status, pricingOpen]);

	if (status === 'loading') {
		return (
			<div
				className={`h-8 w-24 animate-pulse rounded-full ${
					forceLight ? 'bg-zinc-200' : 'bg-slate-200 dark:bg-white/5'
				}`}
			/>
		);
	}

	if (status !== 'authenticated' || !me?.authenticated) {
		return (
			<div className={`flex items-center gap-2 ${stacked ? 'w-full flex-col' : ''}`}>
				<Link
					href="/login"
					onClick={onNavigate}
					className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
						stacked ? 'w-full' : ''
					} ${
						forceLight
							? 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
							: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
					}`}
				>
					{t('signIn')}
				</Link>
			</div>
		);
	}

	const initial = (me.name ?? me.email ?? '?').slice(0, 1).toUpperCase();

	return (
		<div className={`flex items-center gap-3 ${stacked ? 'w-full flex-col items-stretch' : ''}`}>
			<button
				onClick={() => setPricingOpen(true)}
				className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200 ${
					stacked ? 'w-full justify-center' : ''
				} ${
					forceLight
						? 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
						: 'border border-cyan-600/30 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300 dark:hover:bg-cyan-400/20'
				}`}
				title={t('upgrade')}
			>
				⚡ {t('credits', { count: me.creditsRemaining ?? 0 })}
			</button>

			<div className={`relative ${stacked ? 'w-full' : ''}`}>
				<button
					onClick={() => setMenuOpen((prev) => !prev)}
					className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200 ${
						stacked ? 'mx-auto' : ''
					} ${
						forceLight
							? 'border border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
							: 'border border-slate-200 bg-accent/10 text-accent hover:bg-accent/15 dark:border-white/[0.08] dark:bg-accent/20 dark:text-accent-light'
					}`}
				>
					{initial}
				</button>
				{menuOpen && (
					<>
						<div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
						<div
							className={`absolute z-20 mt-2 w-56 rounded-xl p-2 shadow-xl ${
								stacked ? 'left-0 right-0 w-full' : 'right-0'
							} ${
								forceLight
									? 'border border-zinc-200 bg-white'
									: 'border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#0C0D0E]'
							}`}
						>
							<div
								className={`border-b px-3 py-2 ${
									forceLight ? 'border-zinc-100' : 'border-slate-100 dark:border-white/[0.08]'
								}`}
							>
								<p
									className={`truncate text-sm font-semibold ${
										forceLight ? 'text-zinc-900' : 'text-slate-900 dark:text-white'
									}`}
								>
									{me.name ?? me.email}
								</p>
								<p className={`mt-0.5 text-xs ${forceLight ? 'text-zinc-500' : 'text-slate-500'}`}>
									{PLAN_LABEL[me.planId ?? 'starter'] ?? me.planId} 요금제
								</p>
							</div>
							{[
								{ href: '/mypage', label: t('mypage') },
								{ href: '/developer', label: `🔑 ${t('developer')}` },
								{ href: '/reseller', label: `🏷️ ${t('reseller')}` },
								{ href: '/enterprise', label: `🏢 ${t('enterprise')}` },
							].map((link) => (
								<a
									key={link.href}
									href={link.href}
									onClick={() => {
										setMenuOpen(false);
										onNavigate?.();
									}}
									className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
										forceLight
											? 'text-zinc-700 hover:bg-zinc-50 hover:text-black'
											: 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white'
									}`}
								>
									{link.label}
								</a>
							))}
							{me.role === 'admin' && (
								<>
									<a
										href="/admin"
										onClick={() => {
											setMenuOpen(false);
											onNavigate?.();
										}}
										className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
											forceLight
												? 'text-zinc-900 hover:bg-zinc-50'
												: 'text-accent hover:bg-slate-50 dark:text-accent-light dark:hover:bg-white/5'
										}`}
									>
										🛠️ {t('admin')}
									</a>
									<a
										href="/admin/self-healing"
										onClick={() => {
											setMenuOpen(false);
											onNavigate?.();
										}}
										className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
											forceLight
												? 'text-zinc-900 hover:bg-zinc-50'
												: 'text-cyan-800 hover:bg-slate-50 dark:text-cyan-300 dark:hover:bg-white/5'
										}`}
									>
										◈ {t('autonomous')}
									</a>
								</>
							)}
							<button
								onClick={() => {
									setMenuOpen(false);
									setPricingOpen(true);
								}}
								className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ${
									forceLight
										? 'text-zinc-700 hover:bg-zinc-50 hover:text-black'
										: 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5'
								}`}
							>
								{t('upgrade')}
							</button>
							<button
								onClick={() => signOut({ callbackUrl: '/' })}
								className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ${
									forceLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-white/5'
								}`}
							>
								{t('logout')}
							</button>
						</div>
					</>
				)}
			</div>

			<PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
		</div>
	);
}
