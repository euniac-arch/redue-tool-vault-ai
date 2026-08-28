/**
 * FAQ / HowTo content extractor — Q&A accordion, definition lists, Q./A. prose.
 */

import type { CheerioAPI } from 'cheerio';
import type { FaqQaItem, HowToStepSpec } from '@/lib/solve/core/eeat-citation';

const FAQ_SCOPE_SELECTORS = [
	'.faq',
	'.faq-list',
	'.faq_list',
	'.accordion',
	'[class*="faq"]',
	'[id*="faq"]',
	'dl.faq',
	'.qna',
	'.qa-list',
].join(', ');

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function pushQa(out: FaqQaItem[], q: string, a: string, seen: Set<string>): void {
	const question = compact(q).replace(/^[Qq]\s*[.).:]?\s*/, '');
	const answer = compact(a).replace(/^[Aa]\s*[.).:]?\s*/, '');
	if (question.length < 4 || answer.length < 4) return;
	if (question.length > 160 || answer.length > 400) return;
	const key = question.slice(0, 80);
	if (seen.has(key)) return;
	seen.add(key);
	out.push({ q: question, a: answer });
}

export function extractFaqItemsFromHtml($: CheerioAPI, html?: string): FaqQaItem[] {
	const out: FaqQaItem[] = [];
	const seen = new Set<string>();

	$(FAQ_SCOPE_SELECTORS).each((_, el) => {
		const $scope = $(el);
		$scope.find('dt').each((i, dt) => {
			const q = compact($(dt).text());
			const a = compact($scope.find('dd').eq(i).text());
			pushQa(out, q, a, seen);
		});
		$scope.find('details').each((_, det) => {
			pushQa(out, $(det).find('summary').first().text(), $(det).text().replace($(det).find('summary').first().text(), ''), seen);
		});
		$scope.find('.question, .q, .faq-q, h3, h4, strong').each((_, qEl) => {
			const q = compact($(qEl).text());
			const a = compact($(qEl).next('.answer, .a, .faq-a, p').text());
			pushQa(out, q, a, seen);
		});
	});

	const prose = compact(html || $('body').text() || '');
	const qaPairs = prose.matchAll(/(?:Q|질문)\s*[.).:]?\s*([^\n]{6,80})\s*(?:A|답변)\s*[.).:]?\s*([^\n]{8,200})/gi);
	for (const hit of qaPairs) {
		pushQa(out, hit[1] || '', hit[2] || '', seen);
		if (out.length >= 8) break;
	}
	return out.slice(0, 8);
}

export function extractHowToStepsFromHtml($: CheerioAPI): HowToStepSpec[] {
	const steps: HowToStepSpec[] = [];
	$('ol li, .step, .howto-step, [class*="step"]').each((i, el) => {
		if (steps.length >= 6) return;
		const text = compact($(el).text());
		if (text.length < 6 || text.length > 180) return;
		steps.push({
			position: steps.length + 1,
			name: text.slice(0, 40),
			text,
		});
	});
	return steps;
}
