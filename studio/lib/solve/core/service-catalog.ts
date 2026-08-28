/**
 * Shared service / procedure catalog slot — PHP (GnuBoard / YoungCart /
 * Rhymix / WordPress) and JS/React all bind the same structure.
 *
 * Empty catalog → omit `hasOfferCatalog` and `availableService` entirely.
 * Never emit `[]` / `{}` placeholders.
 */

export const SERVICE_CATALOG_NAME = '주요 서비스 및 진료 카탈로그';

export const MEDICAL_SCHEMA_ORG_TYPES = [
	'MedicalClinic',
	'Physician',
	'Hospital',
	'Dentist',
	'VeterinaryCare',
	'Pharmacy',
	'MedicalBusiness',
] as const;

export type ServiceCatalogItemType = 'MedicalProcedure' | 'Service';

/** Site-owner input slot — matches `$redue_service_catalog` rows. */
export type ServiceCatalogItem = {
	name: string;
	category?: string;
	description?: string;
	type?: string;
	url?: string;
	'@type'?: string;
	itemOffered?: { name?: string };
};

export type ServiceCatalogSeed =
	| string
	| ServiceCatalogItem
	| {
			'@type'?: string;
			name?: string;
			category?: string;
			description?: string;
			type?: string;
			url?: string;
			itemOffered?: { name?: string };
	  };

export type NormalizedServiceNode = {
	'@type': ServiceCatalogItemType;
	name: string;
	category?: string;
	description?: string;
	url?: string;
};

export type OfferCatalogNode = {
	'@type': 'OfferCatalog';
	name: typeof SERVICE_CATALOG_NAME;
	itemListElement: Array<{ '@type': 'Offer'; itemOffered: NormalizedServiceNode }>;
};

