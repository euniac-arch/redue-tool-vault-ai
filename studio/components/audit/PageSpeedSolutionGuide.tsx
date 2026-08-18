'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import {
	buildDeferJsCode,
	buildFontCdnCode,
	buildPageSpeedPrescription,
	buildWebpLcpCode,
} from '@/lib/audit/pagespeed-prescription';

interface GuideBlock {
	id: string;
	titleKey: string;
	descKey: string;
	descValues?: Record<string, string>;
	code: string;
	lang: string;
}

const A11Y_ARIA = `<!-- 아이콘-only 버튼/링크: 접근 가능한 이름 제공 -->
<button type="button" aria-label="메뉴 열기" class="icon-btn">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
<a href="/cart" aria-label="장바구니로 이동">
  <svg aria-hidden="true"></svg>
</a>
<!-- 대비: 본문 텍스트는 배경 대비 4.5:1 이상 (예: #0f172a on #f8fafc) -->
<style>
  .body-text { color: #0f172a; background: #f8fafc; }
  .muted { color: #475569; } /* slate-600 — 밝은 배경에서 AA 충족 */
</style>`;

const HTACCESS = `# HTTPS 강제 + 브라우저 캐싱 (.htaccess / Apache)
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header set Cache-Control "public, max-age=2592000" "expr=%{CONTENT_TYPE} =~ m#text/css|javascript|image/#"
</IfModule>`;

function buildGuides(snapshot: PageSpeedSnapshot): GuideBlock[] {
	const rx = buildPageSpeedPrescription(snapshot);
	const guides: GuideBlock[] = [];

	const showDefer =
		snapshot.renderBlocking.length > 0 ||
		(snapshot.scriptExecution?.length ?? 0) > 0 ||
		snapshot.vitals.some((v) => v.id === 'tbt' && v.tier !== 'good') ||
		(snapshot.categories.find((c) => c.id === 'performance')?.tier ?? 'good') !== 'good';
	if (showDefer) {
		guides.push({
			id: 'defer-js',
			titleKey: 'guides.deferJs.title',
			descKey: 'guides.deferJs.desc',
			descValues: { file: rx.blockingScriptName },
			code: buildDeferJsCode(rx.blockingScriptPath),
			lang: 'html',
		});
	}

	if (snapshot.fonts.some((f) => f.bytes != null || f.cdnSavingsBytes != null)) {
		guides.push({
			id: 'font-cdn',
			titleKey: 'guides.fontCdn.title',
			descKey: 'guides.fontCdn.desc',
			descValues: { file: rx.fontFileName || 'webfont' },
			code: buildFontCdnCode(rx.fontFileName),
			lang: 'html',
		});
	}

	const showWebp =
		snapshot.images.length > 0 ||
		!!snapshot.lcpElement?.hasLazyLoading ||
		!!snapshot.lcpElement?.missingFetchPriority ||
		snapshot.vitals.some((v) => v.id === 'lcp' && v.tier !== 'good');
	if (showWebp) {
		guides.push({
			id: 'webp-lcp',
			titleKey: 'guides.webpLcp.title',
			descKey: 'guides.webpLcp.desc',
			descValues: { file: rx.lcpFileName, webp: rx.lcpWebpPath },
			code: buildWebpLcpCode(rx.lcpImagePath, rx.lcpWebpPath),
			lang: 'html',
		});
	}

	if ((snapshot.categories.find((c) => c.id === 'accessibility')?.tier ?? 'good') !== 'good') {
		guides.push({
			id: 'a11y',
			titleKey: 'guides.a11y.title',
			descKey: 'guides.a11y.desc',
			code: A11Y_ARIA,
			lang: 'html',
		});
	}

	if (
		(snapshot.cacheResources?.length ?? 0) > 0 ||
		(snapshot.categories.find((c) => c.id === 'best-practices')?.tier ?? 'good') !== 'good' ||
		(snapshot.categories.find((c) => c.id === 'performance')?.score ?? 100) < 90
	) {
		guides.push({
			id: 'htaccess',
			titleKey: 'guides.htaccess.title',
			descKey: 'guides.htaccess.desc',
			code: HTACCESS,
			lang: 'apache',
		});
	}

	return guides;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
	const t = useTranslations('audit.pageSpeed');
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			/* ignore */
		}
	}

	return (
		<div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0e1a]">
			<div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] px-3 py-1.5">
				<span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">{lang}</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/10"
				>
					{copied ? (
						<>
							<Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400" aria-hidden />
							{t('copied')}
						</>
					) : (
						<>
							<Copy className="h-3 w-3" aria-hidden />
							{t('copy')}
						</>
					)}
				</button>
			</div>
			<pre className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
				<code>{code}</code>
			</pre>
		</div>
	);
}

