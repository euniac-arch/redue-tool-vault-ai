/**
 * Unified CMS router — file-structure + static HTML signatures.
 * Used by File Patch / remote auto-patch to pick the injection adapter.
 */

import { detectCmsFromHtml } from '@/lib/crawling/cms-from-html';
import { detectCmsFromPaths, type DetectedCmsDisplay } from '@/lib/solve/local-folder-scan';
import {
	detectCmsFromRootEntries,
	type CmsRootListEntry,
} from '@/lib/solve/cms-root-signature';

export type DetectedCmsAdapterId = 'gnuboard' | 'wordpress' | 'rhymix' | 'saas' | 'standalone';

export type DetectCmsTypeInput = {
	paths?: string[] | null;
	rootEntries?: CmsRootListEntry[] | null;
	html?: string | null;
};

export type DetectCmsTypeResult = {
	id: DetectedCmsAdapterId;
	display: DetectedCmsDisplay | 'Imweb';
	labelKo: string;
	confidence: 'high' | 'medium' | 'low';
	signals: string[];
	/** How the adapter will deploy the 24-point engine. */
	injectionKind: 'php-extend' | 'php-mu-plugin' | 'php-addon' | 'html-static' | 'php-header';
};

const GNUBOARD_HTML_RE =
	/var\s+g5_url|g5_url\s*=|g5_bbs_url|g5_is_member|g5_is_admin|g5_bo_table|g5_path|\/js\/wrest\.js/i;

function injectionKindFor(id: DetectedCmsAdapterId): DetectCmsTypeResult['injectionKind'] {
	if (id === 'gnuboard') return 'php-extend';
	if (id === 'wordpress') return 'php-mu-plugin';
	if (id === 'rhymix') return 'php-addon';
	if (id === 'saas') return 'html-static';
	return 'php-header';
}

function fromDisplay(display: string): DetectedCmsAdapterId {
	const raw = String(display || '');
	const lower = raw.toLowerCase();
	if (/그누보드|gnuboard|youngcart|영카트|\bg5\b/.test(raw) || /gnuboard|youngcart/.test(lower)) {
		return 'gnuboard';
	}
	if (/wordpress|워드프레스|\bwp\b/.test(lower) || raw.includes('워드프레스')) {
		return 'wordpress';
	}
	if (/rhymix|라이믹스|xpressengine|\bxe\b/.test(lower) || raw.includes('라이믹스')) {
		return 'rhymix';
	}
	if (
		/cafe24|카페24|imweb|아임웹|makeshop|메이크샵|godomall|고도몰|doothost/.test(lower) ||
		raw.includes('카페24') ||
		raw.includes('아임웹')
	) {
		return 'saas';
	}
	return 'standalone';
}

function scoreRootSignature(entries: CmsRootListEntry[]): {
	id: DetectedCmsAdapterId | null;
	signals: string[];
	confidence: 'high' | 'medium' | 'low';
} {
	const files = new Set<string>();
	const dirs = new Set<string>();
	for (const entry of entries) {
		const name = String(entry.name || '').trim().toLowerCase();
		if (!name || name === '.' || name === '..') continue;
		if (entry.isDirectory) dirs.add(name);
		else files.add(name);
	}

	const signals: string[] = [];
	const hasCommon = files.has('common.php');
	const hasConfig = files.has('config.php');
	if (hasCommon) signals.push('common.php');
	if (hasConfig) signals.push('config.php');
	if (dirs.has('extend')) signals.push('extend/');
	if (dirs.has('theme')) signals.push('theme/');
	if (files.has('wp-config.php')) signals.push('wp-config.php');
	if (dirs.has('wp-content')) signals.push('wp-content/');
	if (dirs.has('wp-includes')) signals.push('wp-includes/');
	if (dirs.has('common') && dirs.has('modules')) signals.push('common/+modules/');
	if (dirs.has('files')) signals.push('files/');
	if (files.has('config.inc.php')) signals.push('config.inc.php');

	if (hasCommon || hasConfig || files.has('dbconfig.php') || (dirs.has('theme') && files.has('head.sub.php'))) {
		return {
			id: 'gnuboard',
			signals,
			confidence: hasCommon && hasConfig ? 'high' : 'medium',
		};
	}

	const sig = detectCmsFromRootEntries(entries);
	if (sig.mode === 'gnuboard') return { id: 'gnuboard', signals: sig.signals, confidence: 'high' };
	if (sig.mode === 'wordpress') return { id: 'wordpress', signals: sig.signals, confidence: 'high' };
	if (sig.mode === 'standalone') {
		const rhymix =
			files.has('config.inc.php') ||
			(dirs.has('common') && dirs.has('modules') && dirs.has('files') && !files.has('head.sub.php'));
		return {
			id: rhymix ? 'rhymix' : 'standalone',
			signals: sig.signals,
			confidence: 'medium',
		};
	}
	return { id: null, signals: sig.signals, confidence: 'low' };
}

