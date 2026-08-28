'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';

interface UserAvatarProps {
	src: string;
	name: string;
	size?: number;
}

/** Profile avatar with a graceful fallback for missing/broken image URLs. */
export function UserAvatar({ src, name, size = 32 }: UserAvatarProps) {
	const [broken, setBroken] = useState(false);
	const dimension = `${size}px`;

	if (!src || broken) {
		return (
			<span
				className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-500 dark:ring-slate-700"
				style={{ width: dimension, height: dimension }}
				aria-hidden
			>
				<UserRound className="h-1/2 w-1/2" strokeWidth={1.75} />
			</span>
		);
	}

	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt={`${name} 프로필 이미지`}
			width={size}
			height={size}
			className="rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
			style={{ width: dimension, height: dimension }}
			onError={() => setBroken(true)}
			loading="lazy"
		/>
	);
}
