'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';

export const FIELD_INPUT_CLASS =
	'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-white/10';

const ICON_BTN =
	'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100';

interface SecretKeyFieldProps {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	hint?: string;
	masked?: boolean;
	copyable?: boolean;
	autoComplete?: string;
	mono?: boolean;
}

export function SecretKeyField({
	id,
	label,
	value,
	onChange,
	placeholder,
	hint,
	masked = true,
	copyable = true,
	autoComplete = 'off',
	mono = true,
}: SecretKeyFieldProps) {
	const [visible, setVisible] = useState(false);
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	const showAsText = !masked || visible;
	const trailingCount = Number(masked) + Number(copyable);

	return (
		<label className="flex flex-col gap-1.5" htmlFor={id}>
			<span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
			<div className="relative">
				<input
					id={id}
					type={showAsText ? 'text' : 'password'}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					autoComplete={autoComplete}
					spellCheck={false}
					className={`${FIELD_INPUT_CLASS} ${mono ? 'font-mono text-[13px]' : ''} ${
						trailingCount > 0 ? (trailingCount === 2 ? 'pr-[4.5rem]' : 'pr-11') : ''
					}`}
				/>
				{trailingCount > 0 ? (
					<div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
						{masked ? (
							<button
								type="button"
								className={ICON_BTN}
								onClick={() => setVisible((prev) => !prev)}
								aria-label={visible ? '키 숨기기' : '키 표시'}
								title={visible ? '키 숨기기' : '키 표시'}
							>
								{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						) : null}
						{copyable ? (
							<button
								type="button"
								className={ICON_BTN}
								onClick={handleCopy}
								disabled={!value}
								aria-label={copied ? '복사됨' : '클립보드에 복사'}
								title={copied ? '복사됨' : '복사'}
							>
								{copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
							</button>
						) : null}
					</div>
				) : null}
			</div>
			{hint ? <span className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</span> : null}
		</label>
	);
}
