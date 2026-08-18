import {
	parsePageSpeedPayload,
	formatImageInsight,
	formatKiB,
	estimateFontCdnSavingsBytes,
} from '../lib/audit/pagespeed.ts';
import { buildPageSpeedPrescription } from '../lib/audit/pagespeed-prescription.ts';

const payload = {
	lighthouseResult: {
		lighthouseVersion: '12.0.0',
		categories: {
			performance: { score: 0.42 },
			accessibility: { score: 0.9 },
			'best-practices': { score: 0.7 },
			seo: { score: 0.95 },
		},
		audits: {
			'largest-contentful-paint': { numericValue: 4200, displayValue: '4.2 s' },
			'first-contentful-paint': { numericValue: 1800, displayValue: '1.8 s' },
			'total-blocking-time': { numericValue: 450, displayValue: '450 ms' },
			'cumulative-layout-shift': { numericValue: 0.12, displayValue: '0.12' },
			'uses-optimized-images': {
				details: {
					items: [
						{
							url: 'https://ex.com/img/img-main-about.png',
							totalBytes: 1_186_700,
							wastedBytes: 1_130_600,
							node: {
								snippet: '<img src="/img/img-main-about.png" alt="About hero">',
							},
						},
					],
				},
			},
			'uses-webp-images': {
				details: {
					items: [
						{
							url: 'https://ex.com/img/img-main-about.png',
							totalBytes: 1_186_700,
							wastedBytes: 900_000,
						},
					],
				},
			},
			'properly-size-images': {
				details: {
					items: [
						{
							url: 'https://ex.com/img/img-main-about.png',
							totalBytes: 1_186_700,
							wastedBytes: 400_000,
						},
					],
				},
			},
			'uses-long-cache-ttl': {
				details: {
					overallSavingsBytes: 10_002_432,
					items: [
						{
							url: 'https://ex.com/css/app.css',
							cacheLifetimeMs: 0,
							totalBytes: 120_000,
							wastedBytes: 120_000,
						},
						{
							url: 'https://ex.com/js/app.js',
							cacheLifetimeMs: 3_600_000,
							totalBytes: 800_000,
							wastedBytes: 400_000,
						},
						{
							url: 'https://ex.com/fonts/NanumSquareRoundR.woff2',
							cacheLifetimeMs: 604_800_000,
							totalBytes: 259_788,
							wastedBytes: 25_978,
						},
					],
				},
			},
			// Lighthouse 12+ insight aliases (should not double-count when legacy keys exist)
			'image-delivery-insight': {
				displayValue: 'Est savings of 1,104.1 KiB',
				details: {
					items: [
						{
							url: 'https://ex.com/img/extra-insight-only.png',
							totalBytes: 500_000,
							wastedBytes: 400_000,
							subItems: {
								type: 'subitems',
								items: [
									{
										reason:
											'Using a modern image format (WebP, AVIF) or increasing the image compression could improve this image\'s download size.',
										wastedBytes: 300_000,
									},
									{
										reason:
											'This image file is larger than it needs to be (800x600) for its displayed dimensions (400x300). Use responsive images to reduce the image download size.',
										wastedBytes: 200_000,
									},
								],
							},
							node: {
								snippet: '<img src="/img/extra-insight-only.png" alt="Insight hero">',
							},
						},
					],
				},
			},
			'cache-insight': {
				displayValue: 'Est savings of 9,308 KiB',
				details: {
					items: [],
				},
			},
			'largest-contentful-paint-element': {
				details: {
					items: [
						{
							type: 'table',
							items: [
								{
									node: {
										snippet: '<img src="/images/mv1.jpg" loading="lazy" alt="Logo">',
										selector: 'header > img',
										nodeLabel: 'mv1.jpg',
									},
								},
							],
						},
					],
				},
			},
			'bootup-time': {
				details: {
					items: [
						{
							url: 'https://www.youtube.com/iframe_api',
							total: 420,
							scripting: 380,
							scriptParseCompile: 40,
						},
						{
							url: 'https://cdn.jsdelivr.net/npm/lib.js',
							total: 210,
							scripting: 180,
							scriptParseCompile: 30,
						},
						{
							url: 'https://ex.com/js/app.js',
							total: 90,
							scripting: 70,
							scriptParseCompile: 20,
						},
						{
							url: 'https://ex.com/js/jquery-1.12.4.min.js',
							total: 120,
							scripting: 90,
							scriptParseCompile: 20,
						},
						{
							url: 'https://code.jquery.com/jquery-3.5.1.min.js',
							total: 110,
							scripting: 80,
							scriptParseCompile: 15,
						},
					],
				},
			},
			'render-blocking-resources': {
				details: {
					items: [
						{
							url: 'https://ex.com/js/jquery-ui.js',
							totalBytes: 128_900,
							wastedMs: 3390,
						},
						{
							url: 'https://ex.com/js/swiper.js',
							totalBytes: 200_000,
							wastedMs: 800,
						},
					],
				},
			},
			'unused-javascript': {
				details: {
					items: [
						{
							url: 'https://ex.com/js/jquery-ui.js?v=3',
							totalBytes: 128_900,
							wastedBytes: 80_000,
						},
					],
				},
			},
			'font-display': {
				details: {
					items: [
						{ url: 'https://ex.com/fonts/NanumSquareRoundR.woff2' },
						{ url: 'https://ex.com/fonts/empty-no-size.woff2' },
					],
				},
			},
			'mainthread-work-breakdown': {
				details: {
					items: [
						{
							group: 'scriptEvaluation',
							groupLabel: 'Script Evaluation',
							duration: 800,
						},
						{ group: 'styleLayout', groupLabel: 'Style & Layout', duration: 220 },
					],
				},
			},
		},
	},
};

