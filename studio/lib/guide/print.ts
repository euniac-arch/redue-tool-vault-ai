const GUIDE_PRINT_CLASS = 'guide-print-ready';
const GUIDE_PAGE_STYLE_ID = 'guide-print-page-rule';

function ensureGuidePageRule() {
	if (document.getElementById(GUIDE_PAGE_STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = GUIDE_PAGE_STYLE_ID;
	style.textContent = '@page { size: A4; margin: 12mm 10mm; }';
	document.head.appendChild(style);
}

function removeGuidePageRule() {
	document.getElementById(GUIDE_PAGE_STYLE_ID)?.remove();
}

export function printGuideReport() {
	if (typeof window === 'undefined') return;
	document.documentElement.classList.add(GUIDE_PRINT_CLASS);
	ensureGuidePageRule();
	const cleanup = () => {
		document.documentElement.classList.remove(GUIDE_PRINT_CLASS);
		removeGuidePageRule();
		window.removeEventListener('afterprint', cleanup);
	};
	window.addEventListener('afterprint', cleanup);
	window.setTimeout(() => {
		window.print();
	}, 40);
}

export async function copyGuideShareUrl(slug: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	const path = `/guide/${encodeURIComponent(slug.trim().toLowerCase())}`;
	const url = `${window.location.origin}${path}`;
	try {
		await navigator.clipboard.writeText(url);
		return true;
	} catch {
		try {
			const input = document.createElement('textarea');
			input.value = url;
			input.setAttribute('readonly', 'true');
			input.style.position = 'fixed';
			input.style.left = '-9999px';
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			return true;
		} catch {
			return false;
		}
	}
}

export function guideSharePath(slug: string): string {
	return `/guide/${encodeURIComponent(slug.trim().toLowerCase())}`;
}
