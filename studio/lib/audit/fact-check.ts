/**
 * AI Schema Fact-Check (Semantic Cross-Check).
 *
 * Complements the deterministic JSON-LD syntax/required-field checks in
 * `parser.ts` with an LLM pass that cross-references the *visible page text*
 * against the *injected JSON-LD* to catch industry mismatches, fabricated
 * (hallucinated) claims, and wrong NAP/contact data — the kind of semantic
 * drift a pure schema-shape validator can never see.
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { createHash } from 'node:crypto';
import { extractGnbNavigationPages } from '@/lib/audit/extractors/gnb-pages';
import { extractMainContentText } from '@/lib/audit/extractors/page-description';
import {
	extractContentScopedH2,
	extractContentScopedHeadings,
	extractJsonLdScriptBodies,
	parseJsonLdDocument,
	parseMeta,
} from '@/lib/audit/parser';

export type FactCheckSeverity = 'high' | 'medium' | 'low';
export type FactCheckStatus = 'valid' | 'warning' | 'danger';

export interface FactCheckIssue {
	severity: FactCheckSeverity;
	/** Free-form Korean issue label, e.g. "업종/주제 불일치", "대표자 표기 오류". */
	type: string;
	/** Schema field path implicated, e.g. "knowsAbout", "author / representative". */
	field: string;
	/** The problematic value as it appears in the schema. */
	detected_value: string;
	description: string;
	recommendation: string;
}

export interface FactCheckResult {
	/** 100-point deduction-based schema integrity score. */
	integrity_score: number;
	/** valid: >=95, warning: 70-94, danger: <70. */
	status: FactCheckStatus;
	/** One or two sentence Korean summary of the audit verdict. */
	summary: string;
	issues: FactCheckIssue[];
}

export type FactCheckProvider = 'openai' | 'gemini' | 'heuristic';

export interface FactCheckResponse extends FactCheckResult {
	url: string;
	checkedAt: string;
	provider: FactCheckProvider;
	model?: string;
	cached: boolean;
	cacheKey: string;
	schemaTypes: string[];
	/** The exact JSON-LD nodes that were cross-checked — lets the client build a "clean" copy. */
	schemaBlocks: unknown[];
	/** False when the page had no JSON-LD to check — result is a stub in that case. */
	hasSchema: boolean;
	warning?: string;
}

export interface FactCheckPageContext {
	url: string;
	title: string;
	metaDescription: string;
	h1: string[];
	h2: string[];
	h3: string[];
	menuText: string[];
	bodySummary: string;
}

