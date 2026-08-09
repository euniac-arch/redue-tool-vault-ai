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

export function HeaderAuth() {
	const t = useTranslations('nav');
	const { status } = useSession();
	const [me, setMe] = useState<MeResponse | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [pricingOpen, setPricingOpen] = useState(false);

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
		return <div className="h-8 w-24 animate-pulse rounded-full bg-white/5" />;
	}

	if (status !== 'authenticated' || !me?.authenticated) {
		return (
			<a
				href="/login"
				className="rounded-lg border border-white/[0.08] bg-white/5 px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
			>
				{t('login')}
			</a>
		);
	}

	const initial = (me.name ?? me.email ?? '?').slice(0, 1).toUpperCase();

	return (
		<div className="flex items-center gap-3">
			<button
				onClick={() => setPricingOpen(true)}
				className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20"
				title={t('upgrade')}
			>
				⚡ {t('credits', { count: me.creditsRemaining ?? 0 })}
			</button>

			<div className="relative">
				<button
					onClick={() => setMenuOpen((prev) => !prev)}
					className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-accent/20 text-sm font-bold text-accent-light"
				>
					{initial}
				</button>
				{menuOpen && (
					<>
						<div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
						<div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-white/[0.08] bg-[#0C0D0E] p-2 shadow-xl">
							<div className="border-b border-white/[0.08] px-3 py-2">
								<p className="truncate text-sm font-semibold text-white">{me.name ?? me.email}</p>
								<p className="mt-0.5 text-xs text-slate-500">
									{PLAN_LABEL[me.planId ?? 'starter'] ?? me.planId} 요금제
								</p>
							</div>
							<a href="/mypage" className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
								{t('mypage')}
							</a>
							<a href="/developer" className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
								🔑 {t('developer')}
							</a>
							<a href="/reseller" className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
								🏷️ {t('reseller')}
							</a>
							<a href="/enterprise" className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
								🏢 {t('enterprise')}
							</a>
							{me.role === 'admin' && (
								<>
									<a href="/admin" className="block rounded-lg px-3 py-2 text-sm font-semibold text-accent-light hover:bg-white/5">
										🛠️ {t('admin')}
									</a>
									<a href="/admin/autonomous" className="block rounded-lg px-3 py-2 text-sm font-semibold text-cyan-300 hover:bg-white/5">
										◈ {t('autonomous')}
									</a>
								</>
							)}
							<button
								onClick={() => {
									setMenuOpen(false);
									setPricingOpen(true);
								}}
								className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
							>
								{t('upgrade')}
							</button>
							<button
								onClick={() => signOut({ callbackUrl: '/' })}
								className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
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
