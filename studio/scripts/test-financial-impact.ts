/**
 * Score-band financial framing: amount bands + copy type.
 * Run: npx tsx scripts/test-financial-impact.ts
 */
import { getFinancialImpact, isOpportunityCost } from '../lib/audit/financial-impact';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail ? ` — ${detail}` : ''}`);
}

function amount(score: number): number {
	return getFinancialImpact(score).amount;
}

assert('48 → LOSS', getFinancialImpact(48).type === 'LOSS');
assert('48 amount 460000', amount(48) === 460_000, String(amount(48)));
assert('48 is opportunity cost', isOpportunityCost(getFinancialImpact(48).type));
assert('48 ko headline', getFinancialImpact(48, 'ko').mainText.includes('460,000'));
assert('48 rose theme', getFinancialImpact(48).badgeColor.includes('rose'));

assert('64 → LOSS', getFinancialImpact(64).type === 'LOSS');
assert('65 → RECOVERABLE_LOSS', getFinancialImpact(65).type === 'RECOVERABLE_LOSS');
assert('65 amount 260000', amount(65) === 260_000, String(amount(65)));
assert('79 amount 160000', amount(79) === 160_000, String(amount(79)));
assert('79 amber theme', getFinancialImpact(79).badgeColor.includes('amber'));

assert('80 → UPSIDE', getFinancialImpact(80).type === 'UPSIDE');
assert('80 amount 1680000', amount(80) === 1_680_000, String(amount(80)));
assert('80 not opportunity cost', !isOpportunityCost(getFinancialImpact(80).type));
assert('89 emerald theme', getFinancialImpact(89).badgeColor.includes('emerald'));
assert('89 ko headline', getFinancialImpact(89, 'ko').mainText.includes('광고 대체 가치'));

assert('90 → PROTECTED', getFinancialImpact(90).type === 'PROTECTED');
assert('90 amount 2880000', amount(90) === 2_880_000, String(amount(90)));
assert('100 amount 3200000', amount(100) === 3_200_000, String(amount(100)));
assert('94 indigo theme', getFinancialImpact(94).badgeColor.includes('indigo'));
assert('94 ko headline', getFinancialImpact(94, 'ko').mainText.includes('광고비 방어'));

assert('clamp NaN → LOSS', getFinancialImpact(Number.NaN).type === 'LOSS');
assert('clamp 140 → PROTECTED', getFinancialImpact(140).type === 'PROTECTED');
assert('en upside copy', getFinancialImpact(85, 'en').mainText.includes('ad-equivalent'));

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('financial-impact ok');
