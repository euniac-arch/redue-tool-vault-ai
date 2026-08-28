/**
 * Universal LocalBusiness telephone extract + bind.
 * Shared by audit extractors (TS), workspace prefills, and PHP runtime helpers (string twins).
 *
 * 4-step fallback:
 *   1. $GLOBALS['redue_tel'] / workspace seed
 *   2. CMS config (cf_tel, WP options, Rhymix/XE, generic keys)
 *   3. DOM tel: href + inline script / meta
 *   4. Nationwide labeled regex on full HTML / footer corpus
 */

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Labeled nationwide KR telephone (대표번호 / 지역 / 15xx / 010 / 070 / 050x). */
export const TELEPHONE_LABEL_PREFIX = '(?:대표번호|대표전화|TEL|Tel|전화|문의|상담|고객센터)';

export const TELEPHONE_BODY_CORE =
	'(02[-\\s]?\\d{3,4}[-\\s]?\\d{4}|0[3-6][1-5][-\\s]?\\d{3,4}[-\\s]?\\d{4}|1[568]\\d{2}[-\\s]?\\d{4}|010[-\\s]?\\d{4}[-\\s]?\\d{4}|070[-\\s]?\\d{3,4}[-\\s]?\\d{4}|050\\d{1}[-\\s]?\\d{3,4}[-\\s]?\\d{4}|080[-\\s]?\\d{3,4}[-\\s]?\\d{4}|01[16789][-\\s]?\\d{3,4}[-\\s]?\\d{4})';

/** Broader unlabeled fallback kept so 080 / 011–019 / odd spacing still resolve. */
export const TELEPHONE_BODY_FALLBACK = '(0\\d{1,2}[-\\s]?\\d{3,4}[-\\s]?\\d{4}|1[568]\\d{2}[-\\s]?\\d{4})';

export const TELEPHONE_UNIVERSAL_RE = new RegExp(
	`${TELEPHONE_LABEL_PREFIX}?\\s*[:：]?\\s*(${TELEPHONE_BODY_CORE})`,
	'u',
);

export const TELEPHONE_FALLBACK_RE = new RegExp(
	`${TELEPHONE_LABEL_PREFIX}?\\s*[:：]?\\s*(${TELEPHONE_BODY_FALLBACK})`,
	'u',
);

/** Alias used by entity-patterns / eeat-citation. */
export const TELEPHONE_BODY_RE = TELEPHONE_UNIVERSAL_RE;

export const TEL_HREF_RE = /<a\b[^>]*\bhref=["']tel:([^"']+)["'][^>]*>/gi;

export const TELEPHONE_UNIVERSAL_RE_PHP = `/${TELEPHONE_LABEL_PREFIX}?\\s*[:：]?\\s*(${TELEPHONE_BODY_CORE})/u`;

export const TELEPHONE_FALLBACK_RE_PHP = `/${TELEPHONE_LABEL_PREFIX}?\\s*[:：]?\\s*(${TELEPHONE_BODY_FALLBACK})/u`;

export const TELEPHONE_BODY_RE_PHP = TELEPHONE_UNIVERSAL_RE_PHP;

export const TEL_HREF_RE_PHP = '/<a\\b[^>]*\\bhref=["\']tel:([^"\']+)["\'][^>]*>/i';

function digitsOnly(raw: string): string {
	let digits = raw.replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) {
		digits = `0${digits.slice(2)}`;
	}
	return digits;
}

/**
 * Normalize a Korean telephone number to hyphenated form
 * (`02-1234-5678`, `031-123-4567`, `1588-1234`, `010-1234-5678`).
 */
