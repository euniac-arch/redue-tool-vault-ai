'use client';

import {
	NAVER_LINKS,
	NAVER_CHECKLIST,
	NAVER_TIPS,
	NAVER_ROBOTS_SNIPPET,
	NAVER_VERIFICATION_TEMPLATE,
	renderTemplate,
} from '@/lib/admin/portal-hub/data';
import { ChecklistCard } from '../ChecklistCard';
import { CodeBlock } from '../CodeBlock';
import { ConsoleLinkButton } from '../ConsoleLinkButton';
import { OptimizationTips } from '../OptimizationTips';

interface NaverTabProps {
	domain: string;
	naverVerificationCode: string;
	onNaverVerificationCodeChange: (value: string) => void;
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
}

export function NaverTab({
	domain,
	naverVerificationCode,
	onNaverVerificationCodeChange,
	isChecked,
	onToggle,
}: NaverTabProps) {
	const verificationSnippet = renderTemplate(NAVER_VERIFICATION_TEMPLATE, { domain, naverCode: naverVerificationCode });

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
							Naver Search Advisor
						</p>
						<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">네이버 포탈 등록</h3>
					</div>
					{NAVER_LINKS.map((link) => (
						<ConsoleLinkButton key={link.url} label={link.label} url={link.url} />
					))}
				</div>
			</section>

			<ChecklistCard items={NAVER_CHECKLIST} isChecked={isChecked} onToggle={onToggle} />

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">사이트 소유확인 메타태그</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					네이버 서치어드바이저에서 발급받은 인증 코드를 입력하면 아래 코드가 자동으로 채워집니다.
				</p>
				<label className="mt-3 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
					네이버 인증 코드
					<input
						type="text"
						value={naverVerificationCode}
						onChange={(event) => onNaverVerificationCodeChange(event.target.value)}
						placeholder="YOUR_CODE"
						className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
					/>
				</label>
				<div className="mt-3">
					<CodeBlock code={verificationSnippet} />
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">robots.txt 수집 허용 확인</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					네이버 크롤러(Yeti)가 수집할 수 있도록 아래 규칙이 포함되어 있는지 확인하세요.
				</p>
				<div className="mt-3">
					<CodeBlock code={NAVER_ROBOTS_SNIPPET} />
				</div>
			</section>

			<OptimizationTips title="네이버 최적화 가이드" tips={NAVER_TIPS} />
		</div>
	);
}