interface PageSpeedSolutionGuideProps {
	snapshot: PageSpeedSnapshot;
}

/**
 * 문제점별 맞춤형 실전 해결 가이드 — 경고/감점 항목에만 노출.
 * 코드 스니펫은 실측된 병목 파일명을 주입한다.
 */
export function PageSpeedSolutionGuide({ snapshot }: PageSpeedSolutionGuideProps) {
	const t = useTranslations('audit.pageSpeed');
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const prescription = buildPageSpeedPrescription(snapshot);
	const active = buildGuides(snapshot);
	const issueCount = active.length + (prescription.duplicateJquery ? 1 : 0);

	return (
		<section
			className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/20"
			aria-labelledby="psi-solutions-title"
		>
			<button
				type="button"
				id="psi-solutions-title"
				aria-expanded={isGuideOpen}
				aria-controls="psi-guides-panel"
				onClick={() => setIsGuideOpen((v) => !v)}
				className="flex w-full cursor-pointer select-none items-center justify-between gap-3 px-3.5 py-3 text-left"
			>
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('guidesTitle')}</span>
					<span
						className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
							issueCount > 0
								? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
								: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
						}`}
					>
						{issueCount > 0
							? t('accordion.issuesDetected', { count: issueCount })
							: t('accordion.noIssues')}
					</span>
				</div>
				<span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
					{isGuideOpen ? t('accordion.collapse') : t('accordion.showDetails')}
					{isGuideOpen ? (
						<ChevronUp className="h-3.5 w-3.5" aria-hidden />
					) : (
						<ChevronDown className="h-3.5 w-3.5" aria-hidden />
					)}
				</span>
			</button>

			<div
				id="psi-guides-panel"
				className="psi-accordion"
				data-open={isGuideOpen ? 'true' : 'false'}
				inert={!isGuideOpen ? true : undefined}
			>
				<div className="psi-accordion-inner">
					<div className="flex flex-col gap-3 border-t border-slate-200 dark:border-white/[0.06] px-3.5 pb-3.5 pt-3">
						{issueCount === 0 ? (
							<div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
								{t('guidesAllGood')}
							</div>
						) : (
							<>
								<p className="text-xs text-slate-500">{t('guidesSubtitle')}</p>
								<ul className="flex flex-col gap-3">
									{prescription.duplicateJquery ? (
										<li
											className="rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/10 px-4 py-3.5"
											role="alert"
										>
											<div className="flex items-start gap-2.5">
												<AlertTriangle
													className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
													aria-hidden
												/>
												<div className="min-w-0 flex-1">
													<p className="text-sm font-bold text-amber-900 dark:text-amber-100">
														{t('guides.duplicateJquery.title')}
													</p>
													<p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-100/85">
														{t('guides.duplicateJquery.desc', {
															versions: prescription.duplicateJquery.versions.join(', '),
															files: prescription.duplicateJquery.files.join(', '),
														})}
													</p>
												</div>
											</div>
										</li>
									) : null}
									{active.map((g) => (
										<li
											key={g.id}
											className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/25 px-4 py-3.5"
										>
											<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(g.titleKey)}</p>
											<p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
												{g.descValues ? t(g.descKey, g.descValues) : t(g.descKey)}
											</p>
											<CodeBlock code={g.code} lang={g.lang} />
										</li>
									))}
								</ul>
							</>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
