'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';

interface GuideBlock {
	id: string;
	titleKey: string;
	descKey: string;
	code: string;
	lang: string;
	/** Show when snapshot has matching warning, or always if force. */
	when: (s: PageSpeedSnapshot) => boolean;
}

const DEFER_JS = `<!-- 렌더링 차단 스크립트: defer + DOMContentLoaded 안전 래핑 -->
<script src="/js/analytics.js" defer></script>
<script defer>
  document.addEventListener('DOMContentLoaded', function () {
    // DOM 준비 후에만 무거운 초기화 실행
    if (typeof window.initHeavyWidgets === 'function') {
      window.initHeavyWidgets();
    }
  });
</script>`;

const PRETENDARD_CDN = `<!-- 대용량 로컬 폰트 대신 Pretendard CDN (서브셋 + woff2) -->
<link
  rel="stylesheet"
  as="style"
  crossorigin
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
/>
<style>
  body {
    font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  }
</style>`;

const WEBP_LCP = `<!-- LCP 히어로 이미지: WebP + fetchpriority + 크기 예약 -->
<link rel="preload" as="image" href="/images/hero.webp" fetchpriority="high" />
<img
  src="/images/hero.webp"
  srcset="/images/hero.webp 1x, /images/hero@2x.webp 2x"
  width="1200"
  height="630"
  alt="메인 비주얼"
  fetchpriority="high"
  decoding="async"
/>
<!-- PNG/JPG → WebP 변환 예: npx @squoosh/cli --webp auto hero.png -->`;

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

const GUIDES: GuideBlock[] = [
	{
		id: 'defer-js',
		titleKey: 'guides.deferJs.title',
		descKey: 'guides.deferJs.desc',
		code: DEFER_JS,
		lang: 'html',
		when: (s) =>
			s.renderBlocking.length > 0 ||
			(s.scriptExecution?.length ?? 0) > 0 ||
			s.vitals.some((v) => v.id === 'tbt' && v.tier !== 'good') ||
			(s.categories.find((c) => c.id === 'performance')?.tier ?? 'good') !== 'good',
	},
	{
		id: 'font-cdn',
		titleKey: 'guides.fontCdn.title',
		descKey: 'guides.fontCdn.desc',
		code: PRETENDARD_CDN,
		lang: 'html',
		when: (s) => s.fonts.length > 0,
	},
	{
		id: 'webp-lcp',
		titleKey: 'guides.webpLcp.title',
		descKey: 'guides.webpLcp.desc',
		code: WEBP_LCP,
		lang: 'html',
		when: (s) =>
			s.images.length > 0 ||
			!!s.lcpElement?.hasLazyLoading ||
			!!s.lcpElement?.missingFetchPriority ||
			s.vitals.some((v) => v.id === 'lcp' && v.tier !== 'good'),
	},
	{
		id: 'a11y',
		titleKey: 'guides.a11y.title',
		descKey: 'guides.a11y.desc',
		code: A11Y_ARIA,
		lang: 'html',
		when: (s) =>
			(s.categories.find((c) => c.id === 'accessibility')?.tier ?? 'good') !== 'good',
	},
	{
		id: 'htaccess',
		titleKey: 'guides.htaccess.title',
		descKey: 'guides.htaccess.desc',
		code: HTACCESS,
		lang: 'apache',
		when: (s) =>
			(s.cacheResources?.length ?? 0) > 0 ||
			(s.categories.find((c) => c.id === 'best-practices')?.tier ?? 'good') !== 'good' ||
			(s.categories.find((c) => c.id === 'performance')?.score ?? 100) < 90,
	},
];

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
		<div className="relative mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#0a0e1a]">
			<div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
				<span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">{lang}</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
				>
					{copied ? (
						<>
							<Check className="h-3 w-3 text-emerald-400" aria-hidden />
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
			<pre className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed text-slate-300">
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
 * 기본 접힘(Collapse)으로 메인 진단 수치를 가리지 않음.
 */
export function PageSpeedSolutionGuide({ snapshot }: PageSpeedSolutionGuideProps) {
	const t = useTranslations('audit.pageSpeed');
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const active = GUIDES.filter((g) => g.when(snapshot));
	const issueCount = active.length;

	return (
		<section
			className="rounded-xl border border-white/[0.08] bg-black/20"
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
					<span className="text-sm font-bold text-slate-100">{t('guidesTitle')}</span>
					<span
						className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
							issueCount > 0
								? 'bg-amber-500/20 text-amber-300'
								: 'bg-emerald-500/15 text-emerald-300'
						}`}
					>
						{issueCount > 0
							? t('accordion.issuesDetected', { count: issueCount })
							: t('accordion.noIssues')}
					</span>
				</div>
				<span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200">
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
					<div className="flex flex-col gap-3 border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
						{issueCount === 0 ? (
							<div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
								{t('guidesAllGood')}
							</div>
						) : (
							<>
								<p className="text-xs text-slate-500">{t('guidesSubtitle')}</p>
								<ul className="flex flex-col gap-3">
									{active.map((g) => (
										<li
											key={g.id}
											className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3.5"
										>
											<p className="text-sm font-bold text-slate-100">{t(g.titleKey)}</p>
											<p className="mt-1 text-xs leading-relaxed text-slate-400">
												{t(g.descKey)}
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
