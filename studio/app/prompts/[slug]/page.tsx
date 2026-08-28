import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { InsightsHubTabs } from '@/components/insights/InsightsHubTabs';
import { PromptDetailView } from '@/components/prompt-hub/PromptDetailView';
import { PageListLoader } from '@/components/ui/PageListLoader';
import { REDUE_SITE_ORIGIN } from '@/lib/schema';
import { getPromptBySlug, getPromptHref, loadPrompts } from '@/lib/prompt-hub';

type PromptDetailPageProps = {
	params: { slug: string };
};

export function generateStaticParams() {
	return loadPrompts().map((prompt) => ({ slug: prompt.slug }));
}

export function generateMetadata({ params }: PromptDetailPageProps): Metadata {
	const prompt = getPromptBySlug(params.slug);
	if (!prompt) {
		return { title: 'AI 프롬프트 | REDUE' };
	}
	const title = `${prompt.title} | AI 프롬프트 허브 | REDUE`;
	const url = `${REDUE_SITE_ORIGIN}${getPromptHref(prompt.slug)}`;
	return {
		title,
		description: prompt.description,
		alternates: { canonical: url },
		openGraph: {
			title,
			description: prompt.description,
			url,
			type: 'article',
		},
	};
}

export default function PromptDetailPage({ params }: PromptDetailPageProps) {
	const prompt = getPromptBySlug(params.slug);
	if (!prompt) notFound();

	const pageUrl = `${REDUE_SITE_ORIGIN}${getPromptHref(prompt.slug)}`;
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		headline: prompt.title,
		description: prompt.description,
		url: pageUrl,
		articleSection: prompt.category.toUpperCase(),
		keywords: prompt.tags.join(', '),
		inLanguage: 'ko',
		isAccessibleForFree: true,
		about: prompt.purpose,
		text: prompt.prompt,
	};

	return (
		<div className="flex min-h-full flex-col bg-transparent">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			<div className="flex w-full items-center justify-center bg-transparent">
				<Suspense fallback={null}>
					<InsightsHubTabs />
				</Suspense>
			</div>
			<div className="flex flex-1 flex-col bg-transparent pt-8">
				<Suspense fallback={<PageListLoader label={prompt.title} />}>
					<PromptDetailView prompt={prompt} />
				</Suspense>
			</div>
		</div>
	);
}