function fromHtml(html: string): { id: DetectedCmsAdapterId; signals: string[]; confidence: 'high' | 'medium' | 'low' } {
	const sample = html.length > 16_000 ? html.slice(0, 16_000) : html;
	const signals: string[] = [];
	if (GNUBOARD_HTML_RE.test(sample) || GNUBOARD_HTML_RE.test(html)) {
		signals.push('g5_url');
		return { id: 'gnuboard', signals, confidence: 'high' };
	}
	const label = detectCmsFromHtml(html);
	const id = fromDisplay(label);
	if (id === 'wordpress') signals.push('wp-content/wp-includes');
	if (id === 'rhymix') signals.push('rhymix/xe meta');
	if (id === 'saas') signals.push(label);
	return {
		id,
		signals: signals.length > 0 ? signals : [label],
		confidence: id === 'standalone' ? 'low' : 'medium',
	};
}

/**
 * Identify the CMS so the router can pick GnuBoard / WordPress / Rhymix / SaaS adapters.
 * File-system signatures win over HTML; `g5_url` and `common.php`+`config.php` are hard GnuBoard hits.
 */
export function detectCmsType(input: DetectCmsTypeInput = {}): DetectCmsTypeResult {
	const signals: string[] = [];
	let id: DetectedCmsAdapterId | null = null;
	let confidence: DetectCmsTypeResult['confidence'] = 'low';

	const paths = (input.paths || []).map((p) => String(p || '').replace(/\\/g, '/'));
	if (paths.length > 0) {
		const fromPaths = detectCmsFromPaths(paths);
		signals.push(...fromPaths.signals);
		id = fromDisplay(fromPaths.display);
		confidence = fromPaths.confidence;
		if (paths.some((p) => /(^|\/)common\.php$/i.test(p)) && paths.some((p) => /(^|\/)config\.php$/i.test(p))) {
			id = 'gnuboard';
			confidence = 'high';
			signals.push('common.php+config.php');
		}
	}

	if (input.rootEntries && input.rootEntries.length > 0) {
		const root = scoreRootSignature(input.rootEntries);
		signals.push(...root.signals);
		if (root.id && (id == null || root.confidence === 'high' || confidence !== 'high')) {
			id = root.id;
			confidence = root.confidence;
		}
	}

	if (input.html) {
		const htmlHit = fromHtml(input.html);
		signals.push(...htmlHit.signals);
		if (id == null || (id === 'standalone' && htmlHit.id !== 'standalone')) {
			id = htmlHit.id;
			confidence = htmlHit.confidence;
		}
	}

	const resolved = id || 'standalone';
	const displayMap: Record<DetectedCmsAdapterId, DetectCmsTypeResult['display']> = {
		gnuboard: 'Gnuboard',
		wordpress: 'WordPress',
		rhymix: 'Rhymix / XE',
		saas: /imweb|아임웹/i.test(signals.join(' ')) ? 'Imweb' : 'Cafe24',
		standalone: 'Custom HTML/PHP',
	};
	const labelMap: Record<DetectedCmsAdapterId, string> = {
		gnuboard: '그누보드/영카트',
		wordpress: '워드프레스',
		rhymix: '라이믹스/XE',
		saas: '카페24/아임웹/SaaS',
		standalone: '스탠드얼론 PHP',
	};

	return {
		id: resolved,
		display: displayMap[resolved],
		labelKo: labelMap[resolved],
		confidence,
		signals: [...new Set(signals.filter(Boolean))],
		injectionKind: injectionKindFor(resolved),
	};
}
