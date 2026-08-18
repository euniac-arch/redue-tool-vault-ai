import type { Metadata } from 'next';
import Link from 'next/link';
import { loadSavedAuditReport } from '@/lib/audit/load-saved-report';
import { buildPublicReportUrl, getAppOrigin, siteLabelFromUrl } from '@/lib/audit/report-url';
import { ReportA4View } from '@/components/audit/ReportA4View';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReportPageProps {
	params: { id: string };
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
	const id = params.id?.trim() || '';
	const saved = id ? await loadSavedAuditReport(id) : null;
	if (!saved) {
		return {
			title: '리포트를 찾을 수 없습니다 | REDUE AI',
			robots: { index: false, follow: false },
		};
	}

	const site = siteLabelFromUrl(saved.report.url);
	const title = `REDUE AI Audit Report — ${site}`;
	const description = `SEO & GEO Technical Audit · ${site} · ${saved.report.score.toFixed(1)}점`;
	const url = buildPublicReportUrl(saved.id, getAppOrigin());

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			type: 'article',
			title,
			description,
			url,
			siteName: 'REDUE AI SEO & GEO Studio',
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
		},
	};
}

export default async function PublicReportPage({ params }: ReportPageProps) {
	const id = params.id?.trim() || '';
	const saved = id ? await loadSavedAuditReport(id) : null;

	if (!saved) {
		return (
			<main className="flex min-h-screen min-h-dvh flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center">
				<p className="text-sm font-semibold text-slate-100">
					삭제되었거나 존재하지 않는 진단 리포트입니다.
				</p>
				<Link
					href="/"
					className="w-fit rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
				>
					← 메인으로
				</Link>
			</main>
		);
	}

	return <ReportA4View reportId={saved.id} report={saved.report} />;
}
