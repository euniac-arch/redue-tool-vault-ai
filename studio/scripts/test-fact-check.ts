/**
 * Smoke test: AI schema fact-check context extraction, cache keys, and
 * LLM-response normalization (no network / API keys required).
 */
import {
	buildFactCheckPageContext,
	buildFactCheckUserPrompt,
	buildHeuristicFactCheck,
	collectSchemaTypes,
	computeFactCheckCacheKey,
	deriveFactCheckStatus,
	extractSchemaBlocks,
	getIntegrityStatus,
	normalizeFactCheckResult,
} from '../lib/audit/fact-check';
import { buildCleanSchemaBlocks, formatCleanSchemaAsScriptTag } from '../lib/audit/fact-check-clean-schema';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

// A vet clinic site with a hallucinated "cancer hospital" schema injected.
const html = `<!DOCTYPE html><html><head>
<title>행복동물병원 | 강아지 고양이 진료</title>
<meta name="description" content="행복동물병원은 강아지, 고양이 진료와 건강검진을 제공합니다." />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Hospital",
  "name": "국제암센터 행복병원",
  "knowsAbout": ["전립선암", "중입자치료"],
  "telephone": "02-1234-5678",
  "employee": { "@type": "Person", "name": "인사말" }
}
</script>
</head><body>
<header><nav>소개 진료과목 오시는길</nav></header>
<div class="sub_content">
  <h1>강아지 고양이 진료 안내</h1>
  <h2>예방접종</h2>
  <h3>건강검진</h3>
  <p>행복동물병원은 강아지와 고양이를 위한 예방접종, 건강검진, 중성화 수술을 제공하는 동물병원입니다.</p>
</div>
<footer>저작권</footer>
</body></html>`;
const url = 'https://example-vet.test/';

const context = buildFactCheckPageContext(html, url);
assert(context.title.includes('행복동물병원'), 'title extracted');
assert(context.h1.some((h) => h.includes('강아지')), 'h1 extracted from content scope');
assert(context.h2.includes('예방접종'), 'h2 extracted');
assert(context.h3.includes('건강검진'), 'h3 extracted');
assert(context.bodySummary.includes('동물병원'), 'body summary extracted');
assert(!context.bodySummary.includes('저작권'), 'footer chrome excluded from body summary');

const schemaBlocks = extractSchemaBlocks(html);
assert(schemaBlocks.length === 1, `expected 1 schema block, got ${schemaBlocks.length}`);

const types = collectSchemaTypes(schemaBlocks);
assert(types.includes('Hospital'), 'schema type parsed');

const keyA = computeFactCheckCacheKey(url, schemaBlocks);
const keyB = computeFactCheckCacheKey(url, schemaBlocks);
assert(keyA === keyB, 'cache key is deterministic for same url+schema');
const keyDifferentSchema = computeFactCheckCacheKey(url, [{ '@type': 'Organization', name: 'x' }]);
assert(keyA !== keyDifferentSchema, 'cache key changes when schema changes');

const prompt = buildFactCheckUserPrompt(context, schemaBlocks);
assert(prompt.includes('행복동물병원'), 'prompt includes site text');
assert(prompt.includes('Hospital'), 'prompt includes schema JSON');

assert(deriveFactCheckStatus(100) === 'valid', '100 -> valid');
assert(deriveFactCheckStatus(95) === 'valid', '95 -> valid');
assert(deriveFactCheckStatus(94) === 'warning', '94 -> warning');
assert(deriveFactCheckStatus(70) === 'warning', '70 -> warning');
assert(deriveFactCheckStatus(69) === 'danger', '69 -> danger');

const perfect = getIntegrityStatus(100);
assert(perfect.grade === 'PERFECT' && perfect.status === '완벽 정합', '100 -> 완벽 정합');
assert(perfect.color === '#10B981' && perfect.icon === '🟢', '100 uses emerald + green dot');

const excellent95 = getIntegrityStatus(95);
assert(excellent95.grade === 'EXCELLENT' && excellent95.status === '우수 정합', '95 -> 우수 정합, not 완벽 정합');
assert(excellent95.icon === '🟢', '95 still renders 🟢 우수 정합');
assert(getIntegrityStatus(90).grade === 'EXCELLENT', '90 -> EXCELLENT');

const good = getIntegrityStatus(89);
assert(good.grade === 'GOOD' && good.status === '양호 정합', '89 -> 양호 정합');
assert(good.color === '#F59E0B' && good.icon === '🟡', '70s-80s use amber');
assert(getIntegrityStatus(70).grade === 'GOOD', '70 -> GOOD');

const warning = getIntegrityStatus(69);
assert(warning.grade === 'WARNING' && warning.status === '주의 필요', '69 -> 주의 필요');
assert(warning.color === '#F97316' && warning.icon === '🟠', '50s-60s use orange');
assert(getIntegrityStatus(50).grade === 'WARNING', '50 -> WARNING');

