/**
 * Shared image `alt` / `title` / filename representative-name semantics.
 * Used by the diagnosis crawler (ceo-name sequential search) and the
 * Global Alt Transformer PHP (`redue_transform_img_alts`) so both sides
 * bind the same `ceo_name` / `$GLOBALS['redue_rep_name']` + `rep_title`.
 */

import { isNoiseRepresentativeName } from '@/lib/audit/extractors/entity';

/** Title tokens — longer first so 대표원장 wins over 원장. */
export const IMG_REP_TITLE_ALTS = '대표원장|원장|대표이사|대표|CEO|이사장';

/** Title tokens accepted after a person name (user-specified name→title form). */
export const IMG_REP_TITLE_ALTS_AFTER_NAME = '대표원장|원장|대표이사|대표';

/** Signature / portrait filename prefixes. */
export const IMG_REP_FILENAME_PREFIX_ALTS = 'sign|ceo|director|rep';

/** `(?:대표원장|원장|대표이사|대표|CEO|이사장)\s*([가-힣]{2,4})` */
export const IMG_ALT_TITLE_THEN_NAME_SOURCE = `(?:${IMG_REP_TITLE_ALTS})\\s*([가-힣]{2,4})`;

/** `([가-힣]{2,4})\s*(?:대표원장|원장|대표이사|대표)` */
export const IMG_ALT_NAME_THEN_TITLE_SOURCE = `([가-힣]{2,4})\\s*(?:${IMG_REP_TITLE_ALTS_AFTER_NAME})`;

/** `(?:sign|ceo|director|rep)[_-]?([가-힣]{2,4}|[a-zA-Z]+)` */
export const IMG_FILENAME_REP_SOURCE = `(?:${IMG_REP_FILENAME_PREFIX_ALTS})[_-]?([가-힣]{2,4}|[a-zA-Z]+)`;

export const IMG_ALT_TITLE_THEN_NAME_RE = new RegExp(IMG_ALT_TITLE_THEN_NAME_SOURCE, 'u');
export const IMG_ALT_NAME_THEN_TITLE_RE = new RegExp(IMG_ALT_NAME_THEN_TITLE_SOURCE, 'u');
export const IMG_FILENAME_REP_RE = new RegExp(IMG_FILENAME_REP_SOURCE, 'i');

const TITLE_CAPTURE_RE = new RegExp(`(${IMG_REP_TITLE_ALTS})`, 'u');
const TITLE_AFTER_NAME_CAPTURE_RE = new RegExp(`(${IMG_REP_TITLE_ALTS_AFTER_NAME})`, 'u');
const IMG_TAG_RE = /<img\b([^>]*)\/?>/gi;
const ATTR_RE = (name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i');
const NEARBY_NODE_RE = /<(h[1-6]|p|strong|b|em|span)[^>]*>([^<]{2,48})<\/\1>/giu;

const IMAGE_NAME_STOPWORDS =
	/^(사진|이미지|로고|서명|사인|프로필|안내|소개|배너|비주얼|썸네일|아이콘|의료진|연구팀)$/;

export type ImageRepAttrSource = 'img-alt' | 'img-title' | 'img-filename' | 'nearby-heading';

export type ImageRepHit = {
	name: string;
	jobTitle: string;
	source: ImageRepAttrSource;
};

export type ExtractImageRepOptions = {
	/** Scan `alt` / `title` (default true). */
	attrs?: boolean;
	/** Scan `src` filename (default true). */
	filenames?: boolean;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function decodeHtmlEntities(value: string): string {
	return compact(value)
		.replace(/&nbsp;/gi, ' ')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&amp;/gi, '&');
}

function decodeSrcStem(raw: string): string {
	let decoded = compact(raw).split('#')[0].split('?')[0];
	if (!decoded) return '';
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		/* keep raw */
	}
	const base = decoded.replace(/\\/g, '/').split('/').pop() || decoded;
	return base.replace(/\.[a-z0-9]{2,5}$/i, '');
}

