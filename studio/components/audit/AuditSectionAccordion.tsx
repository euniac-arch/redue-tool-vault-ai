'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { MOUNT_AUDIT_RESULT_TABS_EVENT } from '@/lib/audit/scroll-to-category';

interface AuditSectionAccordionProps {
	id?: string;
	isOpen: boolean;
	onToggle: () => void;
	header: ReactNode;
	children: ReactNode;
	collapseLabel: string;
	expandLabel: string;
	className?: string;
	panelId: string;
	/** Keep children mounted even while collapsed (public A4). */
	keepMounted?: boolean;
}

export function AuditSectionAccordion({
	id,
	isOpen,
	onToggle,
	header,
	children,
	collapseLabel,
	expandLabel,
	className,
	panelId,
	keepMounted = false,
}: AuditSectionAccordionProps) {
	const [printMounted, setPrintMounted] = useState(keepMounted);

	useEffect(() => {
		if (keepMounted) {
			setPrintMounted(true);
			return;
		}
		const mount = () => setPrintMounted(true);
		window.addEventListener('beforeprint', mount);
		window.addEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mount);
		return () => {
			window.removeEventListener('beforeprint', mount);
			window.removeEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, mount);
		};
	}, [keepMounted]);

	const showChildren = isOpen || printMounted;

	return (
		<section id={id} className={className}>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				aria-controls={panelId}
				className="flex w-full cursor-pointer select-none items-start justify-between gap-3 text-left"
			>
				<div className="min-w-0 flex-1">{header}</div>
				<span className="print:hidden mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
					{isOpen ? collapseLabel : expandLabel}
					<ChevronDown
						className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
						aria-hidden
					/>
				</span>
			</button>

			<div
				id={panelId}
				className={`pdf-expand-in-print grid transition-[grid-template-rows] duration-300 ease-out print:grid-rows-[1fr] ${
					isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
				inert={!isOpen ? true : undefined}
			>
				<div className="pdf-expand-in-print min-h-0 overflow-hidden">
					<div className="pt-4">{showChildren ? children : null}</div>
				</div>
			</div>
		</section>
	);
}
