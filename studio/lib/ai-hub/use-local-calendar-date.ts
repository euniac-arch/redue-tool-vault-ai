'use client';

import { useEffect, useState } from 'react';
import { getCalendarDateKey, msUntilNextLocalMidnight } from '@/lib/ai-hub/getDailyAiRanking';

/** Local calendar day that advances automatically at midnight. */
export function useLocalCalendarDate(): Date {
	const [date, setDate] = useState(() => new Date());

	const dateKey = getCalendarDateKey(date);

	useEffect(() => {
		let timeoutId = 0;
		const arm = (from: Date) => {
			timeoutId = window.setTimeout(() => {
				const next = new Date();
				setDate(next);
				arm(next);
			}, msUntilNextLocalMidnight(from));
		};
		arm(new Date());
		return () => window.clearTimeout(timeoutId);
	}, [dateKey]);

	return date;
}
