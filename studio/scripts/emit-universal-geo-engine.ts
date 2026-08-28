/**
 * Emit the standalone Universal GEO Engine client SDK to public/universal-geo-engine.js.
 * Run: npx tsx scripts/emit-universal-geo-engine.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildUniversalGeoEngineJs, UNIVERSAL_GEO_ENGINE_VERSION } from '../lib/solve/universal-geo-engine';

const header = `/*!
 * REDUE Universal GEO Engine ${UNIVERSAL_GEO_ENGINE_VERSION}
 * Client-side Schema Injector — auto-extracts taxID / fax / representative / telephone /
 * streetAddress from the page footer and injects Organization + WebSite + WebPage +
 * BreadcrumbList + Person JSON-LD. Also inserts <link rel="help" href="/llms.txt">.
 * Install (hosted): <script src="https://<your-redue-domain>/universal-geo-engine.js" defer></script>
 * Optional overrides (set before this script): window.REDUE_CONFIG = { orgType, name, logo,
 * telephone, taxID, faxNumber, streetAddress, latitude, longitude, sameAs, services,
 * repName, repTitle, pageType, enableAutoDetect }
 * Backward compatible: window.__REDUE_GEO_CONFIG__ is still read and merged.
 *
 * GENERATED FILE — do not edit directly. Source: lib/solve/universal-geo-engine.ts
 * Regenerate: npx tsx scripts/emit-universal-geo-engine.ts
 */
`;

const file = `${header}${buildUniversalGeoEngineJs()}`;

const dest = join(process.cwd(), 'public/universal-geo-engine.js');
mkdirSync(join(process.cwd(), 'public'), { recursive: true });
writeFileSync(dest, file, 'utf8');
console.log(dest, Buffer.byteLength(file), 'bytes', file.split('\n').length, 'lines');