const snap = parsePageSpeedPayload(payload, { url: 'https://ex.com/', strategy: 'mobile' });
const rx = buildPageSpeedPrescription(snap);

const checks = [
	snap.images.length === 2,
	snap.images[0]?.reasons.includes('compression'),
	snap.images[0]?.reasons.includes('modern-format'),
	snap.images[0]?.reasons.includes('responsive-size'),
	snap.images[0]?.label === 'About hero',
	snap.images.some(
		(img) =>
			img.fileName === 'extra-insight-only.png' &&
			img.reasons.includes('modern-format') &&
			img.reasons.includes('responsive-size') &&
			img.reasons.includes('compression'),
	),
	(snap.cacheResources?.length ?? 0) === 3,
	snap.cacheResources?.[0]?.ttlLabel === 'None',
	formatKiB(snap.cacheTotalWastedBytes) === '9,768 KiB',
	snap.lcpElement?.hasLazyLoading === true,
	snap.lcpElement?.missingFetchPriority === true,
	snap.lcpElement?.label === 'mv1.jpg',
	snap.lcpElement?.src === '/images/mv1.jpg',
	snap.scriptExecution.some((s) => s.origin === 'third-party'),
	snap.scriptExecution.some((s) => s.origin === 'first-party'),
	snap.mainThreadWork.length === 2,
	snap.renderBlocking.some(
		(r) => r.fileName === 'jquery-ui.js' && r.wastedBytes === 80_000 && r.wastedMs === 3390,
	),
	snap.renderBlocking.some(
		(r) => r.fileName === 'swiper.js' && r.wastedBytes === 70_000 && r.wastedMs === 800,
	),
	snap.fonts.some((f) => f.fileName === 'NanumSquareRoundR.woff2' && f.bytes === 259_788),
	snap.fonts.every((f) => f.fileName !== 'empty-no-size.woff2'),
	snap.fonts.some(
		(f) =>
			f.fileName === 'NanumSquareRoundR.woff2' &&
			f.cdnSavingsBytes === estimateFontCdnSavingsBytes(259_788, 'NanumSquareRoundR.woff2'),
	),
	rx.lcpImagePath === '/images/mv1.jpg',
	rx.lcpWebpPath === '/images/mv1.webp',
	rx.blockingScriptName === 'jquery-ui.js',
	rx.blockingScriptPath === '/js/jquery-ui.js',
	rx.duplicateJquery?.versions.includes('1.12.4') === true,
	rx.duplicateJquery?.versions.includes('3.5.1') === true,
];

console.log(
	JSON.stringify(
		{
			ok: checks.every(Boolean),
			checks,
			insight: snap.images[0]?.insight,
			insightSample: formatImageInsight({
				fileName: 'img-main-about.png',
				bytes: 1_186_700,
				wastedBytes: 1_130_600,
				reasons: ['responsive-size', 'modern-format', 'compression'],
			}),
			lcp: snap.lcpElement,
			scripts: snap.scriptExecution.map((s) => ({
				file: s.fileName,
				origin: s.origin,
				ms: s.totalMs,
			})),
			blocking: snap.renderBlocking,
			fonts: snap.fonts,
			prescription: rx,
		},
		null,
		2,
	),
);

if (!checks.every(Boolean)) process.exit(1);
