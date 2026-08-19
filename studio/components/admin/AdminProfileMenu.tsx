'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

interface MeResponse {
	authenticated: boolean;
	name?: string | null;
	email?: string | null;
	role?: string;
}

export function AdminProfileMenu() {
	const { status } = useSession();
	const [me, setMe] = useState<MeResponse | null>(null);
	const [open, setOpen] = useState(false);

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
			})
			.catch(() => {
				if (!cancelled) setMe(null);
			});
		return () => {
			cancelled = true;
		};
	}, [status]);

	if (status === 'loading') {
		return <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200" />;
	}

	if (status !== 'authenticated' || !me?.authenticated) {
		return (
			<a
				href="/login"
				className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
			>
				로그인
			</a>
		);
	}

	const label = me.name ?? me.email ?? 'Admin';
	const initial = label.slice(0, 1).toUpperCase();

	return (
		<div className="relative flex items-center gap-2">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="inline-flex max-w-[10rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left hover:bg-slate-50"
				aria-expanded={open}
				aria-haspopup="menu"
			>
				<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
					{initial}
				</span>
				<span className="hidden min-w-0 truncate text-xs font-semibold text-slate-800 sm:block">
					{label}
				</span>
			</button>
			<button
				type="button"
				onClick={() => signOut({ callbackUrl: '/' })}
				className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
			>
				로그아웃
			</button>
			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
					<div
						role="menu"
						className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
					>
						<div className="border-b border-slate-100 px-3 py-2">
							<p className="truncate text-sm font-semibold text-slate-900">{label}</p>
							{me.email && me.name && (
								<p className="mt-0.5 truncate text-xs text-slate-500">{me.email}</p>
							)}
							<p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
								{typeof me.role === 'string' && me.role.toLowerCase() === 'admin' ? 'Administrator' : 'User'}
							</p>
						</div>
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								setOpen(false);
								signOut({ callbackUrl: '/' });
							}}
							className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
						>
							로그아웃
						</button>
					</div>
				</>
			)}
		</div>
	);
}
