/**
 * GnuBoard 5 / YoungCart RSS 2.0 engine — generates a root `rss.php` source string.
 * Site metadata is interpolated as PHP string literals; board/write queries stay
 * parameterized by GnuBoard helpers (`sql_query` / `sql_escape_string`) so table
 * names cannot be injected from request input.
 */

import { buildPhpDualCatchClause, sanitizePhpCode } from '@/lib/solve/php-sanitize';

export const RSS_PHP_RELATIVE_PATH = 'rss.php';
export const RSS_PHP_DEFAULT_ITEM_LIMIT = 30;
export const RSS_PHP_MAX_ITEM_LIMIT = 50;

export type RssFeedCodeInput = {
	siteName?: string | null;
	siteUrl?: string | null;
	description?: string | null;
	/** Latest public posts to emit. Clamped 1–50, default 30. */
	itemLimit?: number | null;
	telephone?: string | null;
	address?: string | null;
};

export const RSS_PHP_INSTALL_GUIDE = {
	title: 'rss.php (RSS 2.0 피드) 적용 가이드',
	path: '루트/rss.php',
	steps: [
		'생성된 rss.php를 그누보드 5 / 영카트 사이트 루트(common.php와 같은 폴더)에 업로드하세요.',
		'브라우저에서 https://도메인/rss.php 가 HTTP 200 이고 Content-Type 이 text/xml 또는 application/rss+xml 인지 확인하세요.',
		'네이버 서치어드바이저 · 구글 서치콘솔 · 다음/카카오 웹마스터에 RSS 피드 URL을 제출하세요.',
		'<head>에 <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.php"> 가 있으면 검색엔진이 피드를 더 빨리 발견합니다.',
	],
} as const;

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function escapePhpSingleQuoted(value: string): string {
	return compact(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function resolveOrigin(siteUrl?: string | null): string {
	const raw = compact(siteUrl);
	if (!raw) return '';
	try {
		const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
		return url.origin.replace(/^http:\/\//i, 'https://');
	} catch {
		return '';
	}
}

function resolveItemLimit(itemLimit?: number | null): number {
	const n = Number(itemLimit);
	if (!Number.isFinite(n)) return RSS_PHP_DEFAULT_ITEM_LIMIT;
	return Math.min(RSS_PHP_MAX_ITEM_LIMIT, Math.max(1, Math.floor(n)));
}

function buildChannelDescription(input: RssFeedCodeInput): string {
	const nap = [compact(input.address), compact(input.telephone)].filter(Boolean).join(' · ');
	const description = compact(input.description);
	if (description && nap) return `${description} — ${nap}`;
	return description || nap;
}

/**
 * GnuBoard 5 / YoungCart compatible RSS 2.0 `rss.php` source.
 * Always returns a syntactically valid PHP file that emits a closed `<channel>`
 * even when `common.php` is missing or the board query throws.
 */
export function generateRssFeedCode(input: RssFeedCodeInput = {}): string {
	const siteName = escapePhpSingleQuoted(input.siteName || '');
	const origin = escapePhpSingleQuoted(resolveOrigin(input.siteUrl));
	const description = escapePhpSingleQuoted(buildChannelDescription(input));
	const limit = resolveItemLimit(input.itemLimit);
	const catchItems = buildPhpDualCatchClause('$_redue_rss_items');
	const catchRow = buildPhpDualCatchClause('$_redue_rss_row');

	return sanitizePhpCode(`<?php
/**
 * REDUE AI SEO & GEO Studio — GnuBoard 5 / YoungCart RSS 2.0
 * Upload to the site root next to common.php (https://example.com/rss.php).
 */
if (is_file('./common.php')) {
	include_once('./common.php');
}

header('Content-Type: text/xml; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

if (!function_exists('redue_rss_plain')) {
	function redue_rss_plain($value) {
		if (!is_string($value)) {
			return '';
		}
		$text = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
		$text = strip_tags(is_string($text) ? $text : '');
		$text = preg_replace('/\\s+/u', ' ', is_string($text) ? $text : '');
		return is_string($text) ? trim($text) : '';
	}
}

if (!function_exists('redue_rss_esc')) {
	function redue_rss_esc($value) {
		$plain = function_exists('redue_rss_plain') ? redue_rss_plain($value) : '';
		$flags = defined('ENT_XML1') ? (ENT_QUOTES | ENT_XML1) : ENT_QUOTES;
		return htmlspecialchars($plain, $flags, 'UTF-8');
	}
}

if (!function_exists('redue_rss_origin')) {
	function redue_rss_origin($fallback) {
		if (defined('G5_URL') && is_string(G5_URL) && G5_URL !== '') {
			$origin = rtrim(G5_URL, '/');
			if ($origin !== '') {
				return $origin;
			}
		}
		$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
			|| (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
			|| (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
		$host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-zA-Z0-9.\\-:]/', '', (string) $_SERVER['HTTP_HOST']) : '';
		if (is_string($host) && $host !== '') {
			return ($https ? 'https://' : 'http://') . $host;
		}
		return rtrim((string) $fallback, '/');
	}
}

if (!function_exists('redue_rss_permalink')) {
	function redue_rss_permalink($bo_table, $wr_id, $origin) {
		$bo_table = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $bo_table);
		$wr_id = (int) $wr_id;
		if ($bo_table === '' || $wr_id < 1) {
			return '';
		}
		$link = '';
		if (function_exists('get_pretty_url')) {
			$pretty = get_pretty_url($bo_table, $wr_id);
			$link = is_string($pretty) ? trim($pretty) : '';
		}
		if ($link === '') {
			$bbs = defined('G5_BBS_URL') ? rtrim((string) G5_BBS_URL, '/') : (rtrim((string) $origin, '/') . '/bbs');
			$link = $bbs . '/board.php?bo_table=' . rawurlencode($bo_table) . '&wr_id=' . $wr_id;
		}
		if ($link !== '' && !preg_match('#^https?://#i', $link)) {
			$link = rtrim((string) $origin, '/') . '/' . ltrim($link, '/');
		}
		return $link;
	}
}

if (!function_exists('redue_rss_is_public_board')) {
	function redue_rss_is_public_board($board) {
		if (!is_array($board)) {
			return false;
		}
		$read_level = isset($board['bo_read_level']) ? (int) $board['bo_read_level'] : 1;
		$list_level = isset($board['bo_list_level']) ? (int) $board['bo_list_level'] : 1;
		if ($read_level > 1 || $list_level > 1) {
			return false;
		}
		if (isset($board['bo_use_rss_view']) && (string) $board['bo_use_rss_view'] === '0') {
			return false;
		}
		$cert = isset($board['bo_use_cert']) ? trim((string) $board['bo_use_cert']) : '';
		if ($cert !== '' && $cert !== '0') {
			return false;
		}
		return true;
	}
}

if (!function_exists('redue_rss_is_public_write')) {
	function redue_rss_is_public_write($row) {
		if (!is_array($row)) {
			return false;
		}
		$wr_id = isset($row['wr_id']) ? (int) $row['wr_id'] : 0;
		$parent = isset($row['wr_parent']) ? (int) $row['wr_parent'] : $wr_id;
		if ($wr_id < 1 || ($parent > 0 && $wr_id !== $parent)) {
			return false;
		}
		if (isset($row['wr_is_comment']) && (int) $row['wr_is_comment'] === 1) {
			return false;
		}
		$option = isset($row['wr_option']) ? strtolower((string) $row['wr_option']) : '';
		if ($option !== '' && preg_match('/secret|adult|cert|hidden|private/', $option)) {
			return false;
		}
		return true;
	}
}

if (!function_exists('redue_rss_build_items')) {
	function redue_rss_build_items($limit, $origin) {
		$xml = '';
		if (!function_exists('sql_query')) {
			return $xml;
		}
		$limit = (int) $limit;
		if ($limit < 1) {
			$limit = ${RSS_PHP_DEFAULT_ITEM_LIMIT};
		}
		$g5 = isset($GLOBALS['g5']) && is_array($GLOBALS['g5']) ? $GLOBALS['g5'] : array();
		$board_new_table = !empty($g5['board_new_table']) ? $g5['board_new_table'] : 'g5_board_new';
		$board_table = !empty($g5['board_table']) ? $g5['board_table'] : 'g5_board';
		$write_prefix = !empty($g5['write_prefix']) ? $g5['write_prefix'] : 'g5_write_';
		$fetch_limit = $limit * 3;
		if ($fetch_limit < 30) {
			$fetch_limit = 30;
		}
		if ($fetch_limit > 150) {
			$fetch_limit = 150;
		}
		$sql = 'SELECT a.bo_table, a.wr_id FROM ' . $board_new_table . ' a'
			. ' INNER JOIN ' . $board_table . ' b ON a.bo_table = b.bo_table'
			. ' WHERE a.wr_id = a.wr_parent AND a.wr_id > 0'
			. ' ORDER BY a.bn_id DESC LIMIT 0, ' . (int) $fetch_limit;
		$result = sql_query($sql, false);
		if (!$result) {
			return $xml;
		}
		$seen = array();
		$count = 0;
		while ($count < $limit && ($new_row = sql_fetch_array($result))) {
			$bo_table = preg_replace('/[^a-zA-Z0-9_]/', '', isset($new_row['bo_table']) ? (string) $new_row['bo_table'] : '');
			$wr_id = isset($new_row['wr_id']) ? (int) $new_row['wr_id'] : 0;
			if ($bo_table === '' || $wr_id < 1) {
				continue;
			}
			$key = $bo_table . ':' . $wr_id;
			if (isset($seen[$key])) {
				continue;
			}
			$seen[$key] = true;
			try {
				$board = function_exists('get_board_db') ? get_board_db($bo_table, true) : null;
				if (!is_array($board) && function_exists('sql_fetch')) {
					$board_sql = 'SELECT * FROM ' . $board_table . " WHERE bo_table = '" . $bo_table . "' LIMIT 1";
					$board = sql_fetch($board_sql);
				}
				if (!redue_rss_is_public_board($board)) {
					continue;
				}
				$write_table = $write_prefix . $bo_table;
				if (!preg_match('/^[a-zA-Z0-9_]+$/', $write_table)) {
					continue;
				}
				$write_sql = 'SELECT wr_id, wr_parent, wr_is_comment, wr_option, wr_subject, wr_content, wr_name, wr_datetime FROM '
					. $write_table . ' WHERE wr_id = ' . $wr_id . ' LIMIT 1';
				$write = function_exists('sql_fetch') ? sql_fetch($write_sql) : null;
				if (!redue_rss_is_public_write($write)) {
					continue;
				}
				$permalink = redue_rss_permalink($bo_table, $wr_id, $origin);
				if ($permalink === '') {
					continue;
				}
				$title = isset($write['wr_subject']) ? $write['wr_subject'] : '';
				$summary = isset($write['wr_content']) ? $write['wr_content'] : '';
				if (function_exists('cut_str')) {
					$summary = cut_str(redue_rss_plain($summary), 300);
				} else {
					$plain = redue_rss_plain($summary);
					$summary = function_exists('mb_substr') ? mb_substr($plain, 0, 300, 'UTF-8') : substr($plain, 0, 300);
				}
				$author = isset($write['wr_name']) ? $write['wr_name'] : '';
				$datetime = isset($write['wr_datetime']) ? (string) $write['wr_datetime'] : '';
				$ts = $datetime !== '' ? strtotime($datetime) : false;
				$pub_date = $ts ? date('r', $ts) : date('r');
				$xml .= '    <item>' . "\\n";
				$xml .= '      <title>' . redue_rss_esc($title) . '</title>' . "\\n";
				$xml .= '      <link>' . redue_rss_esc($permalink) . '</link>' . "\\n";
				$xml .= '      <guid isPermaLink="true">' . redue_rss_esc($permalink) . '</guid>' . "\\n";
				$xml .= '      <description><![CDATA[' . str_replace(array(']]>', "\\0"), array('', ''), (string) $summary) . ']]></description>' . "\\n";
				if (redue_rss_plain($author) !== '') {
					$xml .= '      <dc:creator>' . redue_rss_esc($author) . '</dc:creator>' . "\\n";
				}
				$xml .= '      <pubDate>' . redue_rss_esc($pub_date) . '</pubDate>' . "\\n";
				$xml .= '    </item>' . "\\n";
				$count++;
			} ${catchRow}
		}
		return $xml;
	}
}

$channel_title = '${siteName}';
if ($channel_title === '' && isset($config['cf_title']) && is_string($config['cf_title'])) {
	$channel_title = $config['cf_title'];
}
if ($channel_title === '') {
	$channel_title = 'RSS';
}
$channel_origin = redue_rss_origin('${origin}');
$channel_link = $channel_origin !== '' ? $channel_origin . '/' : '/';
$channel_desc = '${description}';
if ($channel_desc === '' && isset($config['cf_title']) && is_string($config['cf_title'])) {
	$channel_desc = $config['cf_title'];
}
$self_href = ($channel_origin !== '' ? $channel_origin : '') . '/rss.php';
$items_xml = '';
try {
	$items_xml = redue_rss_build_items(${limit}, $channel_origin);
} ${catchItems}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\\n";
echo '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">' . "\\n";
echo '<channel>' . "\\n";
echo '  <title>' . redue_rss_esc($channel_title) . '</title>' . "\\n";
echo '  <link>' . redue_rss_esc($channel_link) . '</link>' . "\\n";
echo '  <description>' . redue_rss_esc($channel_desc) . '</description>' . "\\n";
echo '  <language>ko</language>' . "\\n";
echo '  <lastBuildDate>' . redue_rss_esc(date('r')) . '</lastBuildDate>' . "\\n";
echo '  <atom:link href="' . redue_rss_esc($self_href) . '" rel="self" type="application/rss+xml" />' . "\\n";
echo $items_xml;
echo '</channel>' . "\\n";
echo '</rss>';
exit;
`);
}

/** Alias used by the schema / package export pipeline. */
export const generateRssPhp = generateRssFeedCode;
