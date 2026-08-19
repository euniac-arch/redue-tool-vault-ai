'use client';

import { useTranslations } from 'next-intl';
import {
	ChatGptGlyph,
	ClaudeGlyph,
	ClovaGlyph,
	CopilotGlyph,
	GeminiGlyph,
	PerplexityGlyph,
} from '@/components/audit/AiEngineIcons';
import { LANDING_CARD } from '@/components/landing/landing-ui';
import { StoryHeading } from '@/components/landing/StoryHeading';

const LIVE_ENGINES = [
	{ id: 'chatgpt', name: 'ChatGPT', sub: 'OpenAI', Glyph: ChatGptGlyph },
	{ id: 'perplexity', name: 'Perplexity', sub: 'Perplexity AI', Glyph: PerplexityGlyph },
	{ id: 'gemini', name: 'Gemini', sub: 'Google', Glyph: GeminiGlyph },
	{ id: 'claude', name: 'Claude', sub: 'Anthropic', Glyph: ClaudeGlyph },
] as const;

const PROXY_ENGINES = [
	{ id: 'copilot', name: 'Copilot', sub: 'Microsoft · Bing', Glyph: CopilotGlyph },
	{ id: 'clova', name: 'Naver Cue:', sub: 'Naver · Clova', Glyph: ClovaGlyph },
] as const;

function EngineCard({
	name,
	sub,
	Glyph,
	badge,
	tone,
}: {
	name: string;
	sub: string;
	Glyph: (typeof LIVE_ENGINES)[number]['Glyph'];
	badge: string;
	tone: 'live' | 'proxy';
}) {
	const badgeClass =
		tone === 'live'
			? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
			: 'border-blue-500/20 bg-blue-500/10 text-blue-300';

	return (
		<li className={`${LANDING_CARD} flex flex-col items-center gap-2 px-2 py-4 text-center`}>
			<span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-600/20 text-cyan-200">
				<Glyph className="h-5 w-5" />
			</span>
			<p className="text-[13px] font-bold text-slate-100">{name}</p>
			<p className="text-[11px] text-slate-500">{sub}</p>
			<span
				className={`inline-flex max-w-full items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${badgeClass}`}
			>
				{badge}
			</span>
		</li>
	);
}

export function EngineCompatibility() {
	const t = useTranslations('landing.story.engines');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<StoryHeading kicker={t('kicker')} title={t('title')} subtitle={t('subtitle')} />

				<div className="mt-8">
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<p className="text-xs font-semibold text-slate-200 sm:text-sm">{t('liveGroup')}</p>
						<span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
							{t('liveBadge')}
						</span>
					</div>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{LIVE_ENGINES.map(({ id, name, sub, Glyph }) => (
							<EngineCard key={id} name={name} sub={sub} Glyph={Glyph} badge={t('live')} tone="live" />
						))}
					</ul>
				</div>

				<div className="mt-8">
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<p className="text-xs font-semibold text-slate-200 sm:text-sm">{t('proxyGroup')}</p>
						<span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
							{t('proxyBadge')}
						</span>
					</div>
					<ul className="grid grid-cols-2 gap-3">
						{PROXY_ENGINES.map(({ id, name, sub, Glyph }) => (
							<EngineCard key={id} name={name} sub={sub} Glyph={Glyph} badge={t('proxy')} tone="proxy" />
						))}
					</ul>
				</div>

				<p className="mt-5 break-keep text-[11px] leading-relaxed text-slate-500 sm:text-xs">{t('disclaimer')}</p>
			</div>
		</section>
	);
}
