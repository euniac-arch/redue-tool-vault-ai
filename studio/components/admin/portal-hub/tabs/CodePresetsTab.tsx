'use client';

import { useMemo } from 'react';
import { FileCode2 } from 'lucide-react';
import { CODE_PRESETS, renderTemplate } from '@/lib/admin/portal-hub/data';
import { generateRssFeedCode, RSS_PHP_RELATIVE_PATH } from '@/lib/solve/rss-php-engine';
import { CodeBlock } from '../CodeBlock';

interface CodePresetsTabProps {
	domain: string;
	onCopied: (filename: string) => void;
}

export function CodePresetsTab({ domain, onCopied }: CodePresetsTabProps) {
	const rssCode = useMemo(
		() =>
			generateRssFeedCode({
				siteName: domain.trim() || '사이트',
				siteUrl: domain.trim() ? `https://${domain.trim().replace(/^https?:\/\//i, '')}` : '',
				description: `${domain.trim() || '사이트'} 최신 공개 게시글 RSS 2.0 피드`,
			}),
		[domain],
	);

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
				<p className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
					One-click Deploy Presets
				</p>
				<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">통합 배포 코드 프리셋</h3>
				<p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
					상단의 도메인을 입력하면 각 프리셋의 URL이 자동으로 치환됩니다. 복사 후 해당 파일에 그대로 붙여넣으세요.
				</p>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<FileCode2 className="h-4 w-4 text-cyan-500" />
						<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">rss.php (RSS 2.0 피드)</h3>
					</div>
					<code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
						{RSS_PHP_RELATIVE_PATH}
					</code>
				</div>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					그누보드 5 / 영카트 루트용 RSS 2.0 엔진입니다. common.php와 같은 폴더에 업로드하세요.
				</p>
				<div className="mt-3">
					<CodeBlock
						code={rssCode}
						onCopied={() => onCopied(RSS_PHP_RELATIVE_PATH)}
						maxHeightClass="max-h-80"
						downloadFilename={RSS_PHP_RELATIVE_PATH}
					/>
				</div>
			</section>

			{CODE_PRESETS.map((preset) => {
				const code = renderTemplate(preset.template, { domain });
				return (
					<section
						key={preset.id}
						className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900"
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<FileCode2 className="h-4 w-4 text-cyan-500" />
								<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{preset.title}</h3>
							</div>
							<code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
								{preset.filename}
							</code>
						</div>
						<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
						<div className="mt-3">
							<CodeBlock
								code={code}
								onCopied={() => onCopied(preset.filename)}
								maxHeightClass="max-h-80"
								downloadFilename={preset.filename}
							/>
						</div>
					</section>
				);
			})}
		</div>
	);
}
