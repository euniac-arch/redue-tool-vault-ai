'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { Bookmark, KeyRound, LayoutDashboard, LogOut, MessageSquare, Search, Shield, User } from 'lucide-react';
// [TEMP] 미연동 회원 메뉴 — 계정 및 구독 설정(요금제 · 히스토리)
// import { Settings } from 'lucide-react';
import { isInsightsProMember } from '@/lib/insights/insights-ai-research';
import { AI_SEARCH_DAILY_LIMIT, readInsightsAiUsage } from '@/lib/insights/insights-ai-usage';
import { HEADER_ICON_BUTTON_CLASS } from '@/lib/ui/header-chrome';
import { PortalHubTriggerButton } from './admin/portal-hub/PortalHubTriggerButton';
import { PortalHubModal } from './admin/portal-hub/PortalHubModal';
// [TEMP] 크레딧 과금/주입 비활성화 — 충전 모달 진입점 숨김
// import { PricingModal } from './PricingModal';

interface MeResponse {
	authenticated: boolean;
	planId?: string;
	creditsRemaining?: number;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	role?: string;
}

const MENU_ITEM_CLASS =
	'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-tight text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-cyan-400';
const MENU_ICON_CLASS = 'h-3.5 w-3.5 shrink-0';
const MENU_DIVIDER_CLASS = 'mt-1 border-t border-slate-100 pt-1 dark:border-slate-800';

const PLAN_NAME: Record<string, string> = {
	starter: '무료 플랜',
	pro: 'Pro 플랜',
	agency: 'Agency 플랜',
};

function MenuLink({
	href,
	onClick,
	children,
}: {
	href: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Link href={href} role="menuitem" onClick={onClick} className={MENU_ITEM_CLASS}>
			{children}
		</Link>
	);
}

interface HeaderAuthProps {
	variant?: 'dark' | 'light';
	stacked?: boolean;
	onNavigate?: () => void;
}

