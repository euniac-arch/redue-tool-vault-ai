'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const STEPS: Record<'ko' | 'en', string[]> = {
	ko: [
		'대상 페이지 접속 중...',
		'OG 태그 · Canonical · 메타데이터 분석 중...',
		'JSON-LD 스키마 구조화 데이터 스캔 중...',
		'웹 접근성 · 이미지 alt 속성 검사 중...',
		'GEO — Perplexity/ChatGPT 인식 가능성 계산 중...',
		'종합 점수 산출 중...',
	],
	en: [
		'Connecting to the target page...',
		'Analyzing OG tags, canonical URL, and metadata...',
		'Scanning JSON-LD structured data...',
		'Checking accessibility and image alt attributes...',
		'Estimating Perplexity/ChatGPT recognition (GEO)...',
		'Calculating the overall score...',
	],
};

export function AuditLoading({ url }: { url: string }) {
	const t = useTranslations('audit');
	const locale = useLocale() as 'ko' | 'en';
	const steps = STEPS[locale] ?? STEPS.ko;
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
		}, 1100);
		return () => clearInterval(timer);
	}, [steps.length]);

	return (
		<div className="flex flex-col items-center gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-16 text-center">
			<div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
			<div>
				<p className="text-lg font-bold text-white">{t('loadingTitle')}</p>
				<p className="mt-1 max-w-md truncate font-mono text-sm text-slate-400">{url}</p>
			</div>
			<p className="text-sm font-semibold text-accent-light">{steps[stepIndex]}</p>
		</div>
	);
}
