'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
	resolveIntelligenceTool,
	type IntelligenceTool,
} from '@/constants/aiIntelligenceTools';

export function useActiveIntelligenceTool(): IntelligenceTool {
	const pathname = usePathname() || '';
	const [hash, setHash] = useState('');

	useEffect(() => {
		const sync = () => setHash(window.location.hash || '');
		sync();
		window.addEventListener('hashchange', sync);
		return () => window.removeEventListener('hashchange', sync);
	}, [pathname]);

	return resolveIntelligenceTool(pathname, hash);
}
