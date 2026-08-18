/**
 * Deep logo resolution: schema → DOM img → inline SVG → manifest → probe → Clearbit.
 * Run: npx tsx scripts/test-extract-site-logo.ts
 */
import * as cheerio from 'cheerio';
import {
	extractDomImgLogo,
	extractInlineSvgLogo,
	extractSchemaLogo,
	extractSiteLogoUrl,
	pickManifestIconUrl,
	toAbsoluteLogoUrl,
} from '../lib/audit/extract-site-logo';
import { clearbitLogoUrl, googleFaviconV2Url, resolveReportLogoUrl } from '../lib/audit/logo-url';
import { resolveSiteLogo } from '../lib/audit/resolve-site-logo';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const PAGE = 'https://clinic.example.com/about';

function logoFrom(html: string): string | undefined {
	const $ = cheerio.load(html);
	return extractSiteLogoUrl($, PAGE);
}

assert(
	'relative path becomes absolute',
	toAbsoluteLogoUrl('/images/logo.png', PAGE) === 'https://clinic.example.com/images/logo.png',
);
assert(
	'protocol-relative uses page protocol',
	toAbsoluteLogoUrl('//cdn.example.com/brand.svg', PAGE) === 'https://cdn.example.com/brand.svg',
);
assert('data URI is rejected', toAbsoluteLogoUrl('data:image/png;base64,AAAA', PAGE) === null);

assert(
	'1순위: Organization.logo ImageObject.url',
	logoFrom(`
		<html><head>
		<script type="application/ld+json">
		{"@context":"https://schema.org","@type":"Organization","name":"예담","logo":{"@type":"ImageObject","url":"https://cdn.example.com/org-logo.png"}}
		</script>
		<meta property="og:image" content="https://cdn.example.com/og.jpg" />
		</head><body>
		<header><img alt="logo" src="/header-logo.png" /></header>
		</body></html>
	`) === 'https://cdn.example.com/org-logo.png',
);

assert(
	'1순위: LocalBusiness.logo 문자열 + 상대경로',
	logoFrom(`
		<html><head>
		<script type="application/ld+json">
		{"@context":"https://schema.org","@type":"LocalBusiness","name":"예담","logo":"/schema-logo.webp"}
		</script>
		</head></html>
	`) === 'https://clinic.example.com/schema-logo.webp',
);

assert(
	'1순위: MedicalBusiness.image 배열',
	logoFrom(`
		<html><head>
		<script type="application/ld+json">
		{"@context":"https://schema.org","@type":"MedicalBusiness","name":"예담","image":["/clinic-hero.jpg"]}
		</script>
		</head></html>
	`) === 'https://clinic.example.com/clinic-hero.jpg',
);

assert(
	'2순위: header img[alt*=logo] when schema missing',
	logoFrom(`
		<html><head>
		<meta property="og:image" content="https://cdn.example.com/og.jpg" />
		<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch.png" />
		</head><body>
		<header><a class="logo"><img alt="사이트 로고" src="/images/header-logo.png" /></a></header>
		</body></html>
	`) === 'https://clinic.example.com/images/header-logo.png',
);

assert(
	'3순위: apple-touch-icon 180x180',
	logoFrom(`
		<html><head>
		<link rel="icon" href="/favicon.ico" />
		<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-180.png" />
		<meta property="og:image" content="https://cdn.example.com/og.jpg" />
		</head><body></body></html>
	`) === 'https://clinic.example.com/apple-touch-180.png',
);

assert(
	'3순위: icon sizes=any after no apple-touch',
	logoFrom(`
		<html><head>
		<link rel="icon" sizes="any" href="/icon.svg" />
		<meta property="og:image" content="https://cdn.example.com/og.jpg" />
		</head></html>
	`) === 'https://clinic.example.com/icon.svg',
);

assert(
	'4순위: og:image',
	logoFrom(`
		<html><head>
		<meta property="og:image" content="/og-cover.jpg" />
		</head></html>
	`) === 'https://clinic.example.com/og-cover.jpg',
);

assert(
	'resolveReportLogoUrl prefers top-level logoUrl',
	resolveReportLogoUrl({
		logoUrl: 'https://cdn.example.com/stored.png',
		siteMeta: { logoUrl: 'https://cdn.example.com/meta.png', ogImage: '/og.jpg' },
	}) === 'https://cdn.example.com/stored.png',
);

assert(
	'resolveReportLogoUrl falls back to og:image for legacy reports',
	resolveReportLogoUrl({ siteMeta: { ogImage: 'https://cdn.example.com/legacy-og.jpg' } }) ===
		'https://cdn.example.com/legacy-og.jpg',
);

const svgHtml = `
	<html><body>
	<header>
		<a href="/"><svg class="logo" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg></a>
	</header>
	</body></html>
`;
const svgLogo = extractInlineSvgLogo(svgHtml, PAGE);
assert('3순위: inline SVG becomes data URI', Boolean(svgLogo?.startsWith('data:image/svg+xml;base64,')));
assert(
	'3순위: extractSiteLogoUrl prefers SVG over apple-touch',
	logoFrom(`
		<html><head>
		<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-180.png" />
		</head><body>${svgHtml}</body></html>
	`)?.startsWith('data:image/svg+xml;base64,') === true,
);

assert(
	'extractSchemaLogo wrapper',
	extractSchemaLogo(
		`<script type="application/ld+json">{"@type":"Organization","logo":"/brand.png"}</script>`,
		PAGE,
	) === 'https://clinic.example.com/brand.png',
);
assert(
	'extractDomImgLogo wrapper',
	extractDomImgLogo(`<header><img class="site-logo" src="/dom.png" alt="로고" /></header>`, PAGE) ===
		'https://clinic.example.com/dom.png',
);

assert(
	'manifest prefers 512 then 192',
	pickManifestIconUrl(
		{
			icons: [
				{ src: '/icon-48.png', sizes: '48x48' },
				{ src: '/icon-192.png', sizes: '192x192' },
				{ src: '/icon-512.png', sizes: '512x512' },
			],
		},
		PAGE,
	) === 'https://clinic.example.com/icon-512.png',
);

assert(
	'Clearbit URL uses registrable host',
	clearbitLogoUrl('www.Clinic.Example.com') === 'https://logo.clearbit.com/clinic.example.com',
);
assert(
	'Google Favicon V2 uses origin + 128px',
	googleFaviconV2Url(PAGE) ===
		`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAV&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent('https://clinic.example.com')}&size=128`,
);

async function runAsyncChecks() {
	const resolvedSchema = await resolveSiteLogo(
		`<script type="application/ld+json">{"@type":"Organization","logo":"https://cdn.example.com/deep.png"}</script>`,
		PAGE,
		'clinic.example.com',
		{ skipNetwork: true },
	);
	assert('resolveSiteLogo step 1 short-circuits', resolvedSchema === 'https://cdn.example.com/deep.png');

	const resolvedFallback = await resolveSiteLogo('<html></html>', PAGE, 'clinic.example.com', {
		skipNetwork: true,
	});
	assert(
		'resolveSiteLogo final fallback is Google Favicon V2',
		resolvedFallback === googleFaviconV2Url(PAGE),
	);
}

void runAsyncChecks().then(() => {
	if (failed > 0) {
		console.error(`\n${failed} assertion(s) failed`);
		process.exit(1);
	}
	console.log('\nall extract-site-logo checks passed');
});