export function normalizeRepTitle(raw: string | null | undefined): string {
	const title = compact(raw).replace(/\.$/, '');
	if (!title) return '';
	if (/^c\.?e\.?o\.?$/i.test(title)) return 'CEO';
	if (title === '대표자명') return '대표자';
	return title;
}

export function isValidImgRepName(raw: string | null | undefined): boolean {
	const name = compact(raw);
	if (!/^[가-힣]{2,4}$/.test(name)) return false;
	if (IMAGE_NAME_STOPWORDS.test(name)) return false;
	if (isNoiseRepresentativeName(name)) return false;
	if (/^(대표원장|대표자명?|원장|수의사|의료진|대표이사|이사장|대표)$/.test(name)) return false;
	return true;
}

export function composeRepImageAlt(siteName: string, name: string, title?: string): string {
	const parts: string[] = [];
	for (const part of [compact(siteName), compact(name), normalizeRepTitle(title)]) {
		if (part && !parts.includes(part)) parts.push(part);
	}
	return parts.join(' ');
}

export function extractImageRepFromText(
	text: string,
	source: ImageRepAttrSource = 'img-alt',
): ImageRepHit | null {
	const hay = decodeHtmlEntities(text);
	if (!hay) return null;
	const titleThen = hay.match(IMG_ALT_TITLE_THEN_NAME_RE);
	if (titleThen?.[1] && isValidImgRepName(titleThen[1])) {
		const title = titleThen[0].match(TITLE_CAPTURE_RE)?.[1];
		return {
			name: compact(titleThen[1]),
			jobTitle: normalizeRepTitle(title),
			source,
		};
	}
	const nameThen = hay.match(IMG_ALT_NAME_THEN_TITLE_RE);
	if (nameThen?.[1] && isValidImgRepName(nameThen[1])) {
		const title = nameThen[0].match(TITLE_AFTER_NAME_CAPTURE_RE)?.[1];
		return {
			name: compact(nameThen[1]),
			jobTitle: normalizeRepTitle(title),
			source,
		};
	}
	return null;
}

export function extractImageRepFromFilename(src: string): ImageRepHit | null {
	const stem = decodeSrcStem(src);
	if (!stem) return null;
	const prefixed = stem.match(IMG_FILENAME_REP_RE);
	if (prefixed?.[1] && isValidImgRepName(prefixed[1])) {
		return { name: compact(prefixed[1]), jobTitle: '', source: 'img-filename' };
	}
	const korean = stem.match(/([가-힣]{2,4})/);
	if (korean?.[1] && isValidImgRepName(korean[1])) {
		return { name: compact(korean[1]), jobTitle: '', source: 'img-filename' };
	}
	return null;
}

function attrOf(attrs: string, name: string): string {
	const match = attrs.match(ATTR_RE(name));
	return match?.[2] ? decodeHtmlEntities(match[2]) : '';
}

export function extractImageRepFromHtml(
	html: string,
	opts?: ExtractImageRepOptions,
): ImageRepHit | null {
	if (!html) return null;
	const scanAttrs = opts?.attrs !== false;
	const scanFiles = opts?.filenames !== false;
	IMG_TAG_RE.lastIndex = 0;
	let tag: RegExpExecArray | null;
	while ((tag = IMG_TAG_RE.exec(html)) !== null) {
		const attrs = tag[1] || '';
		if (scanAttrs) {
			const fromAlt = extractImageRepFromText(attrOf(attrs, 'alt'), 'img-alt');
			if (fromAlt) return fromAlt;
			const fromTitle = extractImageRepFromText(attrOf(attrs, 'title'), 'img-title');
			if (fromTitle) return fromTitle;
		}
		if (scanFiles) {
			const src = attrOf(attrs, 'src') || attrOf(attrs, 'data-src');
			const fromFile = extractImageRepFromFilename(src);
			if (fromFile) return fromFile;
		}
	}
	return null;
}

