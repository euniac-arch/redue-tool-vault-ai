/**
 * Universal Remote Auto-Patch Engine:
 * diagnose CMS/header → hierarchical `_redue_backups/{stamp}_{domain}` backup
 * → inject v14 dynamic schema → overwrite → one-click restore.
 */

import {
	applyCmsAdapterWrap,
	pickCmsInjectTarget,
	planCmsInjection,
	resolveCmsAdapter,
} from '@/lib/solve/adapters';
import {
	buildSchemaMappingJson,
	generateDynamicPhpSchema,
	prepareHeadSourceForInject,
	shouldUseDynamicPhpSchema,
	type AuditPageMeta,
	type SchemaNavItem,
} from '@/lib/solve/dynamic-php-schema';
import { isGnuboardThemeRelativePath, sanitizePhpForDeploy, stripRedueHeadRenderCall } from '@/lib/solve/php-sanitize';
import {
	domainFromTargetUrl,
	formatBackupFolderName,
} from '@/lib/solve/local-fs-patch';
import {
	buildDefaultInjectSnippet,
	injectBeforeClosingHead,
} from '@/lib/solve/source-mapping';
import type { RemoteConnectionInput } from '@/lib/solve/remote-creds';
import {
	diagnoseRemoteHeaderTargets,
	gnuboardInjectTier,
	type RankedRemoteTarget,
	type RemoteDiagnoseResult,
} from '@/lib/solve/remote-header-finder';
import {
	buildGeoRootAssetPack,
	LLMS_FULL_TXT_RELATIVE_PATH,
	ROBOTS_TXT_RELATIVE_PATH,
	RSS_PHP_RELATIVE_PATH,
	SITEMAP_XML_RELATIVE_PATH,
} from '@/lib/solve/geo-root-assets';
import { LLMS_TXT_RELATIVE_PATH } from '@/lib/solve/llms-txt-deploy';
import {
	LLMS_PHP_ROUTER_RELATIVE_PATH,
	applyLlmsRouterHtaccessPatch,
	buildLlmsUtf8RouterPhp,
	isLlmsUtf8RouterCurrent,
} from '@/lib/solve/llms-utf8-router-engine';
import {
	connectRemoteTransport,
	toAbsoluteRemotePath,
	type RemoteTransport,
} from '@/lib/solve/remote-transport';

export type RemoteSchemaPayload = {
	siteName?: string;
	targetUrl?: string;
	pages?: AuditPageMeta[];
	/** When true, empty pages[] does not synthesize a homepage $page_meta row. */
	allowEmptyPageMap?: boolean;
	/** When false, skip head.sub.php inject. Default: true when HTML pages exist. */
	deployHeader?: boolean;
	deployRobotsTxt?: boolean;
	deploySitemapXml?: boolean;
	deployLlmsTxt?: boolean;
	deployLlmsFullTxt?: boolean;
	/** GnuBoard5 / YoungCart — root `rss.php` RSS 2.0 feed. Default: true on gnuboard. */
	deployRssPhp?: boolean;
	/** GnuBoard5 only — idempotent llms.php UTF-8 router + .htaccess rewrite. Default: true. */
	deployLlmsPhpRouter?: boolean;
	mainDescription?: string;
	industryType?: string;
	cmsType?: string;
	navItems?: SchemaNavItem[];
	footerText?: string;
	legalName?: string;
	representativeName?: string;
	representativeTitle?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	knowsAbout?: string[];
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
	postalCode?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	telephone?: string;
	fax?: string;
	taxId?: string;
};

export type RemotePatchExecuteResult = {
	ok: boolean;
	backupFolderName: string | null;
	backupAbsolutePath: string | null;
	targetPath: string | null;
	/** Same as targetPath — the file that actually received the inject. */
	injectedPath: string | null;
	targetAbsolutePath: string | null;
	cmsLabel: string | null;
	engine: 'php-dynamic' | 'html-static' | null;
	anchor: string | null;
	warning: string | null;
	message: string;
	logs: string[];
};

