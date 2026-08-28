import type { ReactNode } from 'react';

const MARK =
	'rounded-[3px] border border-slate-400 bg-transparent px-1.5 py-0.5 text-inherit dark:border-white/40';

export function keywordTokens(keyword: string): string[] {
	return keyword
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

export function parseFaqPair(text: string): { question: string; answer: string } | null {
	const match = (text || '').replace(/\r\n/g, '\n').match(/Q\.\s*([\s\S]+?)\s*A\.\s*([\s\S]+)/i);
	if (!match) return null;
	return { question: match[1].trim(), answer: match[2].trim() };
}

export function formatFaqDisplay(question: string, answer?: string): string {
	const parsed = parseFaqPair(question) || parseFaqPair(`Q. ${question}${answer ? ` A. ${answer}` : ''}`);
	if (parsed) return `Q. ${parsed.question}\n\nA. ${parsed.answer}`;
	if (answer) return `Q. ${question.replace(/^Q\.\s*/i, '')}\n\nA. ${answer.replace(/^A\.\s*/i, '')}`;
	return question;
}

export function readableRefineText(text: string): string {
	return (text || '')
		.replace(/\r\n/g, '\n')
		.replace(/(WHY|WHAT|HOW|IMPACT|TITLE|H1|H2|FAQ|ANSWER|META)\s*[:：]\s*/gi, '\n$1: ')
		.replace(/\s+(ENTITY|LOCAL|CONTENT|AEO|TRUST|SCHEMA)\s+GAP\s*[:：]\s*/gi, '\n\n$1 GAP: ')
		.replace(/\s+A\.\s+/g, '\n\nA. ')
		.replace(/\s+Q\.\s+/g, '\nQ. ')
		.replace(/^(Q\.)\s*/i, 'Q. ')
		.replace(/(다\.|요\.|니다\.|까\.|까\?)/g, '$1\n')
		.replace(/([.!?])\s+(?=[가-힣A-Z0-9])/g, '$1\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function TargetKeywordMarks({
	keyword,
	className = '',
}: {
	keyword: string;
	className?: string;
}) {
	const tokens = keywordTokens(keyword);
	if (!tokens.length) return <span className={className}>{keyword}</span>;
	return (
		<span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
			{tokens.map((token, index) => (
				<mark key={`${token}-${index}`} className={`${MARK} font-semibold not-italic`}>
					{token}
				</mark>
			))}
		</span>
	);
}

export function highlightKeywordMarks(text: string, keyword: string): ReactNode {
	const tokens = [...keywordTokens(keyword)].sort((a, b) => b.length - a.length);
	if (!tokens.length) return text;
	const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
	const parts = text.split(pattern);
	const lower = new Set(tokens.map((token) => token.toLowerCase()));
	return parts.map((part, index) =>
		lower.has(part.toLowerCase()) ? (
			<mark key={`${part}-${index}`} className={MARK}>
				{part}
			</mark>
		) : (
			part
		),
	);
}
