'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, X } from 'lucide-react';
import { ALL_CHECKLIST_ITEMS, PORTAL_HUB_TABS } from '@/lib/admin/portal-hub/data';
import { usePortalHubState } from '@/lib/admin/portal-hub/usePortalHubState';
import type { PortalHubTabId } from '@/lib/admin/portal-hub/types';
import { NaverTab } from './tabs/NaverTab';
import { GoogleTab } from './tabs/GoogleTab';
import { KakaoTab } from './tabs/KakaoTab';
import { GeoTab } from './tabs/GeoTab';
import { CodePresetsTab } from './tabs/CodePresetsTab';

interface PortalHubModalProps {
	open: boolean;
	onClose: () => void;
}

type Toast = { id: number; message: string };

export function PortalHubModal({ open, onClose }: PortalHubModalProps) {
	const [activeTab, setActiveTab] = useState<PortalHubTabId>('naver');
	const [toasts, setToasts] = useState<Toast[]>([]);
	const {
		domain,
		naverVerificationCode,
		setDomain,
		setNaverVerificationCode,
		toggleChecklistItem,
		isChecked,
	} = usePortalHubState();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const pushToast = useCallback((message: string) => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id));
		}, 2200);
	}, []);

	const handleToggle = useCallback(
		(id: string) => {
			toggleChecklistItem(id);
		},
		[toggleChecklistItem],
	);

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKeyDown);

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [open, onClose]);

	if (!mounted || !open) return null;

	const totalDone = ALL_CHECKLIST_ITEMS.filter((item) => isChecked(item.id)).length;
	const totalItems = ALL_CHECKLIST_ITEMS.length;

	return createPortal(
		<div className="fixed inset-0 z-[20000]" role="presentation">
			<button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-label="모달 닫기" onClick={onClose} />
			<div
				role="dialog"
				aria-modal="true"
				aria-label="포털 등록 & GEO 가이드"
				className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-white dark:bg-slate-900 sm:inset-4 sm:rounded-2xl sm:shadow-2xl md:inset-6"
			>
				{/* Header */}
				<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
							<Rocket className="h-5 w-5" />
						</span>
						<div className="min-w-0">
							<h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
								포털 등록 &amp; GEO 가이드
							</h2>
							<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
								Admin Hub — 검색엔진 및 AI 검색 노출 설정
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<label className="hidden items-center gap-1.5 sm:flex">
							<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">도메인</span>
							<input
								type="text"
								value={domain}
								onChange={(event) => setDomain(event.target.value)}
								placeholder="yourdomain.com"
								className="h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
							/>
						</label>
						<span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 md:inline-block">
							진행률 {totalDone}/{totalItems}
						</span>
						<button
							type="button"
							onClick={onClose}
							aria-label="닫기"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						>
							<X className="h-5 w-5" />
						</button>
					</div>
				</div>

				{/* Mobile domain input */}
				<div className="shrink-0 border-b border-slate-200 px-4 py-2 dark:border-slate-700 sm:hidden">
					<label className="flex items-center gap-1.5">
						<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">도메인</span>
						<input
							type="text"
							value={domain}
							onChange={(event) => setDomain(event.target.value)}
							placeholder="yourdomain.com"
							className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						/>
					</label>
				</div>

				{/* Tab nav */}
				<div className="shrink-0 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-700 sm:px-5" role="tablist" aria-label="포털 등록 탭">
					<div className="flex min-w-max gap-1 py-2">
						{PORTAL_HUB_TABS.map((tab) => {
							const active = tab.id === activeTab;
							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setActiveTab(tab.id)}
									className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
										active
											? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
											: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
									}`}
								>
									<span className="sm:hidden">{tab.shortLabel}</span>
									<span className="hidden sm:inline">{tab.label}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-900/40 sm:px-5">
					<div className="mx-auto max-w-3xl">
						{activeTab === 'naver' && (
							<NaverTab
								domain={domain}
								naverVerificationCode={naverVerificationCode}
								onNaverVerificationCodeChange={setNaverVerificationCode}
								isChecked={isChecked}
								onToggle={handleToggle}
							/>
						)}
						{activeTab === 'google' && <GoogleTab domain={domain} isChecked={isChecked} onToggle={handleToggle} />}
						{activeTab === 'kakao' && <KakaoTab isChecked={isChecked} onToggle={handleToggle} />}
						{activeTab === 'geo' && <GeoTab domain={domain} isChecked={isChecked} onToggle={handleToggle} />}
						{activeTab === 'presets' && (
							<CodePresetsTab domain={domain} onCopied={(filename) => pushToast(`${filename} 복사됨`)} />
						)}
					</div>
				</div>
			</div>

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[210] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
						>
							{toast.message}
						</div>
					))}
				</div>
			)}
		</div>,
		document.body,
	);
}
