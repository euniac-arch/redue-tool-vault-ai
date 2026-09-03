export function hashSeed(value: string): number {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function series(seed: number, salt: number): number {
	return hashSeed(`${seed}:${salt}`);
}

export function mockScore(seed: number, salt: number, min: number, max: number): number {
	return min + (series(seed, salt) % (max - min + 1));
}

export function mockPick<T>(seed: number, salt: number, items: readonly T[]): T {
	return items[series(seed, salt) % items.length]!;
}
