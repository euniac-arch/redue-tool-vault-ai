'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pageSelectionKey } from '@/lib/solve/page-selection';
import {
	applyPageDescriptionOverrides,
	loadPageDescriptions,
	savePageDescriptions,
} from '@/lib/solve/page-description-edits';
import { looksLikeRawUrlOrPath } from '@/lib/solve/page-meta-hydrate';
import type { SolvePageMeta } from '@/lib/solve/types';

export function useSolvePageDescriptions(opts: {
	pages: SolvePageMeta[];
	auditId: string;
	targetUrl: string;
}) {
	const { pages, auditId, targetUrl } = opts;
	const signature = pages.map((page) => pageSelectionKey(page)).join('\0');

	const [overrides, setOverrides] = useState<Record<string, string>>(
		() => loadPageDescriptions(auditId, targetUrl)?.overrides || {},
	);

	useEffect(() => {
		const loaded = loadPageDescriptions(auditId, targetUrl)?.overrides || {};
		const cleaned: Record<string, string> = {};
		for (const [key, value] of Object.entries(loaded)) {
			const text = String(value || '').trim();
			if (!text || looksLikeRawUrlOrPath(text)) continue;
			cleaned[key] = text;
		}
		setOverrides(cleaned);
	}, [auditId, targetUrl, signature]);

	useEffect(() => {
		savePageDescriptions(auditId, targetUrl, { overrides });
	}, [overrides, auditId, targetUrl]);

	const setDescription = useCallback((key: string, value: string) => {
		setOverrides((prev) => ({ ...prev, [key]: value }));
	}, []);

	const pagesWithDesc = useMemo(
		() => applyPageDescriptionOverrides(pages, overrides),
		[pages, overrides],
	);

	return {
		pages: pagesWithDesc,
		overrides,
		setDescription,
	};
}
