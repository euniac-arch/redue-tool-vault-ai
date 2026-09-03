'use client';

import { useEffect, useState } from 'react';

/** Elapsed seconds while `active`. Clears the interval on stop/unmount. */
export function useElapsedSeconds(active: boolean): number {
	const [elapsedTime, setElapsedTime] = useState(0);

	useEffect(() => {
		if (!active) {
			setElapsedTime(0);
			return;
		}
		const startedAt = Date.now();
		setElapsedTime(0);
		const id = window.setInterval(() => {
			setElapsedTime((Date.now() - startedAt) / 1000);
		}, 100);
		return () => window.clearInterval(id);
	}, [active]);

	return elapsedTime;
}