export function extractNearbyImageRep(html: string, offset = 0, window = 480): ImageRepHit | null {
	if (!html) return null;
	const start = Math.max(0, offset - window);
	const slice = html.slice(start, offset + window + 80);
	NEARBY_NODE_RE.lastIndex = 0;
	let node: RegExpExecArray | null;
	while ((node = NEARBY_NODE_RE.exec(slice)) !== null) {
		const hit = extractImageRepFromText(node[2], 'nearby-heading');
		if (hit) return hit;
	}
	return extractImageRepFromText(slice.replace(/<[^>]+>/g, ' '), 'nearby-heading');
}

/** Suggest a composed alt when the current one is empty (mirrors PHP transformer). */
export function suggestRepImageAlt(opts: {
	siteName: string;
	existingAlt?: string;
	title?: string;
	src?: string;
	nearbyHtml?: string;
}): string | null {
	if (compact(opts.existingAlt)) return compact(opts.existingAlt);
	const nearby = opts.nearbyHtml ? extractImageRepFromText(opts.nearbyHtml, 'nearby-heading') : null;
	if (nearby) return composeRepImageAlt(opts.siteName, nearby.name, nearby.jobTitle);
	const fromTitle = extractImageRepFromText(opts.title || '', 'img-title');
	if (fromTitle) return composeRepImageAlt(opts.siteName, fromTitle.name, fromTitle.jobTitle);
	const fromFile = extractImageRepFromFilename(opts.src || '');
	if (fromFile) return composeRepImageAlt(opts.siteName, fromFile.name, fromFile.jobTitle);
	return null;
}

/**
 * PHP helpers compiled into every head.sub.php engine.
 * Regex sources stay in sync with the TypeScript extractors above.
 */
