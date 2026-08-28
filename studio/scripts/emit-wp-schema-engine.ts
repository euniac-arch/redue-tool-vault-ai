/**
 * Emit the standalone WordPress MU-plugin to lib/solve/templates/redue-wp-schema.php.
 * Run: npx tsx scripts/emit-wp-schema-engine.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	buildWordpressSchemaEnginePhp,
	REDUE_WP_SCHEMA_ENGINE_VERSION,
} from '../lib/solve/wp-schema-engine';

const file = buildWordpressSchemaEnginePhp({ mode: 'mu-plugin' });
const dest = join(process.cwd(), 'lib/solve/templates/redue-wp-schema.php');
mkdirSync(join(process.cwd(), 'lib/solve/templates'), { recursive: true });
writeFileSync(dest, file, 'utf8');
console.log(dest, Buffer.byteLength(file), 'bytes', file.split('\n').length, 'lines', REDUE_WP_SCHEMA_ENGINE_VERSION);
