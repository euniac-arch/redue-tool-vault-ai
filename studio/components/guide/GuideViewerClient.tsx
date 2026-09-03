'use client';

import { useEffect, useState } from 'react';
import { GuideReportTemplate } from '@/components/guide/GuideReportTemplate';
import { GuideUtilityBar } from '@/components/guide/GuideUtilityBar';
import { copyGuideShareUrl, printGuideReport } from '@/lib/guide/print';
import { getGuideBySlug } from '@/lib/guide/storage';
import type { GuideData } from '@/lib/guide/types';

type GuideViewerClientProps = {
	slug: string;
};

export function GuideViewerClient({ slug }: GuideViewerClientProps) {
	const [data, setData] = useState<GuideData | null>(null);
	const [ready, setReady] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const found = getGuideBySlug(slug);
		setData(found);
		setReady(true);
		if (found) {
			document.title = `${found.brandName} AI/SEO 실행 가이드 | REDUE`;
		}
	}, [slug]);

	async function handleCopy() {
		const ok = await copyGuideShareUrl(slug);
		setCopied(ok);
		window.setTimeout(() => setCopied(false), 2200);
	}

	if (!ready) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
				가이드를 불러오는 중입니다…
			</main>
		);
	}

	if (!data) {
		return (
			<main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-6 text-center">
				<p className="text-base font-semibold text-slate-800">해당 슬러그의 가이드를 찾을 수 없습니다.</p>
				<p className="text-sm text-slate-500">관리자에서 가이드를 생성한 뒤 같은 브라우저로 공유 링크를 열어주세요.</p>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-slate-100 pt-[68px] print:pt-0">
			<GuideUtilityBar slug={data.slug} onPrint={printGuideReport} onCopy={handleCopy} copied={copied} />
			<GuideReportTemplate data={data} />
		</main>
	);
}