export function formatKoreanTelephone(raw: string | null | undefined): string {
	const trimmed = compact(raw)
		.replace(/^tel:/i, '')
		.split(/[?,;]/)[0]
		?.trim();
	if (!trimmed) return '';
	let digits = digitsOnly(trimmed);
	if (digits.startsWith('82') && digits.length >= 10) digits = `0${digits.slice(2)}`;
	if (!digits || digits.length < 8 || digits.length > 12) return '';
	if (/^(\d)\1+$/.test(digits)) return '';

	if (digits.startsWith('02')) {
		const rest = digits.slice(2);
		if (rest.length === 8) return `02-${rest.slice(0, 4)}-${rest.slice(4)}`;
		if (rest.length === 7) return `02-${rest.slice(0, 3)}-${rest.slice(3)}`;
	}
	if (/^050\d/.test(digits) && digits.length >= 11) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
	}
	if (/^01[016789]/.test(digits) && digits.length === 11) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
	}
	if (/^(15|16|18)\d{2}/.test(digits) && digits.length === 8) {
		return `${digits.slice(0, 4)}-${digits.slice(4)}`;
	}
	if (digits.length === 11) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	if (digits.length === 9 && !digits.startsWith('02')) {
		return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
	}
	return trimmed.replace(/\s+/g, '-').replace(/\.+/g, '-').replace(/-+/g, '-');
}

/** Workspace / patch bind — format if present, never invent a dummy number. */
export function bindTelephone(value: string | null | undefined): string {
	return formatKoreanTelephone(value);
}

export function extractTelephoneFromText(text: string): string {
	if (!text) return '';
	const labeled = text.match(TELEPHONE_UNIVERSAL_RE);
	const formattedLabeled = formatKoreanTelephone(labeled?.[1] || labeled?.[0] || '');
	if (formattedLabeled) return formattedLabeled;
	const fallback = text.match(TELEPHONE_FALLBACK_RE);
	return formatKoreanTelephone(fallback?.[1] || fallback?.[0] || '');
}

export function extractTelHrefFromHtml(html: string): string {
	if (!html) return '';
	TEL_HREF_RE.lastIndex = 0;
	const m = TEL_HREF_RE.exec(html);
	return formatKoreanTelephone(m?.[1] || '');
}

