'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
	ADMIN_NAV_GROUPS,
	buildAdminHref,
	isAdminNavActive,
	type AdminNavGroup,
} from '@/components/admin/adminNav';

interface AdminSidebarProps {
	collapsed: boolean;
}

function groupContainsActive(pathname: string, group: AdminNavGroup): boolean {
	return group.items.some((item) => isAdminNavActive(pathname, item));
}

function AdminSidebarInner({ collapsed }: AdminSidebarProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const auditId = useMemo(
		() => searchParams.get('id')?.trim() || searchParams.get('auditId')?.trim() || null,
		[searchParams],
	);

	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const group of ADMIN_NAV_GROUPS) {
			initial[group.id] = true;
		}
		return initial;
	});

	useEffect(() => {
		setOpenGroups((prev) => {
			const next = { ...prev };
			for (const group of ADMIN_NAV_GROUPS) {
				if (groupContainsActive(pathname, group)) {
					next[group.id] = true;
				}
			}
			return next;
		});
	}, [pathname]);

	function toggleGroup(id: string) {
		if (collapsed) return;
		setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	return (
		<aside
			className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
				collapsed ? 'w-[4.25rem]' : 'w-64'
			}`}
			aria-label="Admin navigation"
		>
			<nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
				{ADMIN_NAV_GROUPS.map((group) => {
					const open = collapsed ? true : openGroups[group.id] !== false;
					const groupActive = groupContainsActive(pathname, group);

					return (
						<div key={group.id} className="mb-1">
							{!collapsed && (
								<button
									type="button"
									onClick={() => toggleGroup(group.id)}
									className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide transition-colors ${
										groupActive
											? 'bg-slate-100 text-slate-900'
											: 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
									}`}
									aria-expanded={open}
								>
									<span className="text-sm" aria-hidden>
										{group.icon}
									</span>
									<span className="min-w-0 flex-1 truncate normal-case tracking-normal">
										{group.label}
									</span>
									<svg
										viewBox="0 0 20 20"
										className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
											open ? 'rotate-180' : ''
										}`}
										fill="currentColor"
										aria-hidden
									>
										<path
											fillRule="evenodd"
											d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
											clipRule="evenodd"
										/>
									</svg>
								</button>
							)}

							{(collapsed || open) && (
								<ul
									className={`space-y-0.5 ${
										collapsed ? 'mb-2' : 'mb-2 ml-1 border-l border-slate-100 pl-1'
									}`}
								>
									{group.items.map((item) => {
										const active = isAdminNavActive(pathname, item);
										const href = buildAdminHref(item.href, item.preserveId, auditId);
										return (
											<li key={item.href}>
												<Link
													href={href}
													title={item.label}
													className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
														collapsed ? 'justify-center px-0' : ''
													} ${
														active
															? 'bg-slate-900 font-semibold text-white'
															: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
													}`}
													aria-current={active ? 'page' : undefined}
												>
													<span className="shrink-0 text-base leading-none" aria-hidden>
														{item.icon}
													</span>
													{!collapsed && (
														<span className="min-w-0 truncate text-[13px] leading-snug">
															{item.label}
														</span>
													)}
												</Link>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					);
				})}
			</nav>
		</aside>
	);
}

export function AdminSidebar({ collapsed }: AdminSidebarProps) {
	return (
		<Suspense
			fallback={
				<aside
					className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white ${
						collapsed ? 'w-[4.25rem]' : 'w-64'
					}`}
					aria-label="Admin navigation"
				>
					<div className="space-y-2 p-3">
						{ADMIN_NAV_GROUPS.map((group) => (
							<div key={group.id} className="h-8 animate-pulse rounded-lg bg-slate-100" />
						))}
					</div>
				</aside>
			}
		>
			<AdminSidebarInner collapsed={collapsed} />
		</Suspense>
	);
}