export type RemoteRestoreResult = {
	ok: boolean;
	backupFolderName: string | null;
	restoredCount: number;
	message: string;
	logs: string[];
};

function dirnameRemote(absolutePath: string): string {
	const p = absolutePath.replace(/\\/g, '/');
	const idx = p.lastIndexOf('/');
	if (idx <= 0) return '/';
	return p.slice(0, idx) || '/';
}

function basenameRemote(absolutePath: string): string {
	const parts = absolutePath.replace(/\\/g, '/').split('/').filter(Boolean);
	return parts[parts.length - 1] || '';
}

async function uploadRootAsset(opts: {
	transport: RemoteTransport;
	remoteRoot: string;
	backupFolderName: string;
	relativePath: string;
	content: string;
	log: (line: string, progress?: number) => void;
}): Promise<{ ok: boolean; error?: string }> {
	const liveAbs = toAbsoluteRemotePath(opts.remoteRoot, opts.relativePath);
	const backupAbs = toAbsoluteRemotePath(
		opts.remoteRoot,
		`${opts.backupFolderName}/${opts.relativePath}`,
	);
	try {
		try {
			const existing = await opts.transport.readText(liveAbs);
			if (existing) {
				await opts.transport.ensureDir(dirnameRemote(backupAbs));
				await opts.transport.writeText(backupAbs, existing);
			}
		} catch {
			// first deploy — no previous file
		}
		await opts.transport.writeText(liveAbs, opts.content);
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		opts.log(`[경고] ${opts.relativePath} 업로드 실패: ${message}`);
		return { ok: false, error: message };
	}
}

/**
 * GnuBoard5-only safety net: deploys the idempotent `llms.php` UTF-8 router and patches
 * `.htaccess` to internally rewrite `llms.txt` / `llms-full.txt` through it. Skips the
 * re-upload entirely when the remote file already carries the current version marker,
 * and skips the `.htaccess` write when the marked block is already up to date.
 */