const critical = getIntegrityStatus(49);
assert(critical.grade === 'CRITICAL' && critical.status === '정합 불량', '49 -> 정합 불량');
assert(critical.color === '#EF4444' && critical.icon === '🔴', '<50 uses red');
assert(getIntegrityStatus(0).grade === 'CRITICAL', '0 -> CRITICAL');

// The heuristic fallback is intentionally coarse (real semantic judgement is the LLM's
// job) — it only flags a medical schema type when the site text has *zero* medical
// vocabulary at all. "동물병원" still contains "병원", so it counts as a hint here;
// exercise the coarse fallback against a site with no medical vocabulary whatsoever.
const bakeryContext = buildFactCheckPageContext(
	`<html><head><title>행복베이커리 | 수제빵 전문점</title></head><body><div class="sub_content"><h1>수제빵 소개</h1><p>매일 아침 정성으로 굽는 수제빵과 케이크를 판매합니다.</p></div></body></html>`,
	'https://example-bakery.test/',
);
const heuristic = buildHeuristicFactCheck(bakeryContext, schemaBlocks);
assert(heuristic.integrity_score < 100, `heuristic should dock points, got ${heuristic.integrity_score}`);
assert(heuristic.status !== 'valid', 'heuristic status reflects the deduction');
assert(heuristic.issues[0]?.type === '업종/주제 불일치', 'heuristic flags bakery site vs Hospital schema mismatch');

const normalized = normalizeFactCheckResult({
	integrity_score: 42,
	status: 'danger',
	summary: '업종 불일치와 대표자명 오류가 발견되었습니다.',
	issues: [
		{
			severity: 'high',
			type: '업종/주제 불일치',
			field: 'knowsAbout',
			detected_value: '전립선암, 중입자치료',
			description: '동물병원 사이트에 인체 암 치료 스키마가 주입됨',
			recommendation: '반려동물 진료 과목으로 교체하세요.',
		},
		{
			severity: 'medium',
			type: '대표자 표기 오류',
			field: 'employee / representative',
			detected_value: '인사말',
			description: "employee.name이 '인사말'로 등록됨",
			recommendation: '실제 원장님 성함으로 수정하세요.',
		},
	],
});
assert(normalized.integrity_score === 42, 'normalized keeps reported score');
assert(normalized.status === 'danger', 'normalized keeps reported status');
assert(normalized.issues.length === 2, 'normalized keeps both issues');
assert(normalized.issues[0]?.field === 'knowsAbout', 'field path preserved');
assert(normalized.issues[0]?.detected_value === '전립선암, 중입자치료', 'detected_value preserved');

const malformed = normalizeFactCheckResult({
	issues: [{ type: '알수없는 이슈', severity: 'bogus', scorePenalty: 20 }],
});
assert(malformed.integrity_score === 90, `malformed input still scores deterministically, got ${malformed.integrity_score}`);
assert(malformed.status === 'warning', 'status derived from clamped score when LLM omits it');
assert(malformed.issues[0]?.severity === 'medium', 'invalid severity coerced to medium default');

const empty = normalizeFactCheckResult({ issues: [{ severity: 'bogus' }] });
assert(empty.issues.length === 0, 'issue without type/description is dropped');
assert(empty.integrity_score === 100 && empty.status === 'valid', 'score stays 100/valid when no valid issues remain');

// Step 3: best-effort "clean JSON-LD" removal, keyed off the LLM's free-form `field` string.
const { cleaned, removedFields } = buildCleanSchemaBlocks(schemaBlocks, normalized.issues);
assert(removedFields.includes('knowsAbout'), 'knowsAbout field marked as removed');
assert(removedFields.includes('employee / representative'), 'multi-token field ("employee / representative") matched via its first token');
const cleanedNode = cleaned[0] as Record<string, unknown>;
assert(!('knowsAbout' in cleanedNode), 'knowsAbout actually stripped from clean copy');
assert(!('employee' in cleanedNode), 'employee actually stripped from clean copy');
assert(cleanedNode.name === '국제암센터 행복병원', 'unrelated fields survive the strip');
const scriptTag = formatCleanSchemaAsScriptTag(cleaned);
assert(scriptTag.startsWith('<script type="application/ld+json">'), 'clean copy wrapped in a script tag');
assert(!scriptTag.includes('knowsAbout'), 'script tag output excludes removed field');
// Original input must stay untouched (deep clone, not mutation).
assert('knowsAbout' in (schemaBlocks[0] as Record<string, unknown>), 'source schemaBlocks left untouched');

console.log('OK fact-check', {
	schemaTypes: types,
	cacheKeySample: keyA.slice(0, 12),
	heuristicScore: heuristic.integrity_score,
	promptTokensApprox: Math.ceil(prompt.length / 4),
});
