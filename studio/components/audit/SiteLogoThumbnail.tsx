'use client';

import { useState } from 'react';

export interface SiteLogoThumbnailProps {
	siteUrl: string;
	siteName: string;
	logoUrl?: string;
}

function originFromSiteUrl(siteUrl: string): string {
	try {
		const raw = (siteUrl || '').trim();
		if (!raw) return '';
		return new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin;
	} catch {
		return '';
	}
}

function hostnameFromSiteUrl(siteUrl: string): string {
	try {
		const raw = (siteUrl || '').trim();
		if (!raw) return '';
		return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname
			.replace(/^www\./i, '')
			.toLowerCase();
	} catch {
		return '';
	}
}

function googleFaviconUrl(origin: string): string {
	if (!origin) return '';
	return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAV&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=128`;
}

function siteInitials(siteName: string): string {
	const trimmed = (siteName || '').trim();
	if (!trimmed) return 'WEB';
	return trimmed.slice(0, 2).toUpperCase();
}

export function SiteLogoThumbnail({ siteUrl, siteName, logoUrl }: SiteLogoThumbnailProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);

	const origin = originFromSiteUrl(siteUrl);
	const host = hostnameFromSiteUrl(siteUrl);
	const crawledLogo = (logoUrl || '').trim();
	const clearbit = host ? `https://logo.clearbit.com/${host}` : '';
	const fallbackFavicon = googleFaviconUrl(origin);

	const sources = [...new Set([crawledLogo, clearbit, fallbackFavicon].filter(Boolean))];
	const nextIndex = failedSrc ? sources.indexOf(failedSrc) + 1 : 0;
	const currentSrc = sources[Math.max(nextIndex, 0)] || '';

	return (
		<div className="mr-[10px] flex h-[130px] w-[140px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-[30px]">
			{currentSrc ? (
				<img
					src={currentSrc}
					alt={`${siteName} 로고`}
					className="h-auto max-h-full w-full object-contain drop-shadow-sm filter"
					onError={() => setFailedSrc(currentSrc)}
					loading="lazy"
					referrerPolicy="no-referrer"
				/>
			) : (
				<div className="flex items-center justify-center text-2xl font-bold text-zinc-400">
					{siteInitials(siteName)}
				</div>
			)}
		</div>
	);
}