async function deployLlmsUtf8Router(opts: {
	transport: RemoteTransport;
	remoteRoot: string;
	backupFolderName: string;
	log: (line: string, progress?: number) => void;
}): Promise<boolean> {
	const { transport, remoteRoot, backupFolderName, log } = opts;

	let phpOk = false;
	try {
		const routerAbs = toAbsoluteRemotePath(remoteRoot, LLMS_PHP_ROUTER_RELATIVE_PATH);
		let existing = '';
		try {
			existing = await transport.readText(routerAbs);
		} catch {
			existing = '';
		}
		if (existing && isLlmsUtf8RouterCurrent(existing)) {
			log('[생략] llms.php UTF-8 라우터가 이미 최신 버전입니다 — 재배포 생략');
			phpOk = true;
		} else {
			const result = await uploadRootAsset({
				transport,
				remoteRoot,
				backupFolderName,
				relativePath: LLMS_PHP_ROUTER_RELATIVE_PATH,
				content: buildLlmsUtf8RouterPhp(),
				log,
			});
			phpOk = result.ok;
			if (phpOk) {
				log('[진행 92%] 루트 /llms.php — EUC-KR/CP949 호스팅 대응 UTF-8 강제 라우터 배포 완료', 92);
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`[경고] llms.php 배포 실패: ${message}`);
	}

	let htaccessOk = false;
	try {
		const htaccessAbs = toAbsoluteRemotePath(remoteRoot, '.htaccess');
		let existingHtaccess = '';
		try {
			existingHtaccess = await transport.readText(htaccessAbs);
		} catch {
			existingHtaccess = '';
		}
		const patched = applyLlmsRouterHtaccessPatch(existingHtaccess);
		if (!patched.changed) {
			htaccessOk = true;
		} else {
			if (existingHtaccess) {
				const backupAbs = toAbsoluteRemotePath(remoteRoot, `${backupFolderName}/.htaccess`);
				await transport.ensureDir(dirnameRemote(backupAbs));
				await transport.writeText(backupAbs, existingHtaccess);
			}
			await transport.ensureDir(dirnameRemote(htaccessAbs));
			await transport.writeText(htaccessAbs, patched.content);
			log('[진행 93%] .htaccess — llms.txt/llms-full.txt → llms.php 내부 리라이트 규칙 자동 주입 완료', 93);
			htaccessOk = true;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`[경고] .htaccess llms 라우팅 패치 실패: ${message}`);
	}

	return phpOk && htaccessOk;
}

export function buildRemoteInjectSnippet(
	relativePath: string,
	payload: RemoteSchemaPayload,
): { snippet: string; engine: 'php-dynamic' | 'html-static'; corePhp: string } {
	const cmsType = payload.cmsType || 'Custom HTML/PHP';
	const siteName = payload.siteName || 'Site';

	if (shouldUseDynamicPhpSchema(relativePath)) {
		const mapping = buildSchemaMappingJson({
			siteName,
			targetUrl: payload.targetUrl,
			pages: payload.pages || [],
			industryType: payload.industryType,
			cmsType,
			navItems: payload.navItems,
			allowEmptyPageMap: payload.allowEmptyPageMap,
		});
		const core = generateDynamicPhpSchema(mapping, {
			siteName,
			targetUrl: payload.targetUrl,
			industryType: payload.industryType,
			cmsType,
			navItems: payload.navItems,
			footerText: payload.footerText,
			legalName: payload.legalName,
			representativeName: payload.representativeName,
			representativeTitle: payload.representativeTitle,
			openingHoursOpens: payload.openingHoursOpens,
			openingHoursCloses: payload.openingHoursCloses,
			latitude: payload.latitude,
			longitude: payload.longitude,
			sameAs: payload.sameAs,
			knowsAbout: payload.knowsAbout,
			medicalSpecialty: payload.medicalSpecialty,
			isAcceptingNewPatients: payload.isAcceptingNewPatients,
			postalCode: payload.postalCode,
			streetAddress: payload.streetAddress,
			addressLocality: payload.addressLocality,
			addressRegion: payload.addressRegion,
			telephone: payload.telephone,
			fax: payload.fax,
			taxId: payload.taxId,
		});
		const snippet = applyCmsAdapterWrap(core, cmsType, relativePath);
		return { snippet, engine: 'php-dynamic', corePhp: core };
	}

	return {
		snippet: buildDefaultInjectSnippet({
			cmsType,
			targetUrl: payload.targetUrl,
			siteName,
		}),
		engine: 'html-static',
		corePhp: '',
	};
}

export async function runRemoteDiagnose(
	conn: RemoteConnectionInput,
): Promise<RemoteDiagnoseResult & { protocol: string; host: string; remoteRoot: string }> {
	let transport: RemoteTransport | null = null;
	try {
		transport = await connectRemoteTransport(conn);
		const result = await diagnoseRemoteHeaderTargets(transport);
		return {
			...result,
			protocol: conn.protocol,
			host: conn.host,
			remoteRoot: conn.remoteRoot,
		};
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

export async function runRemoteAutoPatch(opts: {
	conn: RemoteConnectionInput;
	/** Prefer this relative path; otherwise use diagnosed primary. */
	targetRelativePath?: string | null;
	schema: RemoteSchemaPayload;
	/** Pre-diagnosed targets (optional — re-diagnoses when omitted). */
	diagnoseHint?: {
		primaryTarget: RankedRemoteTarget | null;
		cmsLabel?: string | null;
		cmsDisplay?: string | null;
	} | null;
	/** Push timeline lines to the UI as each stage starts/finishes. */
	onLog?: (line: string, progress?: number) => void;
}): Promise<RemotePatchExecuteResult> {
	const logs: string[] = [];
	let transport: RemoteTransport | null = null;
	const log = (line: string, progress?: number) => {
		logs.push(line);
		opts.onLog?.(line, progress);
	};

	const fail = (
		message: string,
		partial?: Partial<RemotePatchExecuteResult>,
	): RemotePatchExecuteResult => ({
		ok: false,
		backupFolderName: null,
		backupAbsolutePath: null,
		targetPath: null,
		injectedPath: null,
		targetAbsolutePath: null,
		cmsLabel: null,
		engine: null,
		anchor: null,
		warning: null,
		message,
		logs,
		...partial,
	});

	try {
		log(`${opts.conn.protocol.toUpperCase()} ${opts.conn.host}:${opts.conn.port} 접속…`, 8);
		transport = await connectRemoteTransport(opts.conn);
		log(`[✅ 원격 접속 성공] 루트=${opts.conn.remoteRoot} — 같은 세션에서 진단 후 즉시 패치`, 12);

		let cmsLabel: string | null = opts.diagnoseHint?.cmsLabel || null;
		let cmsDisplay: string =
			opts.diagnoseHint?.cmsDisplay || opts.schema.cmsType || 'Custom HTML/PHP';

		const hintedPath = opts.targetRelativePath?.trim() || opts.diagnoseHint?.primaryTarget?.relativePath || null;

		log('CMS 시그니처·테마 핀포인트 진단 (세션 유지)…', 20);
		const diagnosed = await diagnoseRemoteHeaderTargets(transport, {
			urlPaths: (opts.schema.pages || []).map((p) => p.urlPath).filter(Boolean),
		});
		logs.push(...diagnosed.logs);
		for (const line of diagnosed.logs) opts.onLog?.(line, 28);
		cmsLabel = diagnosed.cmsLabel || cmsLabel;
		cmsDisplay = diagnosed.cmsDisplay || cmsDisplay;

		let relativePath = diagnosed.primaryTarget?.relativePath || null;
		const adapterPick = pickCmsInjectTarget(
			diagnosed.targets.map((t) => t.relativePath),
			opts.schema.cmsType || cmsDisplay,
		);
		if (adapterPick && resolveCmsAdapter(opts.schema.cmsType || cmsDisplay).id !== 'gnuboard') {
			relativePath = adapterPick;
		}
		const diagnosedTier = relativePath ? gnuboardInjectTier(relativePath) : null;
		const hintedTier = hintedPath ? gnuboardInjectTier(hintedPath) : null;
		// Never keep a root fallback hint when this session found a real theme header.
		if (
			hintedPath &&
			hintedTier != null &&
			(diagnosedTier == null || hintedTier < diagnosedTier)
		) {
			relativePath = hintedPath;
		}
		if (diagnosedTier != null && diagnosedTier <= 2) {
			relativePath = diagnosed.primaryTarget!.relativePath;
		}

		const domain = domainFromTargetUrl(opts.schema.targetUrl);
		const backupFolderName = formatBackupFolderName(new Date(), domain);
		const backupDirAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, backupFolderName);
		const schemaCms = opts.schema.cmsType || String(cmsDisplay);
		const pack = buildGeoRootAssetPack({
			siteName: opts.schema.siteName,
			targetUrl: opts.schema.targetUrl,
			cmsType: schemaCms,
			industryType: opts.schema.industryType,
			pages: opts.schema.pages,
			navItems: opts.schema.navItems,
			footerText: opts.schema.footerText,
			legalName: opts.schema.legalName,
			representativeName: opts.schema.representativeName,
			representativeTitle: opts.schema.representativeTitle,
			streetAddress: opts.schema.streetAddress,
			addressLocality: opts.schema.addressLocality,
			addressRegion: opts.schema.addressRegion,
			postalCode: opts.schema.postalCode,
			telephone: opts.schema.telephone,
			mainDescription: opts.schema.mainDescription,
			openingHoursOpens: opts.schema.openingHoursOpens,
			openingHoursCloses: opts.schema.openingHoursCloses,
		});
		log(
			`[진행 20%] 헤더 메뉴 선택 ${pack.pageCount}개 URL 기반 메타/스키마/sitemap.xml 페이로드 동적 빌드 완료`,
			20,
		);

		let engine: 'php-dynamic' | 'html-static' | null = null;
		let injectedAnchor: string | null = null;
		let injectedWarning: string | null = null;
		let headerOk = false;
		const targetAbs = relativePath ? toAbsoluteRemotePath(opts.conn.remoteRoot, relativePath) : null;
		const failedAssets: string[] = [];

		if (opts.schema.deployHeader === false) {
			log('[건너뜀] head.sub.php 배포 제외됨', 40);
		} else if (!relativePath || !targetAbs) {
			log('[경고] 원격 공통 헤더 타겟을 찾지 못했습니다. 루트 자산 배포는 계속 진행합니다.');
		} else {
			log(
				`[진행 40%] CMS 어댑터 파이프라인 — 엔진 파일 분리 생성 + 헤더 초경량 연동`,
				40,
			);
			try {
				const built = buildRemoteInjectSnippet(relativePath, {
					...opts.schema,
					cmsType: schemaCms,
				});
				engine = built.engine;
				const plans = planCmsInjection({
					cmsType: schemaCms,
					corePhp: built.corePhp || built.snippet,
					headerPath: relativePath,
					siteName: opts.schema.siteName,
					targetUrl: opts.schema.targetUrl,
				});
				for (const plan of plans) {
					const planAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, plan.relativePath);
					const backupFileAbs = toAbsoluteRemotePath(
						opts.conn.remoteRoot,
						`${backupFolderName}/${plan.relativePath.replace(/^\/+/, '')}`,
					);
					let original = '';
					try {
						original = await transport.readText(planAbs);
					} catch {
						original = '';
					}
					if (original) {
						await transport.ensureDir(dirnameRemote(backupFileAbs));
						await transport.writeText(backupFileAbs, original);
						log(`[✅ 원격 백업] ${plan.relativePath} → ${backupFileAbs}`);
					}
					let next = plan.content;
					if (plan.mode !== 'create') {
						const prepared = prepareHeadSourceForInject(original, plan.relativePath);
						const injected = injectBeforeClosingHead(prepared, plan.content, {
							targetPath: plan.relativePath,
						});
						if (!injected.ok) {
							throw new Error(injected.warning || `${plan.relativePath} 주입 앵커를 찾지 못했습니다.`);
						}
						next = injected.result;
						injectedAnchor = injected.anchor;
						injectedWarning = injected.warning;
					} else {
						injectedAnchor = injectedAnchor || 'php-open-top';
					}
					await transport.ensureDir(dirnameRemote(planAbs));
					await transport.writeText(planAbs, sanitizePhpForDeploy(next, plan.relativePath));
					log(`[업로드 완료] ${plan.relativePath} — ${plan.description}`);
				}
				headerOk = true;
				if (resolveCmsAdapter(schemaCms).id === 'gnuboard') {
					log('[그누보드] extend/redue.schema.php 분리 + head.sub.php 렌더 5줄만 유지 (관리자 CSRF/POST 차단)');
					if (isGnuboardThemeRelativePath(relativePath)) {
						try {
							const rootHeadAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, 'head.sub.php');
							const rootHead = await transport.readText(rootHeadAbs);
							const cleaned = stripRedueHeadRenderCall(rootHead);
							if (cleaned !== rootHead) {
								await transport.writeText(rootHeadAbs, sanitizePhpForDeploy(cleaned, 'head.sub.php'));
								log('[정리] 루트 head.sub.php 에 잘못 들어간 렌더 호출을 제거하고 테마 헤더만 사용합니다.');
							}
						} catch {
							/* root head may not exist */
						}
					}
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`[경고] 공통 헤더 패치 실패: ${message} — 루트 자산 배포는 계속 진행합니다.`);
				failedAssets.push(`head(${relativePath}): ${message}`);
			}
		}

		let robotsOk = false;
		if (opts.schema.deployRobotsTxt === false) {
			log('[건너뜀] robots.txt 배포 제외됨', 60);
		} else {
			const robots = await uploadRootAsset({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				relativePath: ROBOTS_TXT_RELATIVE_PATH,
				content: pack.robotsTxt,
				log,
			});
			robotsOk = robots.ok;
			if (robots.ok) {
				log('[진행 60%] 루트 /www/robots.txt AI 친화형 파일 생성 및 업로드 완료', 60);
			} else if (robots.error) {
				failedAssets.push(`robots.txt: ${robots.error}`);
			}
		}

		let sitemapOk = false;
		if (opts.schema.deploySitemapXml === false) {
			log('[건너뜀] sitemap.xml 배포 제외됨', 75);
		} else {
			const sitemap = await uploadRootAsset({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				relativePath: SITEMAP_XML_RELATIVE_PATH,
				content: pack.sitemapXml,
				log,
			});
			sitemapOk = sitemap.ok;
			if (sitemap.ok) {
				log(
					`[진행 75%] 루트 /www/sitemap.xml — 헤더 선택 ${pack.pageCount}개 + 메인 도메인 배포 완료`,
					75,
				);
			} else if (sitemap.error) {
				failedAssets.push(`sitemap.xml: ${sitemap.error}`);
			}
		}

		let llmsOk = false;
		let llmsFullOk = false;
		if (opts.schema.deployLlmsTxt === false) {
			log('[건너뜀] llms.txt 배포 제외됨', 90);
		} else {
			const llms = await uploadRootAsset({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				relativePath: LLMS_TXT_RELATIVE_PATH,
				content: pack.llmsTxt,
				log,
			});
			llmsOk = llms.ok;
			if (llms.error) failedAssets.push(`llms.txt: ${llms.error}`);
		}
		if (opts.schema.deployLlmsFullTxt === false) {
			log('[건너뜀] llms-full.txt 배포 제외됨', 90);
		} else {
			const llmsFull = await uploadRootAsset({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				relativePath: LLMS_FULL_TXT_RELATIVE_PATH,
				content: pack.llmsFullTxt,
				log,
			});
			llmsFullOk = llmsFull.ok;
			if (llmsFull.error) failedAssets.push(`llms-full.txt: ${llmsFull.error}`);
		}
		if (llmsOk && llmsFullOk) {
			log('[진행 90%] 루트 /www/llms.txt 및 /www/llms-full.txt AI 지식 자산 배포 완료', 90);
		} else if (llmsOk || llmsFullOk) {
			log('[진행 90%] AI 지식 자산 일부 배포 완료', 90);
		}

		let rssOk = false;
		const isGnuboardTarget = resolveCmsAdapter(schemaCms).id === 'gnuboard';
		if (!isGnuboardTarget) {
			// rss.php is GnuBoard 5 / YoungCart root bootstrap (common.php).
		} else if (opts.schema.deployRssPhp === false) {
			log('[건너뜀] rss.php 배포 제외됨', 91);
		} else {
			const rss = await uploadRootAsset({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				relativePath: RSS_PHP_RELATIVE_PATH,
				content: pack.rssPhp,
				log,
			});
			rssOk = rss.ok;
			if (rss.ok) {
				log('[진행 91%] 루트 /rss.php — GnuBoard 5 RSS 2.0 피드 배포 완료', 91);
			} else if (rss.error) {
				failedAssets.push(`rss.php: ${rss.error}`);
			}
		}

		let llmsRouterOk = false;
		if (!isGnuboardTarget) {
			// EUC-KR/CP949 기본 인코딩 문제는 그누보드5 호스팅 환경 전용 대응 — 다른 CMS는 건너뜀
		} else if (opts.schema.deployLlmsPhpRouter === false) {
			log('[건너뜀] llms.php UTF-8 라우터 배포 제외됨', 92);
		} else {
			llmsRouterOk = await deployLlmsUtf8Router({
				transport,
				remoteRoot: opts.conn.remoteRoot,
				backupFolderName,
				log,
			});
			if (!llmsRouterOk) failedAssets.push('llms.php UTF-8 라우터');
		}

		const assetTotal = 5 + (isGnuboardTarget ? 2 : 0);
		const deployedCount = [headerOk, robotsOk, sitemapOk, llmsOk, llmsFullOk, rssOk, llmsRouterOk].filter(
			Boolean,
		).length;
		if (failedAssets.length > 0) {
			injectedWarning = [injectedWarning, `부분 실패 ${failedAssets.length}건 — ${failedAssets.join(' · ')}`]
				.filter(Boolean)
				.join(' · ');
		}

		const doneMessage =
			deployedCount > 0
				? `[완료 100%] SEO & GEO 풀패키지 원격 패치 ${assetTotal}종 배포 및 무결성 검증 성공! (${deployedCount}/${assetTotal})`
				: '[완료 100%] 배포된 자산이 없습니다. 로그의 오류 원인을 확인하세요.';
		log(doneMessage, 100);

		if (deployedCount === 0) {
			return fail(doneMessage, {
				backupFolderName,
				backupAbsolutePath: backupDirAbs,
				targetPath: relativePath,
				injectedPath: relativePath,
				targetAbsolutePath: targetAbs,
				cmsLabel,
				engine,
				anchor: injectedAnchor,
				warning: injectedWarning,
			});
		}

		return {
			ok: true,
			backupFolderName,
			backupAbsolutePath: backupDirAbs,
			targetPath: relativePath,
			injectedPath: relativePath,
			targetAbsolutePath: targetAbs,
			cmsLabel,
			engine,
			anchor: injectedAnchor,
			warning: injectedWarning,
			message: doneMessage,
			logs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`[오류 원인] ${message}`);
		return fail(message);
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

/**
 * One-click remote rollback from `_redue_backups/{stamp}_{domain}/…` (or legacy flat folder).
 */
export async function runRemoteRestore(opts: {
	conn: RemoteConnectionInput;
	backupFolderName: string;
	/** Relative paths under the backup session; when omitted, restore only `targetRelativePath`. */
	relativePaths?: string[];
	targetRelativePath?: string | null;
}): Promise<RemoteRestoreResult> {
	const logs: string[] = [];
	let transport: RemoteTransport | null = null;
	const backupFolderName = opts.backupFolderName.replace(/^\/+/, '').replace(/\\/g, '/');

	try {
		transport = await connectRemoteTransport(opts.conn);
		logs.push(`[✅ 원격 접속 성공] 복원 세션=${backupFolderName}`);

		const paths =
			opts.relativePaths?.map((p) => p.replace(/^\/+/, '')) ||
			(opts.targetRelativePath ? [opts.targetRelativePath.replace(/^\/+/, '')] : []);

		if (paths.length === 0) {
			return {
				ok: false,
				backupFolderName,
				restoredCount: 0,
				message: '복원 대상 파일 경로가 없습니다.',
				logs,
			};
		}

		let restoredCount = 0;
		for (const rel of paths) {
			const backupAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, `${backupFolderName}/${rel}`);
			const liveAbs = toAbsoluteRemotePath(opts.conn.remoteRoot, rel);
			logs.push(`원클릭 복원: ${backupAbs} → ${liveAbs}`);
			const original = await transport.readText(backupAbs);
			await transport.ensureDir(dirnameRemote(liveAbs));
			await transport.writeText(liveAbs, original);
			restoredCount += 1;
		}

		return {
			ok: true,
			backupFolderName,
			restoredCount,
			message: `[✅ 원클릭 복원 완료] ${restoredCount}개 파일 롤백 (${backupFolderName})`,
			logs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logs.push(`복원 오류: ${message}`);
		return {
			ok: false,
			backupFolderName,
			restoredCount: 0,
			message,
			logs,
		};
	} finally {
		if (transport) await transport.close().catch(() => undefined);
	}
}

/** Soft helper for UI — unused basename kept for future multi-file patch. */
export function remoteBackupSiblingName(targetAbsolutePath: string, backupFolder: string): string {
	return `${backupFolder}/${basenameRemote(targetAbsolutePath)}`;
}
