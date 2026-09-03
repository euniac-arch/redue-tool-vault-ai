/**
 * Sequential tsx runner for catalog groups. A failed file fails the group.
 * Usage: node scripts/run-tests.mjs [group]
 */
import { spawn } from 'node:child_process';
import { DEFAULT_GROUPS, TEST_GROUPS } from './test-catalog.mjs';

const requested = (process.argv[2] || '').trim();
const groups = requested
	? requested.split(',').map((item) => item.trim()).filter(Boolean)
	: DEFAULT_GROUPS;

if (requested && groups.some((name) => !TEST_GROUPS[name])) {
	const unknown = groups.filter((name) => !TEST_GROUPS[name]).join(', ');
	console.error(`Unknown test group: ${unknown}`);
	console.error(`Available: ${Object.keys(TEST_GROUPS).join(', ')}`);
	process.exit(1);
}

function runFile(file) {
	return new Promise((resolve) => {
		const child = spawn('npx', ['tsx', file], {
			stdio: 'inherit',
			shell: true,
			env: process.env,
		});
		child.on('exit', (code) => resolve(code ?? 1));
		child.on('error', () => resolve(1));
	});
}

const results = [];

for (const group of groups) {
	const files = TEST_GROUPS[group];
	console.log(`\n== ${group} (${files.length}) ==`);
	for (const file of files) {
		console.log(`\n--- ${file} ---`);
		const code = await runFile(file);
		results.push({ group, file, ok: code === 0, code });
		if (code !== 0) {
			console.error(`FAIL ${file} (exit ${code})`);
		}
	}
}

const failed = results.filter((row) => !row.ok);
console.log('\n==========');
for (const row of results) {
	console.log(`${row.ok ? 'ok  ' : 'FAIL'} [${row.group}] ${row.file}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
	process.exit(1);
}
