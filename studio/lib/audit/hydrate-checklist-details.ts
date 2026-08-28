import type { AuditCheckItem, AuditMetrics } from '@/lib/site-auditor';
import type { CrawledPageMeta } from '@/lib/audit/crawl-page-metas';
import type { H1ElementDetail, HeadingSkipDetail, ImageAltIssue } from '@/lib/audit/extractors/heading-alt-details';
import { normalizeImageAltIssues, toMissingImageRow } from '@/lib/audit/extractors/heading-alt-details';

function h1ElementsFromTexts(texts: string[] | undefined): H1ElementDetail[] {
	if (!texts?.length) return [];
	return texts.map((text, index) => ({ text, selector: '', index: index + 1 }));
}

function skipsFromExamples(examples: string[] | undefined): HeadingSkipDetail[] {
	if (!examples?.length) return [];
	return examples.flatMap((example) => {
		const match = example.match(/h(\d)\s*→\s*h(\d)/i);
		if (!match) return [];
		return [
			{
				from: `H${match[1]}`,
				to: `H${match[2]}`,
				text: '',
				selector: '',
			},
		];
	});
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Pull missing-alt rows from every alias a stored report may have used. */
export function collectBoundImageAltIssues(
	item?: AuditCheckItem | null,
	metrics?: AuditMetrics | null,
	pageMetas?: CrawledPageMeta[] | null,
): ImageAltIssue[] {
	const itemRec = asRecord(item);
	const metricsRec = asRecord(metrics);
	const fromItem = normalizeImageAltIssues(
		item?.imageAltIssues ||
			item?.missing_images ||
			item?.missing_alt_list ||
			item?.details?.missing_images ||
			itemRec?.missing_alt_images,
	);
	if (fromItem.length) return fromItem;

	const fromMetrics = normalizeImageAltIssues(
		metrics?.imageAltIssues ||
			metrics?.missing_images ||
			metrics?.missing_alt_list ||
			metrics?.details?.missing_images ||
			metricsRec?.missing_alt_images,
	);
	if (fromMetrics.length) return fromMetrics;

	const fromPages: ImageAltIssue[] = [];
	for (const page of pageMetas || []) {
		fromPages.push(
			...normalizeImageAltIssues(
				page.imageAltIssues || page.missing_images || (page as { missing_alt_images?: unknown }).missing_alt_images,
			),
		);
	}
	return fromPages;
}

/** Re-attach pinpoint arrays from metrics when stored checklist rows dropped them. */
export function hydrateChecklistDetails(
	item: AuditCheckItem,
	metrics?: AuditMetrics | null,
	pageMetas?: CrawledPageMeta[] | null,
): AuditCheckItem {
	if (item.id === 'image-alt') {
		const imageAltIssues = collectBoundImageAltIssues(item, metrics, pageMetas);
		if (
			imageAltIssues.length &&
			(!item.imageAltIssues?.length ||
				!item.missing_images?.length ||
				item.imagesTotal == null ||
				item.imageAltCoveragePct == null)
		) {
			const missing_images = imageAltIssues.map((issue) => toMissingImageRow(issue));
			return {
				...item,
				imageAltIssues,
				missing_images,
				missing_alt_list: missing_images,
				details: { missing_images },
				imagesTotal: item.imagesTotal ?? metrics?.imagesTotal,
				imagesMissingAlt: item.imagesMissingAlt ?? missing_images.length,
				imageAltCoveragePct: item.imageAltCoveragePct ?? metrics?.imageAltCoveragePct,
			};
		}
	}
	if (!metrics) return item;
	if (
		item.id === 'render-blocking' &&
		!item.renderBlockingScriptItems?.length &&
		metrics.renderBlockingScriptItems?.length
	) {
		return { ...item, renderBlockingScriptItems: metrics.renderBlockingScriptItems };
	}
	if (item.id === 'single-h1' && !item.h1Elements?.length) {
		const h1Elements = metrics.h1Elements?.length
			? metrics.h1Elements
			: h1ElementsFromTexts(metrics.h1Texts);
		if (h1Elements.length) return { ...item, h1Elements };
	}
	if (item.id === 'heading-skip') {
		const headingSkips =
			item.headingSkips?.length
				? item.headingSkips
				: metrics.headingSkips?.length
					? metrics.headingSkips
					: skipsFromExamples(metrics.headingSkipExamples);
		const headingOutline = item.headingOutline?.length ? item.headingOutline : metrics.headingOutline;
		if (headingSkips !== item.headingSkips || headingOutline !== item.headingOutline) {
			return { ...item, headingSkips, headingOutline };
		}
	}
	return item;
}

export function hydrateChecklistItems(
	items: AuditCheckItem[],
	metrics?: AuditMetrics | null,
	pageMetas?: CrawledPageMeta[] | null,
): AuditCheckItem[] {
	return items.map((item) => hydrateChecklistDetails(item, metrics, pageMetas));
}
