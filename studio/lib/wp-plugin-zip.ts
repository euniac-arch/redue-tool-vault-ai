import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {
	WP_PLUGIN_MAIN,
	WP_PLUGIN_SLUG,
	buildPluginAssetSvg,
	buildPluginPhp,
	buildPluginReadme,
} from './wp-plugin-builder';

export interface BuiltPluginZip {
	fileName: string;
	absolutePath: string;
	buffer: Buffer;
	bytes: number;
}

function resolveApiBase(): string {
	return (
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
		process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
		'http://localhost:3000'
	);
}

/**
 * Build a WordPress.org-shaped plugin zip:
 * redue-ai-seo/redue-ai-seo.php, readme.txt, assets/icon.svg
 */
export async function buildWpPluginZip(): Promise<BuiltPluginZip> {
	const zip = new JSZip();
	const root = WP_PLUGIN_SLUG;
	const apiBase = resolveApiBase();

	zip.file(`${root}/${WP_PLUGIN_MAIN}`, buildPluginPhp(apiBase));
	zip.file(`${root}/readme.txt`, buildPluginReadme());
	zip.file(`${root}/assets/icon.svg`, buildPluginAssetSvg());
	zip.file(
		`${root}/assets/banner-note.txt`,
		'Place WordPress.org banner-772x250.png / banner-1544x500.png here for directory submission.\n'
	);

	const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

	const outDir = path.join(process.cwd(), '.data', 'builds');
	fs.mkdirSync(outDir, { recursive: true });
	const fileName = `${WP_PLUGIN_SLUG}-1.0.0.zip`;
	const absolutePath = path.join(outDir, fileName);
	fs.writeFileSync(absolutePath, buffer);

	return { fileName, absolutePath, buffer, bytes: buffer.byteLength };
}