function extractFromMetaAndScripts(html: string): string {
	const metaRe =
		/<meta\b[^>]*(?:name|property|itemprop)=["'](?:telephone|phone|og:phone_number|contact:phone_number)["'][^>]*>/gi;
	for (const tag of html.match(metaRe) || []) {
		const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
		const hit = formatKoreanTelephone(content);
		if (hit) return hit;
	}
	const itempropRe = /itemprop=["']telephone["'][^>]*>([^<]{6,24})</gi;
	for (const m of html.matchAll(itempropRe)) {
		const hit = formatKoreanTelephone(m[1]);
		if (hit) return hit;
	}
	const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
	for (const block of scripts) {
		const hit = extractTelephoneFromText(block);
		if (hit) return hit;
	}
	return '';
}

export function extractTelephoneFromHtml(html: string): string {
	if (!html) return '';
	const href = extractTelHrefFromHtml(html);
	if (href) return href;
	const metaOrScript = extractFromMetaAndScripts(html);
	if (metaOrScript) return metaOrScript;
	return extractTelephoneFromText(html);
}

export type UniversalTelephoneInput = {
	/** Step 1 — workspace / $GLOBALS['redue_tel'] seed. */
	workspaceTel?: string | null;
	/** Step 2 — CMS config raw value (cf_tel, WP option, …). */
	cmsTel?: string | null;
	/** Step 3–4 — live HTML buffer. */
	html?: string | null;
	/** Extra footer / 사업자 corpus. */
	corpus?: string | null;
};

/** TS twin of `redue_resolve_universal_telephone`. */
export function resolveUniversalTelephone(input: UniversalTelephoneInput): string {
	const step1 = bindTelephone(input.workspaceTel);
	if (step1) return step1;

	const step2 = bindTelephone(input.cmsTel) || extractTelephoneFromText(input.cmsTel || '');
	if (step2) return step2;

	const html = String(input.html || '');
	if (html) {
		const href = extractTelHrefFromHtml(html);
		if (href) return href;
		const fromHtml = extractTelephoneFromHtml(html);
		if (fromHtml) return fromHtml;
	}

	return extractTelephoneFromText(input.corpus || '');
}

function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Compile-time `$GLOBALS['redue_tel']` seed (workspace override wins at runtime). */
export function buildTelephoneGlobalsSeedPhp(tel: string): string {
	return `$GLOBALS['redue_tel'] = ${phpSingleQuoted(bindTelephone(tel))};`;
}

/**
 * PHP runtime helpers: format + 4-step universal resolver.
 * Inserted into every head.sub.php engine via `buildUniversalSeoRuntimeHelpersPhp`.
 */
export function buildTelephoneRuntimeHelpersPhp(): string {
	return `	if ( ! function_exists( 'redue_format_telephone' ) ) {
		function redue_format_telephone( $raw ) {
			if ( ! is_string($raw) || $raw === '' ) { return ''; }
			$raw = preg_replace('/^tel:/i', '', trim($raw));
			$parts = preg_split('/[?,;]/', is_string($raw) ? $raw : '');
			$raw = is_array($parts) && isset($parts[0]) ? trim((string) $parts[0]) : '';
			$digits = preg_replace('/[^\\d]/', '', $raw);
			if ( ! is_string($digits) ) { return ''; }
			if ( strpos($digits, '82') === 0 && strlen($digits) >= 10 ) {
				$digits = '0' . substr($digits, 2);
			}
			$len = strlen($digits);
			if ( $len < 8 || $len > 12 ) { return ''; }
			if ( preg_match('/^(\\d)\\1+$/', $digits) ) { return ''; }
			if ( strpos($digits, '02') === 0 ) {
				$rest = substr($digits, 2);
				$rl = strlen($rest);
				if ( $rl === 8 ) { return '02-' . substr($rest, 0, 4) . '-' . substr($rest, 4); }
				if ( $rl === 7 ) { return '02-' . substr($rest, 0, 3) . '-' . substr($rest, 3); }
			}
			if ( preg_match('/^050\\d/', $digits) && $len >= 11 ) {
				return substr($digits, 0, 4) . '-' . substr($digits, 4, 4) . '-' . substr($digits, 8);
			}
			if ( preg_match('/^01[016789]/', $digits) && $len === 11 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 4) . '-' . substr($digits, 7);
			}
			if ( preg_match('/^(15|16|18)\\d{2}/', $digits) && $len === 8 ) {
				return substr($digits, 0, 4) . '-' . substr($digits, 4);
			}
			if ( $len === 11 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 4) . '-' . substr($digits, 7);
			}
			if ( $len === 10 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 3) . '-' . substr($digits, 6);
			}
			if ( $len === 9 && strpos($digits, '02') !== 0 ) {
				return substr($digits, 0, 2) . '-' . substr($digits, 2, 3) . '-' . substr($digits, 5);
			}
			return $raw;
		}
	}
	if ( ! function_exists( 'redue_extract_telephone' ) ) {
		function redue_extract_telephone( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('${TELEPHONE_UNIVERSAL_RE_PHP}', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_hit) : $_hit;
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			if ( preg_match('${TELEPHONE_FALLBACK_RE_PHP}', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_hit) : $_hit;
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_extract_tel_href' ) ) {
		function redue_extract_tel_href( $html ) {
			if ( ! is_string($html) || $html === '' ) { return ''; }
			if ( preg_match('${TEL_HREF_RE_PHP}', $html, $m) ) {
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($m[1]) : trim($m[1]);
				return is_string($_fmt) ? $_fmt : '';
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_resolve_cms_telephone' ) ) {
		function redue_resolve_cms_telephone() {
			$_scan_keys = function( $arr ) {
				if ( ! is_array($arr) ) { return ''; }
				foreach ( array('cf_tel', 'cf_phone', 'tel', 'phone', 'telephone', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( empty($arr[$_ck]) || ! is_string($arr[$_ck]) || trim($arr[$_ck]) === '' ) { continue; }
					if ( $_ck === 'cf_tel' || $_ck === 'cf_phone' || $_ck === 'tel' || $_ck === 'phone' || $_ck === 'telephone' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($arr[$_ck]) : trim($arr[$_ck]);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
					if ( function_exists('redue_extract_telephone') ) {
						$_hit = redue_extract_telephone($arr[$_ck]);
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
				foreach ( $arr as $_k => $_v ) {
					if ( ! is_string($_k) || ! is_string($_v) || trim($_v) === '' ) { continue; }
					if ( ! preg_match('/tel|phone|전화|문의|상담/i', $_k) ) { continue; }
					$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_v) : '';
					if ( $_fmt !== '' ) { return $_fmt; }
					if ( function_exists('redue_extract_telephone') ) {
						$_hit = redue_extract_telephone($_v);
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
				return '';
			};
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				$_hit = $_scan_keys($GLOBALS['config']);
				if ( $_hit !== '' ) { return $_hit; }
			}
			if ( isset($GLOBALS['site_config']) && is_array($GLOBALS['site_config']) ) {
				$_hit = $_scan_keys($GLOBALS['site_config']);
				if ( $_hit !== '' ) { return $_hit; }
			}
			if ( function_exists('get_option') ) {
				foreach ( array('phone', 'telephone', 'phone_number', 'contact_phone', 'company_phone', 'woocommerce_store_phone', 'blog_phone', 'redue_telephone', 'theme_phone', 'store_phone', 'business_phone') as $_ok ) {
					$_ov = get_option($_ok);
					if ( is_string($_ov) && trim($_ov) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_ov) : trim($_ov);
						if ( $_fmt !== '' ) { return $_fmt; }
						if ( function_exists('redue_extract_telephone') ) {
							$_hit = redue_extract_telephone($_ov);
							if ( $_hit !== '' ) { return $_hit; }
						}
					}
				}
			}
			if ( function_exists('get_theme_mod') ) {
				foreach ( array('phone', 'telephone', 'phone_number', 'contact_phone') as $_tm ) {
					$_tv = get_theme_mod($_tm);
					if ( is_string($_tv) && trim($_tv) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_tv) : trim($_tv);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
				}
			}
			if ( class_exists('Context') && method_exists('Context', 'get') ) {
				foreach ( array('phone', 'tel', 'telephone', 'site_phone') as $_rk ) {
					$_rv = @Context::get($_rk);
					if ( is_string($_rv) && trim($_rv) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_rv) : trim($_rv);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
				}
				$_mod = @Context::get('site_module_info');
				if ( is_object($_mod) ) {
					foreach ( array('phone', 'tel', 'telephone') as $_rk ) {
						if ( ! empty($_mod->$_rk) && is_string($_mod->$_rk) ) {
							$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_mod->$_rk) : trim($_mod->$_rk);
							if ( $_fmt !== '' ) { return $_fmt; }
						}
					}
				}
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_resolve_universal_telephone' ) ) {
		function redue_resolve_universal_telephone( $html = '' ) {
			if ( isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($GLOBALS['redue_tel']) : trim($GLOBALS['redue_tel']);
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			if ( function_exists('redue_resolve_cms_telephone') ) {
				$_cms = redue_resolve_cms_telephone();
				if ( is_string($_cms) && $_cms !== '' ) { return $_cms; }
			}
			if ( is_string($html) && $html !== '' ) {
				if ( function_exists('redue_extract_tel_href') ) {
					$_href = redue_extract_tel_href($html);
					if ( $_href !== '' ) { return $_href; }
				}
				if ( preg_match_all('/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/i', $html, $scripts) && ! empty($scripts[1]) ) {
					foreach ( $scripts[1] as $_sc ) {
						$_hit = function_exists('redue_extract_telephone') ? redue_extract_telephone($_sc) : '';
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
			}
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( empty($GLOBALS['config'][$_ck]) || ! is_string($GLOBALS['config'][$_ck]) ) { continue; }
					$_hit = function_exists('redue_extract_telephone') ? redue_extract_telephone($GLOBALS['config'][$_ck]) : '';
					if ( $_hit !== '' ) { return $_hit; }
					if ( function_exists('redue_extract_tel_href') ) {
						$_href = redue_extract_tel_href($GLOBALS['config'][$_ck]);
						if ( $_href !== '' ) { return $_href; }
					}
				}
			}
			if ( is_string($html) && $html !== '' && function_exists('redue_extract_telephone') ) {
				$_plain = function_exists('redue_plain_text') ? redue_plain_text($html) : strip_tags($html);
				$_hit = redue_extract_telephone(is_string($_plain) ? $_plain : $html);
				if ( $_hit !== '' ) { return $_hit; }
				$_hit = redue_extract_telephone($html);
				if ( $_hit !== '' ) { return $_hit; }
			}
			return '';
		}
	}
`;
}
