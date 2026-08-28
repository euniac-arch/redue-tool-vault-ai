'use client';

import { Bot } from 'lucide-react';
import { GEO_ENGINE_TABLE, GEO_ESSENTIAL_LINKS, GEO_CHECKLIST, LLMS_TXT_PRESET, renderTemplate } from '@/lib/admin/portal-hub/data';
import { ChecklistCard } from '../ChecklistCard';
import { CodeBlock } from '../CodeBlock';
import { ConsoleLinkButton } from '../ConsoleLinkButton';

interface GeoTabProps {
	domain: string;
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
}

export function GeoTab({ domain, isChecked, onToggle }: GeoTabProps) {
	const llmsTxtPreview = renderTemplate(LLMS_TXT_PRESET.template, { domain });

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">
					Generative Engine Optimization
				</p>
				<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">AI 검색 최적화 (GEO)</h3>
				<p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
					AI 검색엔진은 자체 크롤러 봇과 기존 검색 색인(Google, Bing)을 결합해 사이트 정보를 인용합니다. 아래 6대
					엔진별 수집 경로를 확인하고 필수 작업을 완료하세요.
				</p>
			</section>

			<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
					<Bot className="h-4 w-4 text-fuchsia-500" />
					<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">6대 AI 검색엔진 매핑 테이블</h3>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[640px] text-left text-xs">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
								<th className="px-4 py-2 font-bold">AI 검색엔진</th>
								<th className="px-4 py-2 font-bold">색인 소스</th>
								<th className="px-4 py-2 font-bold">크롤러 봇</th>
								<th className="px-4 py-2 font-bold">비고</th>
							</tr>
						</thead>
						<tbody>
							{GEO_ENGINE_TABLE.map((row) => (
								<tr key={row.engine} className="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
									<td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">{row.engine}</td>
									<td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.indexSource}</td>
									<td className="px-4 py-2.5">
										<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
											{row.crawlerBots}
										</code>
									</td>
									<td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{row.note}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">GEO 3대 필수 작업</h3>
					<ConsoleLinkButton label={GEO_ESSENTIAL_LINKS.bing.label} url={GEO_ESSENTIAL_LINKS.bing.url} />
				</div>
				<div className="mt-3">
					<ChecklistCard title="필수 작업 체크리스트" items={GEO_CHECKLIST} isChecked={isChecked} onToggle={onToggle} />
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">llms.txt 미리보기</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					전체 파일은 &apos;통합 코드 프리셋&apos; 탭에서 도메인이 반영된 상태로 복사할 수 있습니다.
				</p>
				<div className="mt-3">
					<CodeBlock code={llmsTxtPreview} maxHeightClass="max-h-56" />
				</div>
			</section>
		</div>
	);
}