export function HeaderAuth({ variant = 'dark', stacked = false, onNavigate }: HeaderAuthProps) {
	const t = useTranslations('nav');
	const { data: session, status } = useSession();
	const [me, setMe] = useState<MeResponse | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [aiRemaining, setAiRemaining] = useState(AI_SEARCH_DAILY_LIMIT);
	const menuRef = useRef<HTMLDivElement | null>(null);
	// [TEMP] 크레딧 과금/주입 비활성화
	// const [pricingOpen, setPricingOpen] = useState(false);
	const [portalHubOpen, setPortalHubOpen] = useState(false);

	const forceLight = variant === 'light';
	const sessionUser = session?.user;
	const signedIn = status === 'authenticated' || Boolean(sessionUser) || Boolean(me?.authenticated);

	useEffect(() => {
		if (status === 'unauthenticated') {
			setMe(null);
			return;
		}
		if (status !== 'authenticated') return;
		let cancelled = false;
		fetch('/api/me')
			.then((res) => res.json())
			.then((data: MeResponse) => {
				if (!cancelled && data?.authenticated) setMe(data);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [status]);

	useEffect(() => {
		if (!menuOpen) return;
		function onPointerDown(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setMenuOpen(false);
		}
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [menuOpen]);

	if (status === 'loading' && !signedIn) {
		return (
			<div
				className={`h-9 w-24 animate-pulse rounded-full ${
					forceLight ? 'bg-zinc-200' : 'bg-slate-200 dark:bg-white/5'
				}`}
			/>
		);
	}

	if (!signedIn) {
		return (
			<div className={`flex items-center gap-2 ${stacked ? 'w-full flex-col' : ''}`}>
				<Link
					href="/login"
					onClick={onNavigate}
					className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
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

	const name = me?.name ?? sessionUser?.name ?? null;
	const email = me?.email ?? sessionUser?.email ?? null;
	const role = me?.role ?? sessionUser?.role;
	const planId = me?.planId ?? 'starter';
	// [TEMP] 크레딧 과금/주입 비활성화
	// const credits = me?.creditsRemaining;
	const initial = (name ?? email ?? 'R').slice(0, 1).toUpperCase();
	const isAdmin =
		sessionUser?.isAdmin === true || (typeof role === 'string' && role.toLowerCase() === 'admin');
	const isPro = isInsightsProMember(planId, role);
	const planName = PLAN_NAME[planId] ?? planId;
	const gradeLabel = isPro || isAdmin ? '정회원' : '일반회원';
	const planBadge = isPro || isAdmin ? `${planName} · 무제한` : `${planName} (잔여 AI 리서치 ${aiRemaining}회)`;

	function closeMenu() {
		setMenuOpen(false);
		onNavigate?.();
	}

	return (
		<div className={`flex items-center gap-2 ${stacked ? 'w-full flex-col items-stretch' : ''}`}>
			{isAdmin && !stacked && (
				<PortalHubTriggerButton
					variant="public"
					externalModal
					onOpen={() => setPortalHubOpen(true)}
				/>
			)}
			{/* [TEMP] 크레딧 과금/주입 비활성화 — 헤더 잔여 크레딧 뱃지
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
				⚡ {t('credits', { count: credits ?? 0 })}
			</button>
			*/}

			<div ref={menuRef} className={`relative ${stacked ? 'w-full' : ''}`}>
				<button
					type="button"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					aria-controls="header-user-menu"
					onClick={() => {
						const next = !menuOpen;
						setMenuOpen(next);
						if (next) setAiRemaining(readInsightsAiUsage(isPro).remaining);
					}}
					className={`text-sm font-bold ${stacked ? 'mx-auto' : ''} ${
						forceLight
							? 'flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-800 transition-colors duration-200 hover:bg-zinc-200'
							: `${HEADER_ICON_BUTTON_CLASS} text-accent dark:text-accent-light`
					}`}
				>
					{initial}
				</button>
				{menuOpen && (
					<div
						id="header-user-menu"
						role="menu"
						aria-label="사용자 메뉴"
						className={`absolute z-50 mt-2 w-64 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xl shadow-slate-200/50 ${
							stacked ? 'left-0 right-0 w-full' : 'right-0'
						} dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40`}
					>
						<div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
							<div className="flex items-start gap-2.5">
								<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-cyan-300">
									<User className="h-3.5 w-3.5" aria-hidden />
								</span>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name || '회원'}</p>
									{email ? <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{email}</p> : null}
								</div>
							</div>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{isAdmin ? (
									<span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
										ADMIN
									</span>
								) : null}
								<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
									{gradeLabel}
								</span>
								<span
									suppressHydrationWarning
									className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
								>
									{planBadge}
								</span>
							</div>
						</div>

						<div className="pt-1">
							<MenuLink href="/mypage" onClick={closeMenu}>
								<LayoutDashboard className={MENU_ICON_CLASS} aria-hidden />
								마이페이지
							</MenuLink>
							<MenuLink href="/mypage?tab=inquiries" onClick={closeMenu}>
								<MessageSquare className={MENU_ICON_CLASS} aria-hidden />
								내 작업 문의 내역
							</MenuLink>
							<MenuLink href="/audit?tab=history" onClick={closeMenu}>
								<Search className={MENU_ICON_CLASS} aria-hidden />
								나의 사이트 진단 이력
							</MenuLink>
							<MenuLink href="/mypage?tab=scraps" onClick={closeMenu}>
								<Bookmark className={MENU_ICON_CLASS} aria-hidden />
								스크랩 뉴스 / 프롬프트 보관함
							</MenuLink>
							<MenuLink href="/mypage?tab=password" onClick={closeMenu}>
								<KeyRound className={MENU_ICON_CLASS} aria-hidden />
								보안 / 비밀번호 변경
							</MenuLink>
							{/* [TEMP] 미연동 회원 메뉴 — 요금제 · 히스토리
							<MenuLink href="/mypage?tab=overview" onClick={closeMenu}>
								<Settings className={MENU_ICON_CLASS} aria-hidden />
								계정 및 구독 설정
							</MenuLink>
							*/}
						</div>

						{isAdmin && (
							<div className={MENU_DIVIDER_CLASS}>
								<MenuLink href="/admin" onClick={closeMenu}>
									<Shield className={MENU_ICON_CLASS} aria-hidden />
									{t('admin')}
								</MenuLink>
								<PortalHubTriggerButton
									variant="menu"
									className={MENU_ITEM_CLASS}
									externalModal
									onOpen={() => {
										closeMenu();
										setPortalHubOpen(true);
									}}
								/>
							</div>
						)}

						<div className={MENU_DIVIDER_CLASS}>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									void signOut({ callbackUrl: '/' });
								}}
								className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-tight text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
							>
								<LogOut className={MENU_ICON_CLASS} aria-hidden />
								{t('logout')}
							</button>
						</div>
					</div>
				)}
			</div>

			{/* [TEMP] 크레딧 과금/주입 비활성화
			<PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
			*/}
			<PortalHubModal open={portalHubOpen} onClose={() => setPortalHubOpen(false)} />
		</div>
	);
}
