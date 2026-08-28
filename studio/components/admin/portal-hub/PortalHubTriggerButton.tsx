'use client';

import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { PortalHubModal } from './PortalHubModal';

interface PortalHubTriggerButtonProps {
	variant?: 'admin' | 'public' | 'menu';
	className?: string;
	/** Fired when the hub should open. */
	onOpen?: () => void;
	/**
	 * Parent owns `PortalHubModal` (e.g. header profile menu). This button
	 * only requests open — it must not render its own modal, or closing the
	 * dropdown would unmount the overlay.
	 */
	externalModal?: boolean;
}

/**
 * Admin-only entry point for the "포털 등록 & GEO 가이드" hub. Self-contained
 * unless `externalModal` is set.
 */
export function PortalHubTriggerButton({
	variant = 'admin',
	className,
	onOpen,
	externalModal = false,
}: PortalHubTriggerButtonProps) {
	const [open, setOpen] = useState(false);

	const adminClass =
		'inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20';
	const publicClass =
		'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-600/30 bg-cyan-50 text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300 dark:hover:bg-cyan-400/20';
	const menuClass =
		'flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-cyan-700 transition-colors duration-200 hover:bg-slate-50 dark:text-cyan-300 dark:hover:bg-white/5';

	const resolvedClass = className ?? { admin: adminClass, public: publicClass, menu: menuClass }[variant];

	return (
		<>
			<button
				type="button"
				onClick={() => {
					onOpen?.();
					if (!externalModal) setOpen(true);
				}}
				title="포털 등록 & GEO 가이드 (Admin Hub)"
				aria-label="포털 등록 & GEO 가이드"
				aria-haspopup="dialog"
				className={resolvedClass}
			>
				<Rocket className="h-3.5 w-3.5" />
				{(variant === 'admin' || variant === 'menu') && (
					<span className={variant === 'admin' ? 'hidden lg:inline' : undefined}>포털 등록 &amp; GEO 가이드</span>
				)}
			</button>
			{!externalModal ? <PortalHubModal open={open} onClose={() => setOpen(false)} /> : null}
		</>
	);
}
