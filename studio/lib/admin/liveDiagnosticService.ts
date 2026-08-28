/**
 * Client seam for the admin live URL diagnostic workbench.
 * Scan:  POST /api/diagnostics/live
 * Save:  POST /api/diagnostics/live/save
 */
import {
	ISSUE_SEVERITY_LABEL,
	LIVE_INDUSTRY_LABEL,
	LIVE_INDUSTRY_OPTIONS,
	LIVE_SCAN_STEPS,
	hostnameFromLiveUrl,
	normalizeLiveUrl,
	type LiveDiagnosticOptions,
	type LiveDiagnosticProgressHandler,
	type LiveDiagnosticResult,
	type LiveScanStepId,
} from './liveDiagnosticTypes';

export {
	ISSUE_SEVERITY_LABEL,
	LIVE_INDUSTRY_LABEL,
	LIVE_INDUSTRY_OPTIONS,
	LIVE_SCAN_STEPS,
	hostnameFromLiveUrl,
	normalizeLiveUrl,
};
export type {
	LiveCrawlSnapshot,
	LiveDetectedSchema,
	LiveDiagnosticIndustry,
	LiveDiagnosticIssue,
	LiveDiagnosticOptions,
	LiveDiagnosticProgressHandler,
	LiveDiagnosticResult,
	LiveDiagnosticScores,
	LiveIssueSeverity,
	LiveMetaSnapshot,
	LiveScanStepId,
	LiveScanStepStatus,
	LiveScoreBreakdown,
} from './liveDiagnosticTypes';

async function readError(res: Response, fallback: string): Promise<string> {
	try {
		const body = (await res.json()) as { error?: string };
		if (body?.error) return body.error;
	} catch {
		// ignore
	}
	return fallback;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Call the live crawl API and advance the 4-step progress UI while waiting.
 */
export async function runLiveUrlDiagnostic(
	url: string,
	options: LiveDiagnosticOptions,
	onProgress?: LiveDiagnosticProgressHandler,
): Promise<LiveDiagnosticResult> {
	const canonicalUrl = normalizeLiveUrl(url);
	const industry = LIVE_INDUSTRY_OPTIONS.some((item) => item.value === options.industry)
		? options.industry
		: 'medical';

	let stepIndex = 0;
	const mark = (id: LiveScanStepId, status: 'running' | 'done') => onProgress?.(id, status);
	mark(LIVE_SCAN_STEPS[0].id, 'running');

	const ticker = window.setInterval(() => {
		if (stepIndex >= LIVE_SCAN_STEPS.length - 1) return;
		mark(LIVE_SCAN_STEPS[stepIndex].id, 'done');
		stepIndex += 1;
		mark(LIVE_SCAN_STEPS[stepIndex].id, 'running');
	}, 900);

	try {
		const res = await fetch('/api/diagnostics/live', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			cache: 'no-store',
			body: JSON.stringify({
				url: canonicalUrl,
				industry,
				targetFocus: options.targetFocus?.trim() || '',
			}),
		});
		if (!res.ok) throw new Error(await readError(res, '실시간 진단을 실행하지 못했습니다.'));
		const data = (await res.json()) as LiveDiagnosticResult;
		if (!data?.scores) throw new Error('진단 응답이 올바르지 않습니다.');
		return data;
	} finally {
		window.clearInterval(ticker);
		for (const step of LIVE_SCAN_STEPS) mark(step.id, 'done');
		await sleep(80);
	}
}

export async function saveLiveDiagnosticResult(result: LiveDiagnosticResult): Promise<{ id: string; reportShareUrl?: string }> {
	const res = await fetch('/api/diagnostics/live/save', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		cache: 'no-store',
		body: JSON.stringify({ result }),
	});
	if (!res.ok) throw new Error(await readError(res, '진단 결과를 저장하지 못했습니다.'));
	return (await res.json()) as { id: string; reportShareUrl?: string };
}

export function buildClientProposalReport(result: LiveDiagnosticResult): string {
	const issueLines = result.issues.map(
		(issue) => `- [${ISSUE_SEVERITY_LABEL[issue.severity]}] ${issue.title}\n  ${issue.description}`,
	);
	const meta = result.meta;
	return [
		'REDUE GEO 실시간 URL 진단 — 고객 제안용 리포트',
		'================================================',
		`리포트 ID: ${result.id}`,
		`진단 시각: ${result.scannedAt}`,
		`사이트: ${result.siteName} (${result.domain})`,
		`URL: ${result.canonicalUrl}`,
		`업종: ${LIVE_INDUSTRY_LABEL[result.industry]}`,
		`타겟: ${result.targetFocus}`,
		`HTTPS: ${result.crawl?.https ? '적용' : '미적용'} · HTTP ${result.crawl?.status ?? 'N/A'}`,
		'',
		'[점수]',
		`종합 ${result.scores.overall} · 스키마 ${result.scores.schema} · 지식그래프 ${result.scores.knowledgeGraph} · GEO ${result.scores.geo}`,
		result.scoreBreakdown
			? `세부: 메타 ${result.scoreBreakdown.meta}/30 · JSON-LD ${result.scoreBreakdown.jsonLd}/40 · KG ${result.scoreBreakdown.knowledgeGraph}/30`
			: '',
		'',
		'[검출 메타]',
		`title: ${meta?.title || '-'}`,
		`description: ${meta?.description || '-'}`,
		`og:title: ${meta?.ogTitle || '-'}`,
		`og:image: ${meta?.ogImage || '-'}`,
		`canonical: ${meta?.canonical || '-'}`,
		'',
		'[요약]',
		result.summary,
		'',
		'[감점 요인 & 취약점]',
		...issueLines,
		'',
		'[처방 JSON-LD]',
		result.jsonLdPretty,
	]
		.filter((line, index, all) => !(line === '' && all[index - 1] === ''))
		.join('\n');
}

export function downloadClientProposalReport(result: LiveDiagnosticResult): string {
	const body = `\uFEFF${buildClientProposalReport(result)}`;
	const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
	const href = URL.createObjectURL(blob);
	const filename = `${result.id}-${result.domain}-proposal.txt`;
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.setTimeout(() => URL.revokeObjectURL(href), 800);
	return filename;
}

export async function copyTextToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.left = '-9999px';
	document.body.appendChild(area);
	area.select();
	document.execCommand('copy');
	document.body.removeChild(area);
}
