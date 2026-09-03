export function normalizeAsiName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '')
		.replace(/[()[\]{}·•.,'"“”]/g, '');
}

export function brandNeedles(brand: string, extras: readonly string[] = []): string[] {
	const raw = [brand, ...extras].map((item) => item.trim()).filter(Boolean);
	const needles = new Set<string>();
	for (const item of raw) {
		const folded = normalizeAsiName(item);
		if (folded.length >= 2) needles.add(folded);
		const noLegal = folded.replace(
			/(의원|병원|클리닉|치과|한의원|호텔|리조트|법률사무소|법무법인|로펌|식당|레스토랑|쇼핑몰|백화점|마트|주식회사|clinic|hospital|hotel|resort|law firm|restaurant|mall|inc\.?|corp\.?|ltd\.?|llc)$/i,
			'',
		);
		if (noLegal.length >= 2) needles.add(noLegal);
	}
	return [...needles];
}

export function nameMatchesBrand(name: string, brand: string, aliases: readonly string[] = []): boolean {
	const hay = normalizeAsiName(name);
	if (!hay) return false;
	return brandNeedles(brand, aliases).some((needle) => hay.includes(needle) || needle.includes(hay));
}

export function textMentionsBrand(text: string, brand: string, aliases: readonly string[] = []): boolean {
	const hay = normalizeAsiName(text);
	if (!hay) return false;
	return brandNeedles(brand, aliases).some((needle) => hay.includes(needle));
}