/** ~4 chars/token — same rough estimator used by `lib/llm-pricing.ts`. LLM token-optimization util #1. */
export function estimateTokenCount(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

const SITE_TEXT_TOKEN_BUDGET = 1500;
const SITE_TEXT_CHAR_BUDGET = SITE_TEXT_TOKEN_BUDGET * 4;

function sliceChars(value: string, max: number): string {
	return [...value].slice(0, max).join('');
}

function cleanText(raw: string): string {
	return String(raw || '')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractH3($: CheerioAPI, max = 10): string[] {
	const out: string[] = [];
	$('h3').each((_, el) => {
		if (out.length >= max) return false;
		const text = cleanText($(el).text());
		if (text && !out.includes(text)) out.push(text);
	});
	return out;
}

/** Step 1 of the pipeline: strip chrome/scripts and pull the fields the auditor cares about. */
export function buildFactCheckPageContext(html: string, url: string): FactCheckPageContext {
	const $ = cheerio.load(html || '<html></html>');
	$('script, style, noscript, iframe, svg, canvas').remove();

	const meta = parseMeta($);
	const menu = extractGnbNavigationPages($, url, { limit: 30 }).map((item) => item.name).filter(Boolean);

	return {
		url,
		title: meta.pageTitle || meta.title,
		metaDescription: meta.metaDescription,
		h1: extractContentScopedHeadings($),
		h2: extractContentScopedH2($, 8),
		h3: extractH3($, 10),
		menuText: Array.from(new Set(menu)).slice(0, 30),
		bodySummary: extractMainContentText($),
	};
}

/**
 * LLM token-optimization util #2: fit the extracted context inside the
 * ~1,500-token budget, letting the (least information-dense) body text
 * yield first while headings / titles / menu stay intact.
 */
export function truncatePageContextToBudget(context: FactCheckPageContext): FactCheckPageContext {
	const fixed = [
		context.title,
		context.metaDescription,
		...context.h1,
		...context.h2,
		...context.h3,
		...context.menuText,
	].join(' ');
	const remaining = Math.max(200, SITE_TEXT_CHAR_BUDGET - fixed.length);
	return { ...context, bodySummary: sliceChars(cleanText(context.bodySummary), remaining) };
}

/** Step 1b: pull raw JSON-LD blocks straight out of the HTML (regex-first, tolerant parser). */
export function extractSchemaBlocks(html: string): unknown[] {
	const bodies = extractJsonLdScriptBodies(html);
	const nodes: unknown[] = [];
	for (const raw of bodies) {
		const parsed = parseJsonLdDocument(raw);
		if (parsed == null) continue;
		if (Array.isArray(parsed)) nodes.push(...parsed);
		else nodes.push(parsed);
	}
	return nodes;
}

function typeOf(node: unknown): string[] {
	if (!node || typeof node !== 'object') return [];
	const t = (node as Record<string, unknown>)['@type'];
	if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
	if (typeof t === 'string') return [t];
	return [];
}

export function collectSchemaTypes(blocks: readonly unknown[]): string[] {
	const out = new Set<string>();
	for (const block of blocks) {
		for (const t of typeOf(block)) out.add(t);
		const graph = block && typeof block === 'object' ? (block as Record<string, unknown>)['@graph'] : undefined;
		if (Array.isArray(graph)) {
			for (const node of graph) for (const t of typeOf(node)) out.add(t);
		}
	}
	return Array.from(out);
}

/** Deterministic cache key: same URL + same schema bytes ⇒ same key (10-min cache hit). */
export function computeFactCheckCacheKey(url: string, schemaBlocks: readonly unknown[]): string {
	const schemaHash = createHash('sha256').update(JSON.stringify(schemaBlocks)).digest('hex');
	const urlHash = createHash('sha256').update(url.trim().toLowerCase()).digest('hex').slice(0, 16);
	return `${urlHash}:${schemaHash}`;
}

export type { IntegrityGrade, IntegrityStatus } from '@/lib/audit/integrity-status';
export { getIntegrityStatus } from '@/lib/audit/integrity-status';

/** valid: >=95, warning: 70-94, danger: <70. */
export function deriveFactCheckStatus(score: number): FactCheckStatus {
	if (score >= 95) return 'valid';
	if (score >= 70) return 'warning';
	return 'danger';
}

export const FACT_CHECK_SYSTEM_PROMPT = `당신은 최고 수준의 SEO & Schema.org 데이터 감사관입니다.
제공된 [웹사이트 실제 텍스트]와 [주입된 JSON-LD 스키마]를 정밀 대조하여, 실제 사이트 내용과 불일치하거나 왜곡/환각된 데이터를 찾아내세요.

검증 기준:
1. 업종 불일치 (예: 동물병원 사이트에 사람 병원/암 치료/일반 기업 스키마 주입 여부)
2. 환각/허위 데이터 (예: 사이트에 없는 진료과목, 허위 키워드, 없는 외부 링크/병원 네트워크)
3. 대표자/연락처 오류 (예: 대표자명이 '인사말'로 등록되었거나 엉뚱한 전화번호가 들어간 경우)
4. 스키마 무결성 점수 산출 (100점 만점 기준 감점제)

반드시 아래 JSON과 동일한 구조의 순수 JSON 객체 하나만 반환하세요. 설명, 마크다운, 코드블록 없이 JSON만 출력합니다.
{
  "integrity_score": number,        // 0~100 정수, 100점 만점 감점제
  "status": "valid" | "warning" | "danger", // valid: 95점 이상, warning: 70~94점, danger: 70점 미만 (integrity_score와 반드시 일치)
  "summary": string,                 // 판정 요약 1~2문장 (한국어)
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "type": string,               // 이슈 유형 (한국어), 예: "업종/주제 불일치", "환각/허위 데이터", "대표자 표기 오류"
      "field": string,               // 문제가 된 스키마 필드 경로, 예: "knowsAbout", "author / representative"
      "detected_value": string,      // 스키마에서 감지된 문제의 값
      "description": string,         // 문제 상세 설명 (한국어)
      "recommendation": string       // 구체적인 수정 권장안 (한국어)
    }
  ]
}
문제가 없으면 issues는 빈 배열([])로, integrity_score는 100, status는 "valid"로 반환하세요.

예시:
{
  "integrity_score": 85,
  "status": "warning",
  "summary": "동물병원 사이트이나 사람 암 치료 관련 키워드가 포함되어 있습니다.",
  "issues": [
    {
      "severity": "high",
      "type": "업종/주제 불일치",
      "field": "knowsAbout",
      "detected_value": "전립선암, 중입자치료",
      "description": "실제 사이트는 동물병원이나 인체 암 치료 키워드가 스키마에 포함되어 검색엔진 스팸 패널티 위험이 있습니다.",
      "recommendation": "반려동물 진료 과목(내과, 외과, 치과 등)으로 교체하세요."
    },
    {
      "severity": "medium",
      "type": "대표자 표기 오류",
      "field": "author / representative",
      "detected_value": "인사말",
      "description": "대표자명이 실제 인물 이름이 아닌 '인사말'로 등록되어 있습니다.",
      "recommendation": "실제 원장님 성함 또는 의료진 대표명으로 수정하세요."
    }
  ]
}`;

function formatSchemaForPrompt(schemaBlocks: readonly unknown[]): string {
	const json = JSON.stringify(schemaBlocks, null, 2);
	const maxChars = 4000;
	return json.length > maxChars ? `${json.slice(0, maxChars)}\n... (truncated)` : json;
}

/** LLM token-optimization util #3: cap the JSON-LD block itself so a bloated schema can't blow the context window. */
export function buildFactCheckUserPrompt(context: FactCheckPageContext, schemaBlocks: readonly unknown[]): string {
	const trimmed = truncatePageContextToBudget(context);
	return [
		`대상 URL: ${trimmed.url}`,
		'',
		'[웹사이트 실제 텍스트]',
		`타이틀: ${trimmed.title || '(없음)'}`,
		`메타 설명: ${trimmed.metaDescription || '(없음)'}`,
		`H1: ${trimmed.h1.join(' / ') || '(없음)'}`,
		`H2: ${trimmed.h2.join(' / ') || '(없음)'}`,
		`H3: ${trimmed.h3.join(' / ') || '(없음)'}`,
		`메뉴: ${trimmed.menuText.join(' / ') || '(없음)'}`,
		`본문 요약: ${trimmed.bodySummary || '(없음)'}`,
		'',
		'[주입된 JSON-LD 스키마]',
		formatSchemaForPrompt(schemaBlocks),
	].join('\n');
}

function clampScore(value: number): number {
	if (!Number.isFinite(value)) return 100;
	return Math.max(0, Math.min(100, Math.round(value)));
}

const VALID_SEVERITIES: readonly FactCheckSeverity[] = ['high', 'medium', 'low'];
const VALID_STATUSES: readonly FactCheckStatus[] = ['valid', 'warning', 'danger'];
const SEVERITY_PENALTY_DEFAULT: Record<FactCheckSeverity, number> = { high: 20, medium: 10, low: 5 };

function normalizeIssue(raw: unknown): FactCheckIssue | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const severity = VALID_SEVERITIES.includes(r.severity as FactCheckSeverity)
		? (r.severity as FactCheckSeverity)
		: 'medium';
	const type = String(r.type ?? '').trim();
	const description = String(r.description ?? '').trim();
	if (!type && !description) return null;
	return {
		severity,
		type: type || description.slice(0, 60),
		field: String(r.field ?? '').trim(),
		detected_value: String(r.detected_value ?? r.detectedValue ?? '').trim(),
		description: description || type,
		recommendation: String(r.recommendation ?? '').trim(),
	};
}

/** Validate + coerce whatever the LLM returned into a well-formed `FactCheckResult`. */
export function normalizeFactCheckResult(raw: unknown): FactCheckResult {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const issues = Array.isArray(r.issues)
		? r.issues.map(normalizeIssue).filter((x): x is FactCheckIssue => x !== null)
		: [];

	const penaltyTotal = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY_DEFAULT[issue.severity], 0);
	const reportedScore = Number(r.integrity_score ?? r.integrityScore);
	const integrity_score = clampScore(Number.isFinite(reportedScore) ? reportedScore : 100 - penaltyTotal);
	const status = VALID_STATUSES.includes(r.status as FactCheckStatus)
		? (r.status as FactCheckStatus)
		: deriveFactCheckStatus(integrity_score);

	return {
		integrity_score,
		status,
		summary:
			String(r.summary ?? '').trim() ||
			(issues.length ? '스키마와 사이트 실제 내용 간 불일치가 발견되었습니다.' : '스키마와 사이트 실제 내용이 일치합니다.'),
		issues,
	};
}

