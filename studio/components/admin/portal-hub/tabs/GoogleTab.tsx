'use client';

import { GOOGLE_LINKS, GOOGLE_CHECKLIST, GOOGLE_TIPS, GOOGLE_JSONLD_PREVIEW, renderTemplate } from '@/lib/admin/portal-hub/data';
import { ChecklistCard } from '../ChecklistCard';
import { CodeBlock } from '../CodeBlock';
import { ConsoleLinkButton } from '../ConsoleLinkButton';
import { OptimizationTips } from '../OptimizationTips';

interface GoogleTabProps {
	domain: string;
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
}

export function GoogleTab({ domain, isChecked, onToggle }: GoogleTabProps) {
	const jsonLdPreview = renderTemplate(GOOGLE_JSONLD_PREVIEW, { domain });

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
							Google Search Console
						</p>
						<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">구글 사이트 등록</h3>
					</div>
					{GOOGLE_LINKS.map((link) => (
						<ConsoleLinkButton key={link.url} label={link.label} url={link.url} />
					))}
				</div>
			</section>

			<ChecklistCard items={GOOGLE_CHECKLIST} isChecked={isChecked} onToggle={onToggle} />

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">WebSite 구조화 데이터 미리보기</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					전체 Organization + WebSite 프리셋은 &apos;통합 코드 프리셋&apos; 탭에서 복사할 수 있습니다.
				</p>
				<div className="mt-3">
					<CodeBlock code={jsonLdPreview} />
				</div>
			</section>

			<OptimizationTips title="구글 최적화 가이드" tips={GOOGLE_TIPS} />
		</div>
	);
}