export type ServiceCatalogHost = {
	availableService?: NormalizedServiceNode[];
	hasOfferCatalog?: OfferCatalogNode;
	[key: string]: unknown;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function isMedicalSchemaType(types: unknown): boolean {
	const list = Array.isArray(types) ? types : types == null ? [] : [types];
	for (const raw of list) {
		const type = String(raw || '');
		if ((MEDICAL_SCHEMA_ORG_TYPES as readonly string[]).includes(type)) return true;
	}
	return false;
}

export function resolveServiceItemType(
	explicit: string | null | undefined,
	orgTypes?: unknown,
): ServiceCatalogItemType {
	const raw = compact(explicit);
	if (raw === 'MedicalProcedure' || raw === 'Service') return raw;
	return isMedicalSchemaType(orgTypes) ? 'MedicalProcedure' : 'Service';
}

function readSeedName(item: ServiceCatalogSeed): string {
	if (typeof item === 'string') return compact(item);
	if (!item || typeof item !== 'object') return '';
	const direct = compact(item.name);
	if (direct) return direct;
	return compact(item.itemOffered?.name);
}

function readSeedType(item: ServiceCatalogSeed): string {
	if (typeof item === 'string' || !item || typeof item !== 'object') return '';
	return compact(item.type) || compact(item['@type']);
}

export function normalizeServiceCatalog(
	raw: readonly ServiceCatalogSeed[] | null | undefined,
	orgTypes?: unknown,
): NormalizedServiceNode[] {
	const out: NormalizedServiceNode[] = [];
	const seen = new Set<string>();
	if (!Array.isArray(raw) || raw.length === 0) return out;

	for (const item of raw) {
		const name = readSeedName(item);
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		const node: NormalizedServiceNode = {
			'@type': resolveServiceItemType(readSeedType(item), orgTypes),
			name,
		};
		if (item && typeof item === 'object') {
			const category = compact(item.category);
			const description = compact(item.description);
			const url = compact(item.url);
			if (category) node.category = category;
			if (description) node.description = description;
			if (url) node.url = url;
		}
		out.push(node);
	}
	return out;
}

export function buildOfferCatalog(services: readonly NormalizedServiceNode[]): OfferCatalogNode | undefined {
	if (!services.length) return undefined;
	return {
		'@type': 'OfferCatalog',
		name: SERVICE_CATALOG_NAME,
		itemListElement: services.map((item) => ({ '@type': 'Offer' as const, itemOffered: item })),
	};
}

/**
 * Append & merge: bind dual catalog keys only when the slot has valid rows.
 * Empty / undefined input unsets both keys so JSON-LD matches the pre-catalog output.
 */
export function mergeServiceCatalog<T extends ServiceCatalogHost>(
	schema: T,
	raw: readonly ServiceCatalogSeed[] | null | undefined,
	orgTypes?: unknown,
): T {
	const services = normalizeServiceCatalog(raw, orgTypes ?? schema['@type']);
	if (!services.length) {
		delete schema.availableService;
		delete schema.hasOfferCatalog;
		return schema;
	}
	schema.availableService = services;
	const catalog = buildOfferCatalog(services);
	if (catalog) schema.hasOfferCatalog = catalog;
	return schema;
}

export function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function phpServiceCatalogLiteral(services: readonly NormalizedServiceNode[]): string {
	if (!services.length) return 'array()';
	const rows = services.map((service) => {
		const parts = [
			`'name' => ${phpSingleQuoted(service.name)}`,
			`'type' => ${phpSingleQuoted(service['@type'])}`,
		];
		if (service.category) parts.push(`'category' => ${phpSingleQuoted(service.category)}`);
		if (service.description) parts.push(`'description' => ${phpSingleQuoted(service.description)}`);
		if (service.url) parts.push(`'url' => ${phpSingleQuoted(service.url)}`);
		return `\tarray(${parts.join(', ')})`;
	});
	return `array(\n${rows.join(',\n')}\n)`;
}

/** Top-of-file `$redue_service_catalog` slot — empty comments stay omitted at runtime. */
export function buildServiceCatalogSlotPhp(catalogLiteral: string): string {
	return `/* 서비스·진료과목 카탈로그 — 유효 항목이 있을 때만 hasOfferCatalog / availableService 병합 (No-Fake-Data).
 * $redue_service_catalog = array(
 *     array(
 *         'name'        => '정밀 맞춤 진단',
 *         'category'    => '진단 및 분석',
 *         'description' => '환자별 맞춤형 진단 솔루션',
 *         'type'        => 'MedicalProcedure', // 미지정 시 메인 @type에 따라 자동 분기
 *     ),
 * );
 */
$redue_service_catalog = ${catalogLiteral};
$GLOBALS['redue_service_catalog'] = $redue_service_catalog;`;
}

/**
 * Runtime PHP shared by GnuBoard / YoungCart / Rhymix / standalone injectors.
 * Guard clauses: undefined / empty / [] never create catalog keys.
 */
export function buildServiceCatalogRuntimePhp(): string {
	const medicalList = MEDICAL_SCHEMA_ORG_TYPES.map((t) => `'${t}'`).join(', ');
	return `	if ( ! function_exists( 'redue_is_medical_schema_type' ) ) {
		function redue_is_medical_schema_type( $types ) {
			if ( is_string($types) ) { $types = array($types); }
			if ( ! is_array($types) ) { return false; }
			$_med = array(${medicalList});
			foreach ( $types as $_t ) {
				if ( in_array((string) $_t, $_med, true) ) { return true; }
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_resolve_service_item_type' ) ) {
		function redue_resolve_service_item_type( $explicit, $is_medical = false ) {
			$_raw = is_string($explicit) ? trim($explicit) : '';
			if ( $_raw === 'MedicalProcedure' || $_raw === 'Service' ) { return $_raw; }
			return $is_medical ? 'MedicalProcedure' : 'Service';
		}
	}
	if ( ! function_exists( 'redue_resolve_service_catalog_source' ) ) {
		function redue_resolve_service_catalog_source() {
			if ( isset($GLOBALS['redue_service_catalog']) && is_array($GLOBALS['redue_service_catalog']) && count($GLOBALS['redue_service_catalog']) > 0 ) {
				return $GLOBALS['redue_service_catalog'];
			}
			if ( isset($GLOBALS['redue_services']) && is_array($GLOBALS['redue_services']) && count($GLOBALS['redue_services']) > 0 ) {
				return $GLOBALS['redue_services'];
			}
			return array();
		}
	}
	if ( ! function_exists( 'redue_normalize_service_nodes' ) ) {
		function redue_normalize_service_nodes( $services, $is_medical = false ) {
			$out = array();
			if ( ! is_array($services) || count($services) === 0 ) { return $out; }
			$_seen = array();
			foreach ( $services as $_svc ) {
				if ( is_string($_svc) ) {
					$_name = trim($_svc);
					if ( $_name === '' ) { continue; }
					$_key = strtolower($_name);
					if ( isset($_seen[$_key]) ) { continue; }
					$_seen[$_key] = true;
					$out[] = array('@type' => redue_resolve_service_item_type('', $is_medical), 'name' => $_name);
					continue;
				}
				if ( ! is_array($_svc) ) { continue; }
				$_name = '';
				if ( ! empty($_svc['name']) ) { $_name = trim((string) $_svc['name']); }
				elseif ( ! empty($_svc['itemOffered']) && is_array($_svc['itemOffered']) && ! empty($_svc['itemOffered']['name']) ) {
					$_name = trim((string) $_svc['itemOffered']['name']);
				}
				if ( $_name === '' ) { continue; }
				$_key = strtolower($_name);
				if ( isset($_seen[$_key]) ) { continue; }
				$_seen[$_key] = true;
				$_explicit = '';
				if ( ! empty($_svc['type']) && is_string($_svc['type']) ) { $_explicit = trim($_svc['type']); }
				elseif ( ! empty($_svc['@type']) && is_string($_svc['@type']) ) { $_explicit = trim((string) $_svc['@type']); }
				$_node = array(
					'@type' => redue_resolve_service_item_type($_explicit, $is_medical),
					'name' => $_name,
				);
				if ( ! empty($_svc['category']) && is_string($_svc['category']) && trim($_svc['category']) !== '' ) {
					$_node['category'] = trim($_svc['category']);
				}
				if ( ! empty($_svc['description']) && is_string($_svc['description']) && trim($_svc['description']) !== '' ) {
					$_node['description'] = trim($_svc['description']);
				}
				if ( ! empty($_svc['url']) && is_string($_svc['url']) ) {
					$_node['url'] = function_exists('redue_align_url_protocol')
						? redue_align_url_protocol($_svc['url'])
						: $_svc['url'];
				}
				$out[] = $_node;
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_bind_dual_service_catalog' ) ) {
		function redue_bind_dual_service_catalog( &$org_node, $services ) {
			if ( ! is_array($org_node) ) { return; }
			if ( ! is_array($services) || count($services) === 0 ) {
				unset($org_node['availableService'], $org_node['hasOfferCatalog']);
				return;
			}
			$_offers = array();
			foreach ( $services as $_item ) {
				if ( ! is_array($_item) || empty($_item['name']) ) { continue; }
				$_offers[] = array('@type' => 'Offer', 'itemOffered' => $_item);
			}
			if ( count($_offers) === 0 ) {
				unset($org_node['availableService'], $org_node['hasOfferCatalog']);
				return;
			}
			$org_node['availableService'] = $services;
			$org_node['hasOfferCatalog'] = array(
				'@type' => 'OfferCatalog',
				'name' => '${SERVICE_CATALOG_NAME}',
				'itemListElement' => $_offers,
			);
		}
	}`;
}
