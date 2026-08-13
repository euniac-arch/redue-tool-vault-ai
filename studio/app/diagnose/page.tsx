'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FreeAuditHero } from '@/components/FreeAuditHero';

function normalizeDomainParam(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed.replace(/^\/+/, '')}`;
}

function hostnameFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '');
	} catch {
		return raw.replace(/^https?:\/\//i, '').split('/')[0];
	}
}

function DiagnoseLaunch() {
	const searchParams = useSearchParams();
	const domain = normalizeDomainParam(searchParams.get('domain') || '');
	const targetId = searchParams.get('target_id')?.trim() || '';
	const extraQuery: Record<string, string> = {};
	if (targetId) extraQuery.target_id = targetId;
	if (domain) extraQuery.domain = hostnameFromUrl(domain);

	return (
		<main className="flex flex-col gap-6">
			{domain ? (
				<p className="text-center text-sm text-slate-400">
					관리자 수집 리스트에서 정밀 진단을 시작합니다. 엔진이 자동 실행됩니다.
				</p>
			) : null}
			<FreeAuditHero
				initialUrl={domain}
				extraQuery={Object.keys(extraQuery).length ? extraQuery : undefined}
				autoSubmit={Boolean(domain)}
			/>
		</main>
	);
}

/**
 * Admin-list entry for the public REDUE SEO/GEO engine.
 * `/diagnose?domain=example.com&target_id=…` auto-fills and runs `/audit/result`.
 */
export default function DiagnosePage() {
	return (
		<Suspense fallback={null}>
			<DiagnoseLaunch />
		</Suspense>
	);
}
