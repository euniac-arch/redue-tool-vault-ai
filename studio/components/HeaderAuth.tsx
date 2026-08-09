'use client';

import { useEffect, useState } from 'react';
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

	const isLight = variant === 'light';

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
					isLight ? 'bg-zinc-200' : 'bg-white/5'
				}`}
			/>
		);
	}

	if (status !== 'authenticated' || !me?.authenticated) {
		return (
			<div className={`flex items-center gap-2 ${stacked ? 'w-full flex-col' : ''}`}>
				<a
					href="/login"
					onClick={onNavigate}
					className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
						stacked ? 'w-full' : ''
					} ${
						isLight
							? 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
							: 'border border-white/[0.08] bg-white/5 text-slate-200 hover:bg-white/10'
					}`}
				>
					{t('signIn')}
				</a>
				<a
					href="/login?mode=signup"
					onClick={onNavigate}
					className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
						stacked ? 'w-full' : ''
					} ${
						isLight
							? 'bg-zinc-900 text-white hover:bg-black'
							: 'bg-white text-zinc-900 hover:bg-zinc-100'
					}`}
				>
					{t('signUp')}
				</a>
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
					isLight
						? 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
						: 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
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
						isLight
							? 'border border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
							: 'border border-white/[0.08] bg-accent/20 text-accent-light'
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
								isLight
									? 'border border-zinc-200 bg-white'
									: 'border border-white/[0.08] bg-[#0C0D0E]'
							}`}
						>
							<div
								className={`border-b px-3 py-2 ${
									isLight ? 'border-zinc-100' : 'border-white/[0.08]'
								}`}
							>
								<p
									className={`truncate text-sm font-semibold ${
										isLight ? 'text-zinc-900' : 'text-white'
									}`}
								>
									{me.name ?? me.email}
								</p>
								<p className={`mt-0.5 text-xs ${isLight ? 'text-zinc-500' : 'text-slate-500'}`}>
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
										isLight
											? 'text-zinc-700 hover:bg-zinc-50 hover:text-black'
											: 'text-slate-200 hover:bg-white/5'
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
											isLight
												? 'text-zinc-900 hover:bg-zinc-50'
												: 'text-accent-light hover:bg-white/5'
										}`}
									>
										🛠️ {t('admin')}
									</a>
									<a
										href="/admin/autonomous"
										onClick={() => {
											setMenuOpen(false);
											onNavigate?.();
										}}
										className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
											isLight
												? 'text-zinc-900 hover:bg-zinc-50'
												: 'text-cyan-300 hover:bg-white/5'
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
									isLight
										? 'text-zinc-700 hover:bg-zinc-50 hover:text-black'
										: 'text-slate-200 hover:bg-white/5'
								}`}
							>
								{t('upgrade')}
							</button>
							<button
								onClick={() => signOut({ callbackUrl: '/' })}
								className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ${
									isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-300 hover:bg-white/5'
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