export function buildImageRepSemanticsPhp(): string {
	return `	if ( ! function_exists( 'redue_normalize_rep_title' ) ) {
		function redue_normalize_rep_title( $raw ) {
			$t = trim((string) $raw);
			if ( $t === '' ) { return ''; }
			if ( preg_match('/^c\\.?e\\.?o\\.?$/i', $t) ) { return 'CEO'; }
			if ( $t === '대표자명' ) { return '대표자'; }
			return $t;
		}
	}
	if ( ! function_exists( 'redue_is_valid_rep_name' ) ) {
		function redue_is_valid_rep_name( $name ) {
			$name = trim((string) $name);
			if ( $name === '' || ! preg_match('/^[가-힣]{2,4}$/u', $name) ) { return false; }
			if ( preg_match('/^(사진|이미지|로고|서명|사인|프로필|안내|소개|배너|비주얼|썸네일|아이콘|의료진|연구팀)$/u', $name) ) { return false; }
			if ( preg_match('/병원|연구소|센터|안내|소개|진료안내|고객센터|상담실|의료진|연구팀/u', $name) ) { return false; }
			if ( preg_match('/^(대표원장|대표자명?|원장|수의사|의료진|대표이사|이사장|대표)$/u', $name) ) { return false; }
			return true;
		}
	}
	if ( ! function_exists( 'redue_parse_rep_from_text' ) ) {
		function redue_parse_rep_from_text( $text ) {
			$text = trim(preg_replace('/\\s+/u', ' ', html_entity_decode((string) $text, ENT_QUOTES, 'UTF-8')));
			if ( $text === '' ) { return null; }
			if ( preg_match('/${IMG_ALT_TITLE_THEN_NAME_SOURCE}/u', $text, $m) && redue_is_valid_rep_name($m[1]) ) {
				preg_match('/(${IMG_REP_TITLE_ALTS})/u', $m[0], $t);
				return array('name' => trim($m[1]), 'title' => redue_normalize_rep_title(isset($t[1]) ? $t[1] : ''));
			}
			if ( preg_match('/${IMG_ALT_NAME_THEN_TITLE_SOURCE}/u', $text, $m) && redue_is_valid_rep_name($m[1]) ) {
				preg_match('/(${IMG_REP_TITLE_ALTS_AFTER_NAME})/u', $m[0], $t);
				return array('name' => trim($m[1]), 'title' => redue_normalize_rep_title(isset($t[1]) ? $t[1] : ''));
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_parse_rep_from_filename' ) ) {
		function redue_parse_rep_from_filename( $src ) {
			$path = preg_replace('/[?#].*$/', '', (string) $src);
			$base = basename(str_replace('\\\\', '/', $path));
			$stem = preg_replace('/\\.[a-z0-9]+$/i', '', $base);
			$decoded = is_string($stem) ? $stem : '';
			if ( function_exists('rawurldecode') ) {
				$try = @rawurldecode($decoded);
				if ( is_string($try) && $try !== '' ) { $decoded = $try; }
			}
			if ( preg_match('/${IMG_FILENAME_REP_SOURCE}/i', $decoded, $m) && redue_is_valid_rep_name($m[1]) ) {
				return array('name' => trim($m[1]), 'title' => '');
			}
			if ( preg_match('/([가-힣]{2,4})/u', $decoded, $m) && redue_is_valid_rep_name($m[1]) ) {
				return array('name' => trim($m[1]), 'title' => '');
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_extract_rep_from_imgs' ) ) {
		function redue_extract_rep_from_imgs( $html ) {
			if ( ! is_string($html) || $html === '' ) { return null; }
			if ( ! preg_match_all('/<img\\b([^>]*)>/i', $html, $imgs, PREG_SET_ORDER) ) { return null; }
			foreach ( $imgs as $img ) {
				$attrs = $img[1];
				foreach ( array('alt', 'title') as $attr ) {
					if ( preg_match('/\\b' . $attr . '\\s*=\\s*(["\\'])([^"\\']*)\\1/i', $attrs, $am) ) {
						$hit = redue_parse_rep_from_text(trim($am[2]));
						if ( $hit ) { return $hit; }
					}
				}
				$src = '';
				if ( preg_match('/\\bsrc\\s*=\\s*(["\\'])([^"\\']*)\\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				elseif ( preg_match('/\\bdata-src\\s*=\\s*(["\\'])([^"\\']*)\\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				if ( $src !== '' ) {
					$hit = redue_parse_rep_from_filename($src);
					if ( $hit ) { return $hit; }
				}
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_extract_nearby_rep' ) ) {
		function redue_extract_nearby_rep( $html, $offset, $window = 480 ) {
			$start = max(0, (int) $offset - (int) $window);
			$slice = substr((string) $html, $start, ((int) $window * 2) + 120);
			if ( preg_match_all('/<(h[1-6]|p|strong|b|em|span)[^>]*>([^<]{2,48})<\\/\\1>/iu', $slice, $ms, PREG_SET_ORDER) ) {
				foreach ( $ms as $m ) {
					$hit = redue_parse_rep_from_text($m[2]);
					if ( $hit ) { return $hit; }
				}
			}
			$plain = function_exists('redue_plain_text') ? redue_plain_text($slice) : trim(strip_tags($slice));
			return redue_parse_rep_from_text($plain);
		}
	}
	if ( ! function_exists( 'redue_compose_rep_img_alt' ) ) {
		function redue_compose_rep_img_alt( $site_name, $name, $title ) {
			$parts = array();
			foreach ( array($site_name, $name, redue_normalize_rep_title($title)) as $p ) {
				$p = trim((string) $p);
				if ( $p !== '' && ! in_array($p, $parts, true) ) { $parts[] = $p; }
			}
			return trim(implode(' ', $parts));
		}
	}
	if ( ! function_exists( 'redue_bind_rep_globals' ) ) {
		function redue_bind_rep_globals( $name, $title ) {
			$name = trim((string) $name);
			$title = redue_normalize_rep_title($title);
			if ( $name === '' || ! redue_is_valid_rep_name($name) ) { return; }
			if ( empty($GLOBALS['redue_rep_name']) || ! is_string($GLOBALS['redue_rep_name']) || trim($GLOBALS['redue_rep_name']) === '' ) {
				$GLOBALS['redue_rep_name'] = $name;
			}
			if ( $title !== '' && ( empty($GLOBALS['redue_rep_title']) || ! is_string($GLOBALS['redue_rep_title']) || trim($GLOBALS['redue_rep_title']) === '' ) ) {
				$GLOBALS['redue_rep_title'] = $title;
			}
		}
	}
`;
}
