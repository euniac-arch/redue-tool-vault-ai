'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PageListLoader } from '@/components/ui/PageListLoader';
import { StrategyEmptyState } from '@/components/strategy/StrategyEmptyState';
import { StrategyWorkspace } from '@/components/strategy/StrategyWorkspace';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import { loadStrategyStudioState } from '@/lib/strategy/load-audit-context';
import { buildStrategyStudioHref, sameStrategySite } from '@/lib/strategy/strategy-url';
import type { StrategyAuditLoadResult } from '@/lib/strategy/load-audit-context';

interface StrategyStudioWorkbenchProps {
	auditId: string;
	siteUrl?: string;
	initialKeyword?: string;
}

export function StrategyStudioWorkbench({
	auditId,
	siteUrl = '',
	initialKeyword,
}: StrategyStudioWorkbenchProps) {
	const t = useTranslations('strategyStudio');
	const locale = useLocale();
	const router = useRouter();
	const { historyList, loading: historyLoading } = useAuditHistory();
	const [result, setResult] = useState<StrategyAuditLoadResult | null>(null);
	const waitForHistoryBind = !auditId && (historyLoading || historyList.length > 0);
	const keywordRef = useRef(initialKeyword);
	keywordRef.current = initialKeyword;

	useEffect(() => {
		if (auditId) return;
		if (historyLoading) return;
		const byUrl = siteUrl ? historyList.find((item) => sameStrategySite(item.url, siteUrl)) : null;
		const latest = byUrl || historyList[0];
		if (latest?.id) {
			router.replace(buildStrategyStudioHref(latest.id, initialKeyword, latest.url));
		}
	}, [auditId, siteUrl, historyLoading, historyList, initialKeyword, router]);

	useEffect(() => {
		if (waitForHistoryBind) {
			setResult(null);
			return;
		}

		let cancelled = false;
		setResult(null);
		void loadStrategyStudioState({
			auditId,
			url: siteUrl,
			lang: locale === 'en' ? 'en' : 'ko',
		}).then((next) => {
			if (cancelled) return;
			setResult(next);
			if (next.ok) {
				const resolvedId = next.state.auditContext?.auditId;
				const resolvedUrl = next.state.auditContext?.url || '';
				const idChanged = Boolean(resolvedId && resolvedId !== auditId);
				const urlChanged = Boolean(resolvedUrl && !sameStrategySite(resolvedUrl, siteUrl));
				if (idChanged || urlChanged) {
					router.replace(buildStrategyStudioHref(resolvedId, keywordRef.current, resolvedUrl));
				}
			}
		});
		return () => {
			cancelled = true;
		};
	}, [auditId, siteUrl, locale, router, waitForHistoryBind]);

	if (waitForHistoryBind) {
		return <PageListLoader label={t('loading')} />;
	}

	if (!result) {
		return <PageListLoader label={t('loading')} />;
	}

	if (!result.ok) {
		return <StrategyEmptyState reason={result.reason} />;
	}

	return (
		<StrategyWorkspace
			key={result.state.auditContext?.auditId || result.state.auditContext?.url || 'workspace'}
			state={result.state}
			initialKeyword={initialKeyword}
			history={historyList}
			historyLoading={historyLoading}
		/>
	);
}
