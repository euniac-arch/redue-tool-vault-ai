'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export interface SubMetricItem {
	name: string;
	score: number;
	maxScore: number;
	evidence: string;
	statusText?: '정상' | '주의' | '결함' | '미구비' | '미등록';
	theme?: 'emerald' | 'amber' | 'rose';
	id?: string;
}

interface GeoSubMetricGridProps {
	items: SubMetricItem[];
	/** md 이상 열 수. 엔티티 E-E-A-T 3카드는 2열(2x2)로 정돈한다. */
	columns?: 2 | 3;
	/** true면 실측 증거를 한 줄 말줄임 대신 줄바꿈으로 전부 노출한다. */
	evidenceWrap?: boolean;
	/** 2열 그리드 균형을 맞추는 안내 카드 등 후행 슬롯. */
	trailing?: ReactNode;
}

const GRID_CLASS: Record<2 | 3, string> = {
	2: 'grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch',
	3: 'grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch',
};

const STATUS_I18N_KEY = {
	정상: 'ok',
	주의: 'warn',
	결함: 'defect',
	미구비: 'missing',
	미등록: 'unregistered',
} as const;

function TruncatedHoverText({
	text,
	className,
	tooltipClassName,
}: {
	text: string;
	className: string;
	tooltipClassName: string;
}) {
	const textRef = useRef<HTMLDivElement>(null);
	const [truncated, setTruncated] = useState(false);
	const [open, setOpen] = useState(false);
	const [coords, setCoords] = useState({ top: 0, left: 0 });

	const measure = useCallback(() => {
		const el = textRef.current;
		if (!el) return;
		setTruncated(el.scrollWidth - el.clientWidth > 1);
	}, []);

	useLayoutEffect(() => {
		measure();
	}, [measure, text]);

	useEffect(() => {
		const el = textRef.current;
		if (!el) return;
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		window.addEventListener('resize', measure);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measure);
		};
	}, [measure]);

	const updateCoords = useCallback(() => {
		const el = textRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setCoords({ top: rect.top, left: rect.left });
	}, []);

	useEffect(() => {
		if (!open) return;
		updateCoords();
		const onReposition = () => updateCoords();
		window.addEventListener('scroll', onReposition, true);
		window.addEventListener('resize', onReposition);
		return () => {
			window.removeEventListener('scroll', onReposition, true);
			window.removeEventListener('resize', onReposition);
		};
	}, [open, updateCoords]);

	return (
		<>
			<div
				ref={textRef}
				className={className}
				onMouseEnter={() => {
					if (!truncated) return;
					updateCoords();
					setOpen(true);
				}}
				onMouseLeave={() => setOpen(false)}
			>
				{text}
			</div>
			{open &&
				truncated &&
				createPortal(
					<div
						role="tooltip"
						className={`fixed z-[9999] pointer-events-none ${tooltipClassName}`}
						style={{
							top: coords.top - 8,
							left: Math.max(8, coords.left),
							transform: 'translateY(-100%)',
						}}
					>
						{text}
					</div>,
					document.body,
				)}
		</>
	);
}

export function GeoSubMetricGrid({ items, columns = 3, evidenceWrap = false, trailing }: GeoSubMetricGridProps) {
	const t = useTranslations('audit.geoSubMetric');

	return (
		<div className={GRID_CLASS[columns]}>
			{items.map((item, idx) => {
				const ratio = item.maxScore > 0 ? item.score / item.maxScore : 0;
				const theme = item.theme || (ratio >= 1 ? 'emerald' : ratio > 0 ? 'amber' : 'rose');
				const statusText = item.statusText || (theme === 'emerald' ? '정상' : theme === 'amber' ? '주의' : '결함');

				const themeStyles = {
					emerald: {
						border:
							'border-slate-200 hover:border-emerald-300 hover:shadow-emerald-500/10 dark:border-emerald-500/20 dark:hover:border-emerald-400/50 dark:hover:shadow-emerald-500/20',
						bg: 'bg-slate-50 dark:bg-slate-800/40',
						badge:
							'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
						bar: 'bg-emerald-500',
						scoreColor: 'text-slate-900 dark:text-white',
					},
					amber: {
						border:
							'border-amber-200 hover:border-amber-400 hover:shadow-amber-500/10 dark:border-amber-500/20 dark:hover:border-amber-400/50 dark:hover:shadow-amber-500/20',
						bg: 'bg-amber-50/50 dark:bg-slate-800/40',
						badge:
							'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
						bar: 'bg-amber-500',
						scoreColor: 'text-slate-900 dark:text-white',
					},
					rose: {
						border:
							'border-rose-200 hover:border-rose-400 hover:shadow-rose-500/10 dark:border-rose-500/30 dark:hover:border-rose-400/60 dark:hover:shadow-rose-500/20',
						bg: 'bg-rose-50/40 dark:bg-slate-800/40',
						badge:
							'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30',
						bar: 'bg-rose-500',
						scoreColor: 'text-slate-900 dark:text-white',
					},
				}[theme];

				return (
					<div
						key={item.id ?? idx}
						data-geo-sub-item={item.id}
						className={`p-3.5 rounded-xl border ${themeStyles.border} ${themeStyles.bg} flex flex-col justify-between h-full transition-all duration-200 hover:shadow-lg group`}
					>
						{/* 1. 상단: 1줄 타이틀 (호버 툴팁) + 우측 상태 뱃지 (라인 일치) */}
						<div className="flex items-center justify-between gap-2 mb-1.5">
							<div className="flex-1 min-w-0">
								<TruncatedHoverText
									text={item.name}
									className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate whitespace-nowrap group-hover:text-slate-900 dark:group-hover:text-white transition-colors cursor-default"
									tooltipClassName="w-max max-w-[260px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 shadow-xl backdrop-blur-md break-keep leading-snug"
								/>
							</div>

							<span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border shrink-0 ${themeStyles.badge}`}>
								{t(STATUS_I18N_KEY[statusText])}
							</span>
						</div>

						{/* 2. 중단: 상하 여백을 압축한 [실측 점수] + 프로그레스 바 */}
						<div className="my-1.5">
							<div className="flex items-baseline justify-between mb-1">
								{/* <span className="text-[11px] text-slate-400 font-medium">{t('measuredScore')}</span> */}
								<div className="flex items-baseline gap-0.5 tabular-nums whitespace-nowrap">
									<span className={`text-sm font-black ${themeStyles.scoreColor}`}>{item.score}</span>
									<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-500">/ {item.maxScore}</span>
								</div>
							</div>
							<div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
								<div
									className={`h-full ${themeStyles.bar} rounded-full transition-all duration-500`}
									style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
								/>
							</div>
						</div>

						{/* 3. 하단: 실측 증거 (2열 그리드는 전문 줄바꿈, 3열은 1줄+호버) */}
						<div className="pt-2 mt-auto border-t border-slate-200 dark:border-slate-800/60 min-w-0">
							{evidenceWrap ? (
								<p className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60 leading-relaxed break-keep">
									{item.evidence}
								</p>
							) : (
								<TruncatedHoverText
									text={item.evidence}
									className="text-[11px] text-slate-500 dark:text-slate-400 truncate whitespace-nowrap cursor-default"
									tooltipClassName="w-max max-w-[280px] p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 shadow-xl backdrop-blur-md break-keep leading-relaxed"
								/>
							)}
						</div>
					</div>
				);
			})}
			{trailing}
		</div>
	);
}
