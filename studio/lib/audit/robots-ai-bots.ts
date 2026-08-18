/**
 * Parse robots.txt for the four AI-training / answer-engine crawlers
 * used by the E-E-A-T Digital Footprint panel.
 *
 * Specific User-agent groups win over `User-agent: *`. A bot is blocked
 * only when the winning group Disallow-matches `/` more specifically than
 * any Allow. `Disallow: /admin` does not count as a site-wide block.
 */

import { AI_CRAWLER_BOT_IDS, type AiCrawlerBotId } from '@/types/geo-diagnostic';

export type AiBotAccessMap = Record<AiCrawlerBotId, boolean>;

const BOT_ALIASES: Record<AiCrawlerBotId, readonly string[]> = {
	gptbot: ['gptbot', 'chatgpt-user', 'oai-searchbot'],
	perplexitybot: ['perplexitybot', 'perplexity-user'],
	claudebot: ['claudebot', 'anthropic-ai', 'claude-web'],
	'google-extended': ['google-extended'],
};

interface RobotsRule {
	allow: boolean;
	path: string;
}

interface RobotsGroup {
	agents: string[];
	rules: RobotsRule[];
}

function stripComment(line: string): string {
	const hash = line.indexOf('#');
	return (hash === -1 ? line : line.slice(0, hash)).trim();
}

export function parseRobotsGroups(robotsText: string): RobotsGroup[] {
	const groups: RobotsGroup[] = [];
	let current: RobotsGroup | null = null;

	for (const raw of (robotsText || '').replace(/\r/g, '\n').split('\n')) {
		const line = stripComment(raw);
		if (!line) continue;

		const ua = line.match(/^user-agent\s*:\s*(.+)$/i);
		if (ua) {
			const agent = ua[1].trim().toLowerCase();
			if (!agent) continue;
			if (current && current.rules.length > 0) {
				groups.push(current);
				current = { agents: [agent], rules: [] };
			} else if (current) {
				current.agents.push(agent);
			} else {
				current = { agents: [agent], rules: [] };
			}
			continue;
		}

		const allow = line.match(/^allow\s*:\s*(.*)$/i);
		const disallow = line.match(/^disallow\s*:\s*(.*)$/i);
		if (!allow && !disallow) continue;
		if (!current) current = { agents: ['*'], rules: [] };
		const path = (allow ? allow[1] : disallow![1]).trim();
		current.rules.push({ allow: Boolean(allow), path });
	}

	if (current) groups.push(current);
	return groups;
}

/** Longest-match rule for `/`. Empty Disallow is a no-op (allow). */
export function isRootDisallowed(rules: readonly RobotsRule[]): boolean {
	let best: { allow: boolean; len: number } | null = null;
	for (const rule of rules) {
		if (!rule.path) continue;
		const matchesRoot = rule.path === '/' || rule.path === '/*';
		if (!matchesRoot) continue;
		const len = rule.path.length;
		if (!best || len > best.len || (len === best.len && rule.allow)) {
			best = { allow: rule.allow, len };
		}
	}
	return best ? !best.allow : false;
}

function groupsForBot(groups: readonly RobotsGroup[], aliases: readonly string[]): RobotsGroup[] {
	const specific = groups.filter((g) => g.agents.some((a) => aliases.includes(a)));
	if (specific.length) return specific;
	return groups.filter((g) => g.agents.includes('*'));
}

/**
 * `true` = crawl allowed. Missing / empty robots.txt → all four allowed.
 */
export function parseAiBotAccessFromRobots(robotsText: string): AiBotAccessMap {
	const groups = parseRobotsGroups(robotsText);
	const access = {} as AiBotAccessMap;
	for (const id of AI_CRAWLER_BOT_IDS) {
		const applicable = groupsForBot(groups, BOT_ALIASES[id]);
		if (!applicable.length) {
			access[id] = true;
			continue;
		}
		access[id] = !isRootDisallowed(applicable.flatMap((g) => g.rules));
	}
	return access;
}

export function toBotAccessibility(access: AiBotAccessMap): {
	gptBot: boolean;
	perplexityBot: boolean;
	claudeBot: boolean;
	googleExtended: boolean;
} {
	return {
		gptBot: access.gptbot,
		perplexityBot: access.perplexitybot,
		claudeBot: access.claudebot,
		googleExtended: access['google-extended'],
	};
}

/**
 * Category 5 (`ai-bots-allowed`) and the GEO bot pillar must use the same
 * rule: GPTBot, PerplexityBot, ClaudeBot, and Google-Extended are all allowed.
 * Missing robots.txt / unknown access → allowed (same as the parser default).
 */
export function resolveAiBotsAllowed(
	access?: Partial<Record<AiCrawlerBotId, boolean>> | null,
	checklistAllowed?: boolean | null,
): boolean {
	const known = AI_CRAWLER_BOT_IDS.filter((id) => access && access[id] !== undefined);
	if (known.length > 0) {
		return AI_CRAWLER_BOT_IDS.every((id) => access?.[id] !== false);
	}
	if (checklistAllowed != null) return checklistAllowed;
	return true;
}
