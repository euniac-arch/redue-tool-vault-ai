export type AsiFilterArrowKey = 'ArrowLeft' | 'ArrowRight';

/** Wrap around the first/last filter so arrow keys never stall. */
export function nextAsiFilterIndex(
	current: number,
	key: AsiFilterArrowKey,
	length: number,
): number {
	if (length <= 0) return 0;
	if (current < 0) return 0;
	if (key === 'ArrowRight') return (current + 1) % length;
	return (current - 1 + length) % length;
}
