import type { ReactNode } from 'react';

type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'tag' | 'key';

const TOKEN_CLASS: Record<TokenKind, string> = {
	plain: 'text-slate-100',
	comment: 'italic text-slate-500',
	string: 'text-amber-200',
	keyword: 'text-sky-300',
	tag: 'text-fuchsia-300',
	key: 'text-cyan-300',
};

const TOKEN_RE =
	/(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#(?![A-Za-z0-9_\/])[^\n]*|'[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"|<\?php|\?>|<\/?[A-Za-z][^>\n]*>|\b(?:if|else|elseif|return|function|echo|exit|defined|define|isset|empty|class_exists|method_exists|function_exists|add_event|add_action|class|new)\b)/g;

const JSON_KEY_RE =
	/^"(@(?:context|graph|type|id)|name|url|telephone|address|sameAs|openingHours|knowsAbout|makesOffer|founder|employee|jobTitle|worksFor|itemOffered|publisher|inLanguage|streetAddress|addressLocality|addressRegion|addressCountry)"$/;

function kindFor(token: string): TokenKind {
	if (token.startsWith('<!--') || token.startsWith('/*') || token.startsWith('//') || token.startsWith('#')) {
		return 'comment';
	}
	if (token === '<?php' || token === '?>' || token.startsWith('<')) return 'tag';
	if (JSON_KEY_RE.test(token)) return 'key';
	if (token.startsWith("'") || token.startsWith('"')) return 'string';
	return 'keyword';
}

function tokenizeLine(line: string): Array<{ kind: TokenKind; value: string }> {
	const tokens: Array<{ kind: TokenKind; value: string }> = [];
	let last = 0;
	TOKEN_RE.lastIndex = 0;
	for (const match of line.matchAll(TOKEN_RE)) {
		const value = match[0];
		const index = match.index ?? 0;
		if (index > last) tokens.push({ kind: 'plain', value: line.slice(last, index) });
		tokens.push({ kind: kindFor(value), value });
		last = index + value.length;
	}
	if (last < line.length) tokens.push({ kind: 'plain', value: line.slice(last) });
	if (tokens.length === 0) tokens.push({ kind: 'plain', value: ' ' });
	return tokens;
}

export function HighlightedInjectionCode({ code }: { code: string }): ReactNode {
	const lines = code.replace(/\n$/, '').split('\n');
	return (
		<pre className="m-0 min-h-[22rem] overflow-auto bg-[#0b1220] p-0 text-[12.5px] leading-6 text-slate-100 dark:bg-[#070b14]">
			<code className="block min-w-max font-mono">
				{lines.map((line, lineIndex) => (
					<div key={`line-${lineIndex}`} className="flex hover:bg-white/[0.04]">
						<span
							className="sticky left-0 w-11 shrink-0 select-none border-r border-white/10 bg-[#0b1220] pr-3 text-right text-[11px] text-slate-500 dark:bg-[#070b14]"
							aria-hidden
						>
							{lineIndex + 1}
						</span>
						<span className="whitespace-pre px-4">
							{tokenizeLine(line).map((token, tokenIndex) => (
								<span key={`t-${lineIndex}-${tokenIndex}`} className={TOKEN_CLASS[token.kind]}>
									{token.value}
								</span>
							))}
						</span>
					</div>
				))}
			</code>
		</pre>
	);
}
