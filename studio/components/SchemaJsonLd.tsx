import Script from 'next/script';
import { buildSchemaJsonLd, type SchemaJsonLdConfig } from '@/lib/schema/jsonld';

type SchemaJsonLdProps = {
	config: SchemaJsonLdConfig;
	id?: string;
};

/**
 * Drop-in Next.js helper — render in `app/layout.tsx` (or any page `<head>`).
 *
 * ```tsx
 * import { SchemaJsonLd } from '@/components/SchemaJsonLd';
 * import { REDUE_SITE_SCHEMA } from '@/lib/schema';
 *
 * <SchemaJsonLd id="site-schema-jsonld" config={REDUE_SITE_SCHEMA} />
 * ```
 */
export function SchemaJsonLd({ config, id = 'schema-jsonld' }: SchemaJsonLdProps) {
	const jsonLd = buildSchemaJsonLd(config);
	return (
		<Script
			id={id}
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
		/>
	);
}
