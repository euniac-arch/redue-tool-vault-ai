'use client';

import { AdminLocaleSwitcher } from '@/components/admin/AdminLocaleSwitcher';
import { AdminProfileMenu } from '@/components/admin/AdminProfileMenu';
import { FirebaseStatusIndicator } from '@/components/admin/FirebaseStatusIndicator';

interface AdminHeaderProps {
	collapsed: boolean;
	onToggleSidebar: () => void;
	firebaseConfigured: boolean;
}

export function AdminHeader({ collapsed, onToggleSidebar, firebaseConfigured }: AdminHeaderProps) {
	return (
		<header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
			<div className="flex min-w-0 items-center gap-2 sm:gap-3">
				<button
					type="button"
					onClick={onToggleSidebar}
					className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
					aria-label={collapsed ? '사이드바 확장' : '사이드바 축소'}
					aria-pressed={collapsed}
					title={collapsed ? '사이드바 확장' : '사이드바 축소'}
				>
					<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
						<path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
					</svg>
				</button>
				<a href="/admin" className="flex min-w-0 items-center gap-2">
					<span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-bold tracking-wide text-white">
						REDUE
					</span>
					<span className="truncate text-sm font-bold text-slate-900">
						AI Admin
					</span>
				</a>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
				<a
					href="/"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
					title="사용자 사이트 바로가기"
				>
					<span aria-hidden>🌐</span>
					<span className="hidden lg:inline">사용자 사이트</span>
				</a>
				<FirebaseStatusIndicator configured={firebaseConfigured} />
				<AdminLocaleSwitcher />
				<AdminProfileMenu />
			</div>
		</header>
	);
}
