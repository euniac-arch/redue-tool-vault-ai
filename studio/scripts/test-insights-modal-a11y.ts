/**
 * Insights modal a11y contracts — shared hook reuse, dialog names, no per-modal trap copy.
 * Run: npx tsx scripts/test-insights-modal-a11y.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`);
}

const root = process.cwd();
const hook = readFileSync(join(root, 'lib/ui/use-modal-a11y.ts'), 'utf8');
const lock = readFileSync(join(root, 'components/insights/InsightsAiLockModal.tsx'), 'utf8');
const youtube = readFileSync(join(root, 'components/insights/YouTubeModal.tsx'), 'utf8');

assert('shared hook traps Tab', hook.includes("event.key !== 'Tab'") && hook.includes('shiftKey'));
assert('shared hook closes on Escape', hook.includes("event.key === 'Escape'"));
assert('shared hook restores trigger focus', hook.includes('previous?.isConnected') && hook.includes('previous.focus()'));
assert('shared hook locks background', hook.includes('lockBackground') && hook.includes('inert'));
assert('shared hook focuses the dialog', hook.includes('panel.focus()'));

for (const [name, src] of [
	['InsightsAiLockModal', lock],
	['YouTubeModal', youtube],
] as const) {
	assert(`${name} reuses useModalA11y`, src.includes("from '@/lib/ui/use-modal-a11y'") && src.includes('useModalA11y('));
	assert(`${name} does not copy a local keydown trap`, !/addEventListener\(\s*['"]keydown['"]/.test(src));
	assert(`${name} is a modal dialog`, src.includes('role="dialog"') && src.includes('aria-modal="true"'));
	assert(`${name} has an accessible name`, src.includes('aria-labelledby='));
	assert(`${name} considers reduced motion`, src.includes('motion-reduce:'));
}

assert('lock modal names the quota copy', lock.includes('aria-describedby="insights-ai-lock-desc"'));
assert('youtube modal names the channel', youtube.includes('aria-describedby="youtube-player-channel"'));
assert('youtube embed respects reduced motion', youtube.includes('prefers-reduced-motion') && youtube.includes('autoplay='));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall insights modal a11y assertions passed');
