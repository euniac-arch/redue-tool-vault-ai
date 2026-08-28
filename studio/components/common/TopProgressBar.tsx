'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
	doneTopProgress,
	startTopProgress,
	TOP_PROGRESS_DONE_EVENT,
	TOP_PROGRESS_START_EVENT,
} from '@/components/common/top-progress';

const STALL_MS = 20_000;
const WIDTH_TRANSITION_MS = 280;
const FADE_MS = 250;

function routeKey(pathname: string, search: string) {
	return search ? `${pathname}?${search}` : pathname;
}

function isModifiedClick(event: MouseEvent) {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSameOriginInternalNav(anchor: HTMLAnchorElement): boolean {
	if (anchor.hasAttribute('download')) return false;
	const target = anchor.getAttribute('target');
	if (target && target !== '_self') return false;

	const href = anchor.getAttribute('href');
	if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
		return false;
	}

	let next: URL;
	try {
		next = new URL(anchor.href, window.location.href);
	} catch {
		return false;
	}

	if (next.origin !== window.location.origin) return false;
	if (next.pathname === window.location.pathname && next.search === window.location.search) {
		return false;
	}

	return true;
}

function TopProgressBarInner() {
	const pathname = usePathname() ?? '/';
	const searchParams = useSearchParams();
	const currentKey = routeKey(pathname, searchParams.toString());

	const [visible, setVisible] = useState(false);
	const [progress, setProgress] = useState(0);
	const [fading, setFading] = useState(false);

	const generationRef = useRef(0);
	const timersRef = useRef<number[]>([]);
	const activeRef = useRef(false);
	const fadingRef = useRef(false);
	const prevKeyRef = useRef(currentKey);

	const clearTimers = useCallback(() => {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
	}, []);

	const schedule = useCallback((fn: () => void, ms: number) => {
		const id = window.setTimeout(fn, ms);
		timersRef.current.push(id);
		return id;
	}, []);

	const begin = useCallback(() => {
		generationRef.current += 1;
		const gen = generationRef.current;
		clearTimers();
		activeRef.current = true;
		fadingRef.current = false;
		setFading(false);
		setVisible(true);
		setProgress(0);

		const bump = (value: number) => {
			if (generationRef.current !== gen) return;
			setProgress(value);
		};

		requestAnimationFrame(() => {
			requestAnimationFrame(() => bump(22));
		});
		schedule(() => bump(72), 160);
		schedule(() => bump(82), 420);
		schedule(() => bump(90), 1_200);
		schedule(() => bump(94), 3_000);
		schedule(() => {
			if (generationRef.current === gen) doneTopProgress();
		}, STALL_MS);
	}, [clearTimers, schedule]);

	const finish = useCallback(() => {
		if (!activeRef.current) return;

		generationRef.current += 1;
		const gen = generationRef.current;
		clearTimers();
		activeRef.current = false;
		setProgress(100);

		schedule(() => {
			if (generationRef.current !== gen) return;
			fadingRef.current = true;
			setFading(true);
		}, WIDTH_TRANSITION_MS);

		schedule(() => {
			if (generationRef.current !== gen) return;
			fadingRef.current = false;
			setVisible(false);
			setFading(false);
			setProgress(0);
		}, WIDTH_TRANSITION_MS + FADE_MS);
	}, [clearTimers, schedule]);

	const beginRef = useRef(begin);
	const finishRef = useRef(finish);
	beginRef.current = begin;
	finishRef.current = finish;

	useEffect(() => {
		const onStart = () => {
			if (activeRef.current && !fadingRef.current) return;
			beginRef.current();
		};
		const onDone = () => finishRef.current();

		window.addEventListener(TOP_PROGRESS_START_EVENT, onStart);
		window.addEventListener(TOP_PROGRESS_DONE_EVENT, onDone);
		return () => {
			window.removeEventListener(TOP_PROGRESS_START_EVENT, onStart);
			window.removeEventListener(TOP_PROGRESS_DONE_EVENT, onDone);
		};
	}, []);

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || isModifiedClick(event)) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest('a');
			if (!(anchor instanceof HTMLAnchorElement) || !isSameOriginInternalNav(anchor)) return;
			startTopProgress();
		};

		const onPopState = () => {
			startTopProgress();
		};

		document.addEventListener('click', onClick, true);
		window.addEventListener('popstate', onPopState);
		return () => {
			document.removeEventListener('click', onClick, true);
			window.removeEventListener('popstate', onPopState);
		};
	}, []);

	useEffect(() => {
		if (prevKeyRef.current === currentKey) return;
		prevKeyRef.current = currentKey;
		if (activeRef.current) doneTopProgress();
	}, [currentKey]);

	useEffect(() => () => clearTimers(), [clearTimers]);

	if (!visible && progress === 0) return null;

	return (
		<div
			className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-[2.5px] bg-transparent print:hidden"
			role="progressbar"
			aria-label="페이지 로딩 중"
			aria-hidden={!visible || fading}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progress)}
		>
			<div
				className="relative h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8),0_0_4px_rgba(99,102,241,0.6)] ease-out motion-reduce:transition-none"
				style={{
					width: `${progress}%`,
					opacity: fading ? 0 : 1,
					transitionProperty: 'width, opacity',
					transitionDuration: fading ? `${FADE_MS}ms` : `${WIDTH_TRANSITION_MS}ms`,
					transitionTimingFunction: fading ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
				}}
			>
				<span
					aria-hidden
					className="absolute top-0 right-0 h-full w-24 translate-x-1/3 bg-gradient-to-r from-transparent via-white/40 to-cyan-200 opacity-80 blur-[6px]"
				/>
			</div>
		</div>
	);
}

export function TopProgressBar() {
	return (
		<Suspense fallback={null}>
			<TopProgressBarInner />
		</Suspense>
	);
}

export { doneTopProgress, startTopProgress } from '@/components/common/top-progress';
export { useTopProgress } from '@/components/common/useTopProgress';
