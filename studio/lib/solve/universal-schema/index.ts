/**
 * Universal Schema Injection Engine
 *
 * SiteFactExtractor → SchemaTemplateBuilder → CmsInjectionAdapter → LocalAndFtpDeployer
 * Facts that were not parsed from the live site are omitted. No placeholders.
 */

import { extractSiteFacts } from '@/lib/solve/universal-schema/site-fact-extractor';
import { buildSchemaTemplatesForSite } from '@/lib/solve/universal-schema/schema-template-builder';
import {
	describeCmsInjection,
	planUniversalCmsInjection,
	type UniversalInjectionPlan,
} from '@/lib/solve/universal-schema/cms-injection-adapter';
import type { BuiltSchemaTemplate, ExtractedSiteFacts, SiteFactExtractorInput } from '@/lib/solve/universal-schema/types';

export type { DetectedSiteCms, ExtractedSiteFacts, SiteFactExtractorInput, BuiltSchemaTemplate } from '@/lib/solve/universal-schema/types';
export { extractSiteFacts, detectSiteCms } from '@/lib/solve/universal-schema/site-fact-extractor';
export { buildSchemaTemplate, buildSchemaTemplatesForSite, renderSchemaMetaHtml } from '@/lib/solve/universal-schema/schema-template-builder';
export {
	planUniversalCmsInjection,
	buildStaticHtmlHeadBlock,
	injectStaticHtmlHead,
	describeCmsInjection,
} from '@/lib/solve/universal-schema/cms-injection-adapter';
export {
	REDUE_SIBLING_BACKUP_SUFFIX,
	siblingBackupPath,
	hasRedueStudioMarker,
	preparePatchedSource,
	deployLocalWorkspace,
	deployViaFtp,
	plansToDeployTargets,
} from '@/lib/solve/universal-schema/local-and-ftp-deployer';

export type UniversalSchemaEngineResult = {
	facts: ExtractedSiteFacts;
	templates: BuiltSchemaTemplate[];
	plans: UniversalInjectionPlan[];
	cmsNote: string;
};

export function runUniversalSchemaEngine(input: SiteFactExtractorInput): UniversalSchemaEngineResult {
	const facts = extractSiteFacts(input);
	const templates = buildSchemaTemplatesForSite(facts);
	const plans = planUniversalCmsInjection({
		facts,
		templates,
		htmlTargets: (input.pages || []).map((page) => page.filePath).filter((path): path is string => Boolean(path)),
	});
	return {
		facts,
		templates,
		plans,
		cmsNote: describeCmsInjection(facts.cms),
	};
}
