export function stripHtml(value: string): string {
	return value
		.replace(/<!\[CDATA\[|\]\]>/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/\s+/g, ' ')
		.trim();
}

export function formatRelativeKo(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	if (Number.isNaN(date.getTime())) return '';
	if (diffMs < 60_000) return '방금 전';
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes}분 전`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}시간 전`;
	const days = Math.floor(hours / 24);
	if (days === 1) return '어제';
	if (days < 7) return `${days}일 전`;
	return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function hostnameAsSource(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch {
		return '';
	}
}

export { formatRelativeKo as formatRelativeTimeKo };
export { hostnameAsSource as hostnameFromUrl };
