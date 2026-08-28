'use client';

import dynamic from 'next/dynamic';

/** Client-only A4 viewer — keeps framer-motion out of the server page bundle. */
export const PublicReportClient = dynamic(
	() => import('@/components/audit/ReportA4View').then((m) => m.ReportA4View),
	{ ssr: false },
);