/** Deterministic, key-free fallback used when no LLM key is configured or the call fails. */
export function buildHeuristicFactCheck(
	context: FactCheckPageContext,
	schemaBlocks: readonly unknown[],
): FactCheckResult {
	const types = collectSchemaTypes(schemaBlocks);
	const siteHay = [context.title, context.metaDescription, ...context.h1, ...context.h2, context.bodySummary]
		.join(' ')
		.toLowerCase();

	const issues: FactCheckIssue[] = [];

	if (types.some((t) => /medicalbusiness|hospital|physician|medicalorganization/i.test(t))) {
		const hasMedicalHint = /병원|의원|진료|클리닉|치료|한의원|치과|동물병원|수의|clinic|hospital|medical/i.test(siteHay);
		if (!hasMedicalHint) {
			issues.push({
				severity: 'high',
				type: '업종/주제 불일치',
				field: '@type',
				detected_value: types.join(', '),
				description:
					'스키마는 의료 기관 유형이지만, 사이트 텍스트에서 의료 관련 근거를 찾지 못했습니다. (휴리스틱 판정 — LLM 미가동)',
				recommendation: '실제 업종에 맞는 스키마 유형과 진료/서비스 항목으로 교체하세요.',
			});
		}
	}

	const integrity_score = clampScore(100 - issues.reduce((s, i) => s + SEVERITY_PENALTY_DEFAULT[i.severity], 0));
	return {
		integrity_score,
		status: deriveFactCheckStatus(integrity_score),
		summary: 'LLM 키가 설정되지 않아 규칙 기반 약식 점검만 수행했습니다. 정밀 판정을 위해 OPENAI_API_KEY 또는 GEMINI_API_KEY를 설정하세요.',
		issues,
	};
}

/** LLM token-optimization util #4: robustly recover a JSON object even if the model wraps it in prose/markdown. */
export function extractJsonObjectFromText(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start >= 0 && end > start) {
			return JSON.parse(trimmed.slice(start, end + 1));
		}
		throw new Error('Model did not return JSON');
	}
}
