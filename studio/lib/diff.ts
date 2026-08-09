import { diffLines } from 'diff';
import type { DiffLineModel } from './types';

/**
 * Build a line-level diff model (used by <DiffViewer />) between the file
 * content before and after injection.
 */
export function buildDiffModel(before: string, after: string): DiffLineModel[] {
	const parts = diffLines(before, after);
	const model: DiffLineModel[] = [];

	let oldLineNumber = 1;
	let newLineNumber = 1;

	for (const part of parts) {
		// diffLines keeps the trailing newline in each chunk; splitting on
		// "\n" then dropping a possible trailing empty entry gives us clean
		// per-line content instead of an extra blank row.
		const lines = part.value.split('\n');
		if (lines[lines.length - 1] === '') {
			lines.pop();
		}

		for (const line of lines) {
			if (part.added) {
				model.push({ type: 'add', content: line, oldLineNumber: null, newLineNumber });
				newLineNumber += 1;
			} else if (part.removed) {
				model.push({ type: 'remove', content: line, oldLineNumber, newLineNumber: null });
				oldLineNumber += 1;
			} else {
				model.push({ type: 'context', content: line, oldLineNumber, newLineNumber });
				oldLineNumber += 1;
				newLineNumber += 1;
			}
		}
	}

	return model;
}
