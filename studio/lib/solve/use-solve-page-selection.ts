'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	filterSelectedPages,
	loadPageSelection,
	pageSelectionKey,
	resolvePageSelection,
	savePageSelection,
} from '@/lib/solve/page-selection';
import type { SolvePageMeta } from '@/lib/solve/types';

export function useSolvePageSelection(opts: {
	pages: SolvePageMeta[];
	auditId: string;
	targetUrl: string;
}) {
	const { pages, auditId, targetUrl } = opts;
	const signature = pages.map((page) => pageSelectionKey(page)).join('\0');

	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
		() => resolvePageSelection(pages, loadPageSelection(auditId, targetUrl)),
	);

	useEffect(() => {
		setSelectedKeys(resolvePageSelection(pages, loadPageSelection(auditId, targetUrl)));
		// pages identity is captured by signature
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [signature, auditId, targetUrl]);

	useEffect(() => {
		savePageSelection(auditId, targetUrl, {
			selectedKeys: Array.from(selectedKeys),
			knownKeys: pages.map((page) => pageSelectionKey(page)),
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedKeys, signature, auditId, targetUrl]);

	const toggle = useCallback((key: string) => {
		setSelectedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const setAll = useCallback(
		(selected: boolean) => {
			setSelectedKeys(() => {
				if (!selected) return new Set();
				return new Set(pages.map((page) => pageSelectionKey(page)));
			});
		},
		[pages],
	);

	const selectedPages = useMemo(
		() => filterSelectedPages(pages, selectedKeys).map((page) => ({ ...page, selected: true })),
		[pages, selectedKeys],
	);

	return {
		selectedKeys,
		selectedPages,
		selectedCount: selectedPages.length,
		totalCount: pages.length,
		toggle,
		setAll,
	};
}
