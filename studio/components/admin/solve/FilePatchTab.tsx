'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDiffModel } from '@/lib/diff';
import {
	backupAndDirectPatch,
	buildPatchedContent,
	domainFromTargetUrl,
	getLocalFsCapability,
	pickProjectDirectory,
	readTextFile,
	restoreFromBackup,
	scanDirectoryHandle,
	type BackupPatchReport,
} from '@/lib/solve/local-fs-patch';
import {
	scanLocalFolderFiles,
	type DetectedCmsDisplay,
	type LocalScannedFile,
} from '@/lib/solve/local-folder-scan';
import {
	applyCmsAdapterWrap,
	buildGnuboardHeadRenderCallBlock,
	GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
	normalizeCmsAdapterId,
	planCmsInjection,
} from '@/lib/solve/adapters';
import { CMS_DISPLAY_OPTIONS } from '@/lib/solve/types';
import {
	buildSchemaMappingJson,
	generateDynamicPhpSchema,
	pagesFromAuditPaths,
	REDUE_V14_SCHEMA_EXTENSION_GUIDE,
	REDUE_V14_SCHEMA_PATCH_SUCCESS,
	shouldUseDynamicPhpSchema,
	type AuditPageMeta,
} from '@/lib/solve/dynamic-php-schema';
import {
	buildDefaultInjectSnippet,
	buildInjectSnippetForMappedFile,
	buildSourceMapping,
	checkInjectionSafety,
	extractAuditCollectedUrls,
	injectBeforeClosingHead,
	pickGlobalHeadScanCandidates,
	PRIMARY_HEADER_BADGE,
	type InjectionSafety,
	type MappedSourceFile,
	type SourceMappingResult,
} from '@/lib/solve/source-mapping';
import { bindCeoName } from '@/lib/audit/extractors/ceo-name';
import { bindTelephone } from '@/lib/solve/core/telephone';
import {
	pickGnuboardReconPaths,
	reconGnuboardSite,
	summarizeGnuboardRecon,
	type GnuboardSiteRecon,
} from '@/lib/solve/gnuboard-site-recon';
import {
	applyCitationExtrasToMain,
	excludeCitationVirtualFromSchemaPages,
} from '@/lib/solve/core/eeat-citation';
import { excludeRootDeployFromSchemaPages, resolveRootDeployFlags } from '@/lib/solve/geo-root-assets';
import type { SolvePageMeta } from '@/lib/solve/types';
import { ExternalVerificationLinks } from '@/components/ExternalVerificationLinks';
import { consumeRemotePatchExecuteResponse } from '@/lib/solve/remote-patch-stream';
import { LightDiffViewer } from './LightDiffViewer';

type WorkMode = 'local' | 'remote';
type UploadMode = 'file' | 'folder';
type Protocol = 'sftp' | 'ftp';
type ConnStatus = 'idle' | 'ok' | 'fail' | 'working';

interface FilePatchTabProps {
	targetUrl?: string;
	collectedUrlPaths?: string[];
	cmsTypeHint?: string;
	siteName?: string;
	/** Audit issue codes used to label schema summary chips. */
	issueCodes?: string[];
	/** Per-page title/meta/type from audit_payload for dynamic PHP $page_meta. */
	pageMetas?: SolvePageMeta[];
	/** When true, empty pageMetas means "inject none" — do not fall back to all collected URLs. */
	schemaSelectionActive?: boolean;
	mainTitle?: string;
	mainDescription?: string;
	mainH1?: string;
	industryType?: string;
	/** GNB for Parent Fallback Hierarchy */
	navItems?: Array<{ name: string; url: string; children?: Array<{ name: string; url: string }>; parent?: string }>;
	/** Footer 사업자 정보 → Organization.legalName */
	footerText?: string;
	legalName?: string;
	representativeName?: string;
	ceoName?: string;
	representativeTitle?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
	postalCode?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	telephone?: string;
}

const UNIFIED_INJECT_SUCCESS = `[✅ 원본 백업 완료] ➔ [${REDUE_V14_SCHEMA_PATCH_SUCCESS}]`;

export function FilePatchTab({
	targetUrl,
	collectedUrlPaths = [],
	cmsTypeHint,
	siteName,
	issueCodes = [],
	pageMetas = [],
	schemaSelectionActive = false,
	mainTitle,
	mainDescription,
	mainH1,
	industryType,
	navItems,
	footerText,
	legalName,
	representativeName,
	ceoName,
	representativeTitle,
	openingHoursOpens,
	openingHoursCloses,
	latitude,
	longitude,
	sameAs,
	medicalSpecialty,
	isAcceptingNewPatients,
	postalCode,
	streetAddress,
	addressLocality,
	addressRegion,
	telephone,
}: FilePatchTabProps) {
	const [workMode, setWorkMode] = useState<WorkMode>('local');
	const [uploadMode, setUploadMode] = useState<UploadMode>(
		pageMetas.length > 0 || collectedUrlPaths.length > 0 ? 'folder' : 'file',
	);
	const [cmsType, setCmsType] = useState(cmsTypeHint || 'WordPress');
	const [cmsAutoDetected, setCmsAutoDetected] = useState(false);
	const [cmsDetectMessage, setCmsDetectMessage] = useState<string | null>(null);
	const [scanSummary, setScanSummary] = useState<string | null>(null);
	const [scannedFiles, setScannedFiles] = useState<LocalScannedFile[]>([]);
	const [mapping, setMapping] = useState<SourceMappingResult | null>(null);
	const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [fileContent, setFileContent] = useState('');
	const [fileSafety, setFileSafety] = useState<InjectionSafety | null>(null);
	const [searchText, setSearchText] = useState('');
	const [replaceText, setReplaceText] = useState('');
	const [status, setStatus] = useState<'idle' | 'ready' | 'done'>('idle');
	const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
	const [progress, setProgress] = useState(0);
	const [batchPatched, setBatchPatched] = useState<Record<string, string>>({});
	const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
	const [fsSupported, setFsSupported] = useState(false);
	const [fsSupportReason, setFsSupportReason] = useState<string | null>(null);
	const [projectFolderName, setProjectFolderName] = useState<string | null>(null);
	const [patching, setPatching] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [patchReport, setPatchReport] = useState<BackupPatchReport | null>(null);
	const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
	const [repName, setRepName] = useState(representativeName || ceoName || '');
	const [repTitle, setRepTitle] = useState(representativeTitle || '');
	const [telNumber, setTelNumber] = useState(telephone || '');
	const [hoursOpens, setHoursOpens] = useState(openingHoursOpens || '');
	const [hoursCloses, setHoursCloses] = useState(openingHoursCloses || '');
	const [recon, setRecon] = useState<GnuboardSiteRecon | null>(null);
	const [sameAsText, setSameAsText] = useState((sameAs || []).join('\n'));
	const [acceptingNewPatients, setAcceptingNewPatients] = useState(isAcceptingNewPatients !== false);
	const [successModal, setSuccessModal] = useState<{
		title: string;
		message: string;
		backupFolderName: string | null;
		headerPath: string | null;
		pageCount: number;
		/** local | remote — controls one-click restore source */
		mode?: 'local' | 'remote';
	} | null>(null);

	const [protocol, setProtocol] = useState<Protocol>('sftp');
	const [host, setHost] = useState('');
	const [port, setPort] = useState(22);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [targetDir, setTargetDir] = useState('/public_html');
	const [remoteCms, setRemoteCms] = useState(cmsTypeHint || 'WordPress');
	const [remoteCmsLabel, setRemoteCmsLabel] = useState<string | null>(null);
	const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
	const [remoteLogs, setRemoteLogs] = useState<string[]>([]);
	const [remoteProgress, setRemoteProgress] = useState(0);
	const [remoteFiles, setRemoteFiles] = useState<string[]>([]);
	const [remoteSessionToken, setRemoteSessionToken] = useState<string | null>(null);
	const [remotePrimaryTarget, setRemotePrimaryTarget] = useState<{
		relativePath: string;
		absolutePath: string;
		score: number;
		badge: string;
		engine: 'php-dynamic' | 'html-static';
	} | null>(null);
	const [remoteTargets, setRemoteTargets] = useState<
		Array<{
			relativePath: string;
			score: number;
			badge: string;
			isPrimary: boolean;
			engine: 'php-dynamic' | 'html-static';
		}>
	>([]);
	const [remotePatching, setRemotePatching] = useState(false);
	const [remoteBackupOk, setRemoteBackupOk] = useState(false);
	const [remoteReport, setRemoteReport] = useState<{
		message: string;
		targetPath: string | null;
		backupFolderName: string | null;
		cmsLabel: string | null;
	} | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const folderInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const cap = getLocalFsCapability();
		setFsSupported(cap.supported);
		setFsSupportReason(cap.reason || null);
	}, []);

	useEffect(() => {
		const next = representativeName || ceoName;
		if (next) setRepName(next);
	}, [representativeName, ceoName]);

	useEffect(() => {
		if (representativeTitle) setRepTitle(representativeTitle);
	}, [representativeTitle]);

	useEffect(() => {
		if (telephone) setTelNumber(telephone);
	}, [telephone]);

	useEffect(() => {
		if (openingHoursOpens) setHoursOpens(openingHoursOpens);
	}, [openingHoursOpens]);

	useEffect(() => {
		if (openingHoursCloses) setHoursCloses(openingHoursCloses);
	}, [openingHoursCloses]);

	useEffect(() => {
		if (sameAs && sameAs.length > 0) setSameAsText(sameAs.join('\n'));
	}, [sameAs]);

	useEffect(() => {
		if (typeof isAcceptingNewPatients === 'boolean') setAcceptingNewPatients(isAcceptingNewPatients);
	}, [isAcceptingNewPatients]);

	const collectedUrls = useMemo(() => {
		const refs = extractAuditCollectedUrls({
			url: targetUrl,
			baseOrigin: targetUrl,
			collectedUrls: collectedUrlPaths,
		});
		return refs;
	}, [collectedUrlPaths, targetUrl]);

	const auditPaths = useMemo(() => collectedUrls.map((r) => r.hrefPath), [collectedUrls]);

	const resolvedSiteName = siteName || (targetUrl ? safeHostname(targetUrl) : 'Site');

	const sameAsList = useMemo(
		() =>
			sameAsText
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => /^https?:\/\//i.test(line)),
		[sameAsText],
	);

	const rootDeployFlags = useMemo(() => resolveRootDeployFlags(pageMetas), [pageMetas]);

	const auditPages: AuditPageMeta[] = useMemo(() => {
		if (pageMetas.length > 0) {
			return excludeCitationVirtualFromSchemaPages(excludeRootDeployFromSchemaPages(applyCitationExtrasToMain(pageMetas)))
				.filter((p) => p.selected !== false)
				.map((p) => ({
					urlPath: p.urlPath,
					title: p.title,
					description: p.description,
					h1: p.h1,
					pageType: p.pageType,
					extraTypes: p.extraTypes,
					section: p.section || p.menu1 || p.title,
					menu1: p.menu1,
					menu2: p.menu2,
					fromGnb: p.fromGnb,
					selected: true,
				}));
		}
		if (schemaSelectionActive) return [];
		return pagesFromAuditPaths({
			targetUrl,
			siteName: resolvedSiteName,
			collectedUrlPaths,
			mainTitle,
			mainDescription,
			mainH1,
			industryType,
			navItems,
		});
	}, [
		pageMetas,
		schemaSelectionActive,
		targetUrl,
		resolvedSiteName,
		collectedUrlPaths,
		mainTitle,
		mainDescription,
		mainH1,
		industryType,
		navItems,
	]);

	/** Compact LLM-style mapping JSON (zero-token deterministic build from audit_payload). */
	const schemaMappingJson = useMemo(
		() =>
			buildSchemaMappingJson({
				siteName: resolvedSiteName,
				targetUrl,
				pages: auditPages,
				industryType,
				cmsType,
				navItems,
				allowEmptyPageMap: schemaSelectionActive,
			}),
		[resolvedSiteName, targetUrl, auditPages, industryType, cmsType, navItems, schemaSelectionActive],
	);

	/** Backend template builder — binds mapping JSON → full dynamic PHP controller (no LLM tokens). */
	const dynamicPhpSnippet = useMemo(
		() =>
			generateDynamicPhpSchema(schemaMappingJson, {
				siteName: resolvedSiteName,
				targetUrl,
				industryType,
				cmsType,
				navItems,
				footerText: footerText || recon?.corpus,
				legalName: legalName || recon?.legalName,
				representativeName: bindCeoName(repName || recon?.representativeName),
				representativeTitle: repTitle || recon?.representativeTitle,
				openingHoursOpens: hoursOpens || recon?.openingHoursOpens,
				openingHoursCloses: hoursCloses || recon?.openingHoursCloses,
				latitude: latitude || recon?.latitude,
				longitude: longitude || recon?.longitude,
				sameAs: sameAsList.length ? sameAsList : recon?.sameAs,
				medicalSpecialty: medicalSpecialty?.length ? medicalSpecialty : recon?.medicalSpecialty,
				isAcceptingNewPatients: acceptingNewPatients,
				postalCode: postalCode || recon?.postalCode,
				streetAddress: streetAddress || recon?.streetAddress,
				addressLocality: addressLocality || recon?.addressLocality,
				addressRegion: addressRegion || recon?.addressRegion,
				telephone: bindTelephone(telNumber || recon?.telephone || ''),
				fax: recon?.fax,
				taxId: recon?.taxId,
			}),
		[
			schemaMappingJson,
			resolvedSiteName,
			targetUrl,
			industryType,
			cmsType,
			navItems,
			footerText,
			legalName,
			repName,
			repTitle,
			hoursOpens,
			hoursCloses,
			latitude,
			longitude,
			sameAsList,
			medicalSpecialty,
			acceptingNewPatients,
			postalCode,
			streetAddress,
			addressLocality,
			addressRegion,
			telNumber,
			recon,
		],
	);

	const injectSnippet = useMemo(
		() =>
			buildDefaultInjectSnippet({
				cmsType,
				targetUrl,
				siteName: resolvedSiteName,
			}),
		[cmsType, targetUrl, resolvedSiteName],
	);

	function snippetForPath(relativePath: string | null | undefined): string {
		const mapped = mapping?.files.find((f) => f.relativePath === relativePath);
		const path = relativePath || '';
		if (normalizeCmsAdapterId(cmsType) === 'gnuboard' && /head\.sub\.php$/i.test(path)) {
			return buildGnuboardHeadRenderCallBlock();
		}
		if (normalizeCmsAdapterId(cmsType) === 'saas') {
			return applyCmsAdapterWrap('', cmsType, path, {
				siteName: resolvedSiteName,
				targetUrl,
			});
		}
		const useDynamic =
			Boolean(mapped?.isPrimaryHeader || mapped?.group === 'global') &&
			shouldUseDynamicPhpSchema(path);

		if (useDynamic) {
			return applyCmsAdapterWrap(dynamicPhpSnippet, cmsType, path);
		}
		if (mapped) {
			return buildInjectSnippetForMappedFile(mapped, {
				cmsType,
				targetUrl,
				siteName: resolvedSiteName,
			});
		}
		if (shouldUseDynamicPhpSchema(path)) {
			return applyCmsAdapterWrap(dynamicPhpSnippet, cmsType, path);
		}
		return injectSnippet;
	}

	const previewDiff = useMemo(() => {
		if (!fileContent) return null;
		if (!searchText) return null;
		if (!fileContent.includes(searchText)) return null;
		const after = fileContent.split(searchText).join(replaceText);
		return buildDiffModel(fileContent, after);
	}, [fileContent, searchText, replaceText]);

	const patchedDiff = useMemo(() => {
		if (status !== 'done' || !fileContent) return null;
		if (searchText && fileContent.includes(searchText)) {
			return buildDiffModel(fileContent, fileContent.split(searchText).join(replaceText));
		}
		const patched = selectedPath ? batchPatched[selectedPath] : undefined;
		if (patched) return buildDiffModel(fileContent, patched);
		const snippet = snippetForPath(selectedPath);
		const injected = injectBeforeClosingHead(fileContent, snippet, { targetPath: selectedPath || undefined });
		if (injected.ok) return buildDiffModel(fileContent, injected.result);
		return buildDiffModel(fileContent, `${fileContent}\n${snippet}\n`);
	}, [
		status,
		fileContent,
		searchText,
		replaceText,
		selectedPath,
		batchPatched,
		mapping,
		cmsType,
		targetUrl,
		resolvedSiteName,
		injectSnippet,
		dynamicPhpSnippet,
	]);

	function pushLog(line: string) {
		setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
	}

	function pushRemoteLog(line: string) {
		setRemoteLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
	}

	function resetScanState() {
		setScannedFiles([]);
		setSelectedPath(null);
		setScanSummary(null);
		setCmsDetectMessage(null);
		setCmsAutoDetected(false);
		setMapping(null);
		setCheckedPaths(new Set());
		setFileSafety(null);
		setBatchPatched({});
		setDirectoryHandle(null);
		setProjectFolderName(null);
		setPatchReport(null);
		setRecon(null);
	}

	async function applyMapping(
		sourceFiles: LocalScannedFile[],
		cmsDisplay: DetectedCmsDisplay | string,
	): Promise<{ mapping: SourceMappingResult; reconHead: string | null }> {
		const paths = sourceFiles.map((f) => f.relativePath.replace(/\\/g, '/'));
		const byPath = new Map(sourceFiles.map((f) => [f.relativePath.replace(/\\/g, '/'), f]));

		// Pass 1: path-only mapping to discover which page files need content labeling
		const draft = buildSourceMapping({
			sourceFiles,
			cms: cmsDisplay,
			auditUrlPaths: auditPaths,
			collectedUrls,
			issueCodes,
		});

		const headCandidates = pickGlobalHeadScanCandidates(paths, 48);
		const pageCandidates = draft.pageTargets.map((f) => f.relativePath.replace(/\\/g, '/'));
		const reconCandidates = pickGnuboardReconPaths(paths);
		const toRead = [...new Set([...headCandidates, ...pageCandidates, ...reconCandidates])].slice(0, 96);
		const fileContents: Record<string, string> = {};

		for (const cand of toRead) {
			const entry = byPath.get(cand);
			if (!entry) continue;
			try {
				fileContents[cand] = await entry.file.text();
			} catch {
				/* skip unreadable */
			}
		}
		if (toRead.length > 0) {
			pushLog(
				`콘텐츠 스캔: 헤더 후보 ${headCandidates.length} · 매핑 페이지 ${pageCandidates.length} → 읽음 ${Object.keys(fileContents).length}`,
			);
		}

		const result = buildSourceMapping({
			sourceFiles,
			cms: cmsDisplay,
			auditUrlPaths: auditPaths,
			collectedUrls,
			issueCodes,
			fileContents,
		});
		setMapping(result);
		let reconHead: string | null = null;
		if (/그누보드|gnuboard|youngcart|영카트/i.test(String(cmsDisplay))) {
			const found = reconGnuboardSite({
				relativePaths: paths,
				fileContents,
				urlPaths: auditPaths,
			});
			setRecon(found);
			reconHead = found.headSubPath;
			if (!repName && found.representativeName) setRepName(found.representativeName);
			if (!repTitle && found.representativeTitle) setRepTitle(found.representativeTitle);
			if (!telNumber && found.telephone) setTelNumber(found.telephone);
			if (!hoursOpens && found.openingHoursOpens) setHoursOpens(found.openingHoursOpens);
			if (!hoursCloses && found.openingHoursCloses) setHoursCloses(found.openingHoursCloses);
			if (!sameAsText && found.sameAs.length) setSameAsText(found.sameAs.join('\n'));
			for (const line of summarizeGnuboardRecon(found)) pushLog(`[실데이터 정찰] ${line}`);
		}
		const nextChecked = new Set(
			result.mainTargets.filter((f) => f.autoChecked).map((f) => f.relativePath),
		);
		setCheckedPaths(nextChecked);
		for (const line of result.summaryLines) pushLog(line);
		return { mapping: result, reconHead };
	}

	async function loadScannedFile(
		entry: LocalScannedFile | null,
		rootHandle?: FileSystemDirectoryHandle | null,
	) {
		if (!entry) return;
		setSelectedPath(entry.relativePath);
		setFileName(entry.relativePath);
		const handle = rootHandle === undefined ? directoryHandle : rootHandle;
		let text = '';
		try {
			text =
				handle != null
					? await readTextFile(handle, entry.relativePath)
					: await entry.file.text();
		} catch {
			text = await entry.file.text();
		}
		setFileContent(text);
		const safety = checkInjectionSafety(text);
		setFileSafety(safety);
		setStatus('ready');
		setProgress(0);
		pushLog(`파일 로드: ${entry.relativePath} (${text.length.toLocaleString()} bytes)`);
		if (safety.safe) {
			pushLog(`주입 안전 검증 통과 — anchor: ${safety.anchor}`);
		} else {
			pushLog(`주입 안전 검증 실패 — ${safety.warning}`);
		}
	}

	async function onFileSelected(file: File | null) {
		if (!file) return;
		resetScanState();
		setFileName(file.name);
		const text = await file.text();
		setFileContent(text);
		const safety = checkInjectionSafety(text);
		setFileSafety(safety);
		setStatus('ready');
		setProgress(0);
		setConsoleLogs([]);
		pushLog(`파일 로드: ${file.name} (${text.length.toLocaleString()} bytes)`);
		if (safety.safe) pushLog(`주입 안전 검증 통과 — 첫 <?php 직후(또는 </head>) 주입 가능`);
		else pushLog(`주입 안전 검증: ${safety.warning}`);
	}

	async function ingestFolderScan(
		result: ReturnType<typeof scanLocalFolderFiles>,
		opts?: { directoryHandle?: FileSystemDirectoryHandle | null; folderName?: string | null },
	) {
		setScannedFiles(result.sourceFiles);
		setScanSummary(result.summary);
		setCmsType(result.cms.display);
		setCmsDetectMessage(result.cms.message);
		setCmsAutoDetected(true);
		setDirectoryHandle(opts?.directoryHandle ?? null);
		setProjectFolderName(opts?.folderName ?? null);
		setPatchReport(null);

		pushLog(result.summary);
		pushLog(result.cms.message);
		if (opts?.directoryHandle) {
			pushLog(
				`[폴더 권한] "${opts.folderName || opts.directoryHandle.name}" — 읽기/쓰기 준비 완료 (직접 패치 가능)`,
			);
		} else {
			pushLog(
				'[폴더 권한] 읽기 전용 선택됨 — 직접 디스크 쓰기를 위해 Chrome/Edge에서 「프로젝트 폴더 선택」을 다시 실행하세요.',
			);
		}
		if (result.cms.signals.length > 0) {
			pushLog(`감지 시그널: ${result.cms.signals.join(', ')}`);
		}
		if (auditPaths.length > 0) {
			pushLog(`크롤 URL ${auditPaths.length}개 → 로컬 소스 1:1 스마트 매핑`);
		}

		if (result.sourceFiles.length === 0) {
			setSelectedPath(null);
			pushLog('스캔 가능한 소스 파일이 없습니다. (개발/미디어 제외 후 대상 없음)');
			return;
		}

		const { mapping: map, reconHead } = await applyMapping(result.sourceFiles, result.cms.display);
		const preferredPath =
			(reconHead && result.sourceFiles.some((f) => f.relativePath.replace(/\\/g, '/') === reconHead)
				? reconHead
				: null) ||
			map.globalHeaderPath ||
			map.pageTargets[0]?.relativePath ||
			result.preferredPath ||
			result.sourceFiles[0].relativePath;
		const preferred =
			result.sourceFiles.find((f) => f.relativePath === preferredPath) || result.sourceFiles[0];
		await loadScannedFile(preferred, opts?.directoryHandle ?? null);
	}

	async function onFolderSelected(fileList: FileList | null) {
		if (!fileList || fileList.length === 0) return;
		setConsoleLogs([]);
		setProgress(0);
		setStatus('idle');
		setFileContent('');
		setFileName(null);
		setBatchPatched({});
		const result = scanLocalFolderFiles(fileList);
		await ingestFolderScan(result, { directoryHandle: null, folderName: null });
	}

	async function handlePickProjectFolder() {
		setConsoleLogs([]);
		setProgress(0);
		setStatus('idle');
		setFileContent('');
		setFileName(null);
		setBatchPatched({});
		setPatchReport(null);

		if (!fsSupported) {
			pushLog(fsSupportReason || 'File System Access API 미지원');
			folderInputRef.current?.click();
			return;
		}

		try {
			pushLog('프로젝트 폴더 선택 대화상자 열기… (읽기/쓰기 권한 요청)');
			const handle = await pickProjectDirectory();
			if (!handle) {
				pushLog('폴더 선택이 취소되었습니다.');
				return;
			}
			pushLog(`폴더 선택됨: ${handle.name}`);
			const result = await scanDirectoryHandle(handle);
			await ingestFolderScan(result, { directoryHandle: handle, folderName: handle.name });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			pushLog(`폴더 선택 실패: ${message}`);
			setErrorModal({
				title: '폴더 접근 권한 오류',
				message,
			});
		}
	}

	async function handleSelectMappedFile(path: string) {
		const entry = scannedFiles.find((f) => f.relativePath === path) || null;
		setStatus('ready');
		setProgress(0);
		setConsoleLogs((prev) => prev.slice(-30));
		await loadScannedFile(entry);
	}

	function toggleChecked(path: string) {
		setCheckedPaths((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}

	function setGroupChecked(files: MappedSourceFile[], checked: boolean) {
		setCheckedPaths((prev) => {
			const next = new Set(prev);
			for (const f of files) {
				if (checked) next.add(f.relativePath);
				else next.delete(f.relativePath);
			}
			return next;
		});
	}

	async function handleLocalPatch(e: React.FormEvent) {
		e.preventDefault();
		if (patching) return;

		if (!fileContent && checkedPaths.size === 0) {
			pushLog('소스 파일을 먼저 선택하세요.');
			return;
		}

		const targets =
			checkedPaths.size > 0
				? scannedFiles.filter((f) => checkedPaths.has(f.relativePath))
				: selectedPath
					? scannedFiles.filter((f) => f.relativePath === selectedPath)
					: [];

		setPatching(true);
		setPatchReport(null);
		setProgress(5);
		pushLog('패치 실행 — 원본 백업 후 로컬 소스 직접 주입 준비…');

		const patchedMap: Record<string, string> = {};
		const originals: Record<string, string> = {};
		let okCount = 0;
		let failCount = 0;

		try {
			if (targets.length > 0) {
				setProgress(15);
				pushLog(`AI 자동 진단 & ${cmsType} 정밀 주입 준비 — ${targets.length}개 파일…`);
				for (const entry of targets) {
					let text = '';
					try {
						text =
							directoryHandle != null
								? await readTextFile(directoryHandle, entry.relativePath)
								: await entry.file.text();
					} catch {
						text = await entry.file.text();
					}
					originals[entry.relativePath] = text;
					if (
						entry.relativePath.replace(/\\/g, '/').replace(/^\/+/, '') ===
						GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH
					) {
						continue;
					}
					const snippet = snippetForPath(entry.relativePath);
					const built = buildPatchedContent(text, snippet, searchText, replaceText, entry.relativePath);
					if (built.ok) {
						patchedMap[entry.relativePath] = built.result;
						okCount += 1;
						const mapped = mapping?.files.find((f) => f.relativePath === entry.relativePath);
						const isDynamic =
							(mapped?.isPrimaryHeader || mapped?.group === 'global') &&
							shouldUseDynamicPhpSchema(entry.relativePath);
						const label = isDynamic
							? '동적 PHP 스키마 컨트롤러'
							: mapped?.schemaSummary?.slice(0, 2).join('+') || 'Schema';
						pushLog(
							`✓ 패치 준비 ${built.anchor === 'search-replace' ? 'Search/Replace' : built.anchor === 'php-open-top' ? `첫 <?php 직후 ${label}` : `</head> 직전 ${label}`} (${built.anchor}): ${entry.relativePath}${mapped?.isPrimaryHeader ? ` ${PRIMARY_HEADER_BADGE}` : ''}`,
						);
					} else {
						failCount += 1;
						pushLog(`✗ 주입 스킵: ${entry.relativePath} — ${built.warning}`);
					}
				}
			} else if (fileContent) {
				const key = selectedPath || fileName || 'file';
				originals[key] = fileContent;
				const snippet = snippetForPath(selectedPath || fileName);
				const built = buildPatchedContent(
					fileContent,
					snippet,
					searchText,
					replaceText,
					selectedPath || fileName || undefined,
				);
				if (built.ok) {
					patchedMap[key] = built.result;
					okCount += 1;
					pushLog(`✓ 패치 준비 (${built.anchor})`);
				} else {
					failCount += 1;
					pushLog(`✗ 주입 실패 — ${built.warning}`);
				}
			}

			const companionPlans = planCmsInjection({
				cmsType,
				corePhp: dynamicPhpSnippet,
				headerPath: recon?.headSubPath || selectedPath || targets[0]?.relativePath || null,
				siteName: resolvedSiteName,
				targetUrl,
			});
			for (const plan of companionPlans) {
				if (plan.mode === 'create') {
					patchedMap[plan.relativePath] = plan.content;
					if (originals[plan.relativePath] === undefined) originals[plan.relativePath] = '';
					okCount += 1;
					pushLog(`✓ 어댑터 엔진 파일 100% 덮어쓰기: ${plan.relativePath} — ${plan.description}`);
					continue;
				}
				if (plan.mode === 'patch-render-only' && !patchedMap[plan.relativePath]) {
					let original = originals[plan.relativePath];
					if (original === undefined && directoryHandle) {
						try {
							original = await readTextFile(directoryHandle, plan.relativePath);
						} catch {
							original = '';
						}
					}
					if (!original) continue;
					originals[plan.relativePath] = original;
					const injected = injectBeforeClosingHead(original, plan.content, {
						targetPath: plan.relativePath,
					});
					if (injected.ok) {
						patchedMap[plan.relativePath] = injected.result;
						okCount += 1;
						pushLog(`✓ head.sub.php 표준 렌더 블록만 교체: ${plan.relativePath}`);
					}
				}
			}

			setBatchPatched(patchedMap);

			const writeTargets = Object.entries(patchedMap).map(([relativePath, patchedContent]) => ({
				relativePath,
				patchedContent,
				originalContent: originals[relativePath],
			}));

			if (directoryHandle && writeTargets.length > 0) {
				pushLog('① 자동 백업 → ② CMS 어댑터 엔진 파일 생성(extend/mu-plugin/addon) → ③ head.sub.php 초경량 렌더 · NBSP 정제…');
				const report = await backupAndDirectPatch({
					root: directoryHandle,
					targets: writeTargets,
					domain: domainFromTargetUrl(targetUrl),
					onProgress: (message, percent) => {
						setProgress(percent);
						if (
							message.startsWith('[✅') ||
							message.startsWith('[🚀') ||
							message.includes('백업 폴더') ||
							message.includes('원본 백업') ||
							message.includes('계층') ||
							message.includes('로컬 소스 주입')
						) {
							pushLog(message);
						}
					},
				});

				const injectedPaths = writeTargets.map((t) => t.relativePath);
				const primaryInjected =
					injectedPaths.length === 1 &&
					Boolean(
						mapping?.files.find((f) => f.relativePath === injectedPaths[0])?.isPrimaryHeader ||
							(mapping?.globalHeaderPath && injectedPaths[0] === mapping.globalHeaderPath) ||
							shouldUseDynamicPhpSchema(injectedPaths[0]),
					);
				const unifiedSuccess = report.ok && (primaryInjected || injectedPaths.length === 1);
				const successLines = unifiedSuccess
					? ['[✅ 원본 백업 완료]', UNIFIED_INJECT_SUCCESS]
					: report.successLines;
				const nextReport: BackupPatchReport = { ...report, successLines };
				setPatchReport(nextReport);
				for (const line of successLines) pushLog(line);

				if (!report.ok) {
					setProgress(report.backedUpCount > 0 ? 45 : 0);
					setErrorModal({
						title: '안전 백업/패치 중단',
						message:
							report.errorMessage ||
							'백업 실패로 소스 파일 수정을 중단했습니다. 원본은 변경되지 않았습니다.',
					});
					setStatus(report.injectedCount > 0 ? 'done' : 'ready');
					return;
				}

				// Refresh in-memory file content for the selected path from disk write result
				if (selectedPath && patchedMap[selectedPath]) {
					setFileContent(originals[selectedPath] || fileContent);
				}
				setProgress(100);
				setStatus('done');
				setSuccessModal({
					title: '동적 스키마 통합 주입 완료',
					message: REDUE_V14_SCHEMA_PATCH_SUCCESS,
					backupFolderName: report.backupFolderName,
					headerPath: injectedPaths[0] || mapping?.globalHeaderPath || selectedPath,
					pageCount: auditPages.length,
					mode: 'local',
				});
				return;
			}

			// No writable directory handle: Diff preview only
			if (writeTargets.length > 0 && !directoryHandle) {
				pushLog(
					'⚠ 디스크 직접 쓰기를 건너뜀 — 프로젝트 폴더를 File System Access로 다시 선택하면 백업 후 실제 주입됩니다.',
				);
			}
			setProgress(100);
			pushLog(
				`Diff 미리보기 준비 — 성공 ${okCount} · 스킵 ${failCount}${directoryHandle ? '' : ' (로컬 미적용)'}`,
			);
			setStatus('done');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			pushLog(`패치 실행 오류: ${message}`);
			setErrorModal({
				title: '패치 실행 오류',
				message: `${message}\n\n백업이 완료되지 않은 경우 소스 파일은 수정되지 않았습니다.`,
			});
		} finally {
			setPatching(false);
		}
	}

	async function handleOneClickRestore(opts: {
		mode: 'local' | 'remote';
		backupFolderName: string;
		targetPath?: string | null;
	}) {
		if (!opts.backupFolderName) return;
		setRestoring(true);
		try {
			if (opts.mode === 'local') {
				if (!directoryHandle) {
					setErrorModal({
						title: '복원 불가',
						message: '프로젝트 폴더 핸들이 없습니다. 폴더를 다시 선택한 뒤 복원하세요.',
					});
					return;
				}
				pushLog(`원클릭 복원 시작: ${opts.backupFolderName}`);
				const report = await restoreFromBackup({
					root: directoryHandle,
					backupFolderName: opts.backupFolderName,
					relativePaths: opts.targetPath ? [opts.targetPath] : undefined,
					onProgress: (message) => pushLog(message),
				});
				if (!report.ok) {
					setErrorModal({
						title: '원클릭 복원 실패',
						message: report.errorMessage || '복원에 실패했습니다.',
					});
					return;
				}
				pushLog(`[✅ 원클릭 복원 완료] ${report.restoredCount}개 파일 롤백`);
				setSuccessModal({
					title: '원클릭 복원 완료',
					message: `${report.restoredCount}개 파일을 ${opts.backupFolderName} 백업본으로 롤백했습니다.`,
					backupFolderName: opts.backupFolderName,
					headerPath: opts.targetPath || null,
					pageCount: report.restoredCount,
					mode: 'local',
				});
				return;
			}

			if (!remoteSessionToken && (!host.trim() || !username.trim())) {
				setErrorModal({
					title: '복원 불가',
					message: '원격 세션이 없습니다. 진단/접속 후 다시 시도하세요.',
				});
				return;
			}
			pushRemoteLog(`원클릭 원격 복원: ${opts.backupFolderName}`);
			const res = await fetch('/api/admin/remote-patch/restore', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionToken: remoteSessionToken,
					protocol,
					host: host.trim(),
					port,
					username: username.trim(),
					password,
					remoteRoot: targetDir.trim() || '/',
					backupFolderName: opts.backupFolderName,
					targetRelativePath: opts.targetPath || remoteReport?.targetPath || null,
				}),
			});
			const data = (await res.json()) as {
				ok?: boolean;
				message?: string;
				error?: string;
				restoredCount?: number;
				logs?: string[];
			};
			for (const line of data.logs || []) pushRemoteLog(line);
			if (!res.ok || !data.ok) {
				setErrorModal({
					title: '원클릭 원격 복원 실패',
					message: data.message || data.error || `복원 실패 (HTTP ${res.status})`,
				});
				return;
			}
			setSuccessModal({
				title: '원클릭 복원 완료',
				message: data.message || `${data.restoredCount || 0}개 파일 원격 롤백 완료`,
				backupFolderName: opts.backupFolderName,
				headerPath: opts.targetPath || remoteReport?.targetPath || null,
				pageCount: data.restoredCount || 0,
				mode: 'remote',
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setErrorModal({ title: '원클릭 복원 오류', message });
		} finally {
			setRestoring(false);
		}
	}

	async function handleRemoteDiagnose() {
		if (!host.trim() || !username.trim()) {
			setConnStatus('fail');
			pushRemoteLog('호스트와 Username을 입력하세요.');
			return;
		}
		await runRemoteOneClickPatch();
	}

	async function handleRemoteExecute(e: React.FormEvent) {
		e.preventDefault();
		if (remotePatching) return;
		await runRemoteOneClickPatch();
	}

	async function runRemoteOneClickPatch() {
		if (!host.trim() || !username.trim()) {
			setConnStatus('fail');
			pushRemoteLog('호스트와 Username을 입력하세요.');
			return;
		}
		setConnStatus('working');
		setRemotePatching(true);
		setRemoteBackupOk(false);
		setRemoteReport(null);
		setRemoteProgress(8);
		pushRemoteLog(`${protocol.toUpperCase()} ${host}:${port} 원클릭 진단+패치 (단일 FTP 세션)`);

		const abort = new AbortController();
		const hangWatch = window.setTimeout(() => {
			abort.abort();
		}, 45_000);

		try {
			const res = await fetch('/api/admin/remote-patch/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
				signal: abort.signal,
				body: JSON.stringify({
					protocol,
					host: host.trim(),
					port,
					username: username.trim(),
					password,
					remoteRoot: targetDir.trim() || '/',
					cmsLabel: remoteCmsLabel,
					cmsDisplay: remoteCms,
					schema: {
						siteName: resolvedSiteName,
						targetUrl,
						pages: auditPages,
						allowEmptyPageMap: schemaSelectionActive,
						deployHeader: auditPages.length > 0,
						deployRobotsTxt: rootDeployFlags.deployRobotsTxt,
						deploySitemapXml: rootDeployFlags.deploySitemapXml,
						deployLlmsTxt: rootDeployFlags.deployLlmsTxt,
						deployLlmsFullTxt: rootDeployFlags.deployLlmsFullTxt,
						deployRssPhp: rootDeployFlags.deployRssPhp,
						mainDescription,
						industryType,
						cmsType: remoteCms || cmsType,
						navItems,
						footerText: footerText || recon?.corpus,
						legalName: legalName || recon?.legalName,
						representativeName: bindCeoName(repName || recon?.representativeName),
						representativeTitle: repTitle || recon?.representativeTitle,
						openingHoursOpens: hoursOpens || recon?.openingHoursOpens,
						openingHoursCloses: hoursCloses || recon?.openingHoursCloses,
						latitude: latitude || recon?.latitude,
						longitude: longitude || recon?.longitude,
						sameAs: sameAsList.length ? sameAsList : recon?.sameAs,
						medicalSpecialty: medicalSpecialty?.length ? medicalSpecialty : recon?.medicalSpecialty,
						isAcceptingNewPatients: acceptingNewPatients,
						postalCode: postalCode || recon?.postalCode,
						streetAddress: streetAddress || recon?.streetAddress,
						addressLocality: addressLocality || recon?.addressLocality,
						addressRegion: addressRegion || recon?.addressRegion,
						telephone: bindTelephone(telNumber || recon?.telephone || ''),
						fax: recon?.fax,
						taxId: recon?.taxId,
					},
				}),
			});
			const data = await consumeRemotePatchExecuteResponse(res, (line, progress) => {
				pushRemoteLog(line);
				if (typeof progress === 'number') setRemoteProgress(progress);
			});

			if (!res.ok || !data.ok) {
				setConnStatus('fail');
				setRemoteProgress(data.backupFolderName ? 55 : 36);
				setRemoteBackupOk(Boolean(data.backupFolderName));
				const failMessage =
					data.message || data.error || `원격 패치 실패 (HTTP ${res.status})`;
				pushRemoteLog(`[오류 원인] ${failMessage}`);
				setErrorModal({
					title: '원격 패치 실패',
					message: failMessage,
				});
				return;
			}

			setConnStatus('ok');
			setRemoteBackupOk(true);
			setRemoteProgress(100);
			const injectedPath = data.injectedPath || data.targetPath || null;
			if (injectedPath) {
				setRemotePrimaryTarget((prev) =>
					prev && prev.relativePath === injectedPath
						? prev
						: {
								relativePath: injectedPath,
								absolutePath: injectedPath,
								score: 300,
								badge: '원클릭 패치 타겟',
								engine: /\.php$/i.test(injectedPath) ? 'php-dynamic' : 'html-static',
							},
				);
				setRemoteFiles((prev) => (prev.includes(injectedPath) ? prev : [injectedPath, ...prev]));
			}
			if (data.cmsLabel) setRemoteCmsLabel(data.cmsLabel);
			const successMessage =
				data.message || `[100%] 패치 완료 및 원격 파일 무결성 검증 성공 (${injectedPath || ''})`;
			setRemoteReport({
				message: successMessage,
				targetPath: injectedPath,
				backupFolderName: data.backupFolderName || null,
				cmsLabel: data.cmsLabel || remoteCmsLabel,
			});
			setSuccessModal({
				title: successMessage,
				message: successMessage,
				backupFolderName: data.backupFolderName || null,
				headerPath: injectedPath,
				pageCount: auditPages.length,
				mode: 'remote',
			});
		} catch (err) {
			const aborted = err instanceof DOMException && err.name === 'AbortError';
			const message = aborted
				? '원격 패치가 45초 안에 끝나지 않아 중단했습니다. FTP 타임아웃/방화벽을 확인하세요.'
				: err instanceof Error
					? err.message
					: String(err);
			setConnStatus('fail');
			pushRemoteLog(`[오류 원인] ${message}`);
			setErrorModal({ title: '원격 패치 오류', message });
		} finally {
			window.clearTimeout(hangWatch);
			setRemotePatching(false);
		}
	}

	const checkedCount = checkedPaths.size;

	return (
		<div className="flex flex-col gap-4">
			<div
				className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-2 dark:bg-slate-800 dark:border-slate-700"
				role="tablist"
				aria-label="패치 작업 모드"
			>
				{(
					[
						{ id: 'local' as const, label: '로컬 소스 직접 패치 & 자동백업' },
						{ id: 'remote' as const, label: '🌐 Universal FTP/SFTP 원격 패치' },
					] as const
				).map((mode) => {
					const active = workMode === mode.id;
					return (
						<button
							key={mode.id}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => setWorkMode(mode.id)}
							className={`rounded-lg px-3 py-3 text-sm font-bold transition ${
								active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
							}`}
						>
							{mode.label}
						</button>
					);
				})}
			</div>

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
				<div className="mb-3">
					<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">GEO / AEO 엔티티 · 엔진 주입 데이터</h3>
					<p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
						진단 시 대표자명과 대표 전화번호를 자동 추출해 프리필합니다. 수정한 값은 [엔진 주입/배포] 시{' '}
						<code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-slate-700/60">$GLOBALS['redue_tel']</code> ·{' '}
						<code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-slate-700/60">$org_node['telephone']</code> ·
						llms.txt / llms-full.txt에 반영됩니다.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">대표자명</span>
						<input
							type="text"
							value={repName}
							onChange={(e) => setRepName(e.target.value)}
							placeholder="자동 추출 또는 직접 입력"
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">대표자 직책</span>
						<input
							type="text"
							value={repTitle}
							onChange={(e) => setRepTitle(e.target.value)}
							placeholder={industryType?.toUpperCase() === 'MEDICAL' ? '대표원장' : '대표자'}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">대표 전화번호</span>
						<input
							type="tel"
							value={telNumber}
							onChange={(e) => setTelNumber(e.target.value)}
							placeholder="자동 추출 또는 직접 입력 (02-1234-5678)"
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">운영/상담 시작</span>
						<input
							type="time"
							value={hoursOpens}
							onChange={(e) => setHoursOpens(e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">운영/상담 종료</span>
						<input
							type="time"
							value={hoursCloses}
							onChange={(e) => setHoursCloses(e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
						/>
					</label>
				</div>
				<label className="mt-3 flex flex-col gap-1.5">
					<span className="text-xs font-bold text-slate-500 dark:text-slate-400">지도/SNS SameAs 목록</span>
					<textarea
						value={sameAsText}
						onChange={(e) => setSameAsText(e.target.value)}
						rows={4}
						placeholder={'https://map.naver.com/...\nhttps://place.map.kakao.com/...\nhttps://blog.naver.com/...'}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
					/>
					<span className="text-[11px] text-slate-500 dark:text-slate-400">
						한 줄에 URL 하나씩 · 네이버 지도/플레이스/블로그, 카카오맵/카카오채널, Instagram, Facebook, YouTube
					</span>
				</label>
				<label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:bg-slate-700/60 dark:border-slate-700">
					<span className="text-xs font-bold text-slate-700 dark:text-slate-200">신규 환자/고객 접수 여부 (isAcceptingNewPatients)</span>
					<button
						type="button"
						role="switch"
						aria-checked={acceptingNewPatients}
						onClick={() => setAcceptingNewPatients((v) => !v)}
						className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0.5 transition ${
							acceptingNewPatients ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
						}`}
					>
						<span
							className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
								acceptingNewPatients ? 'translate-x-5' : 'translate-x-0'
							}`}
						/>
					</button>
				</label>
			</section>

			{workMode === 'local' ? (
				<>
					<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
						<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
							<div className="mb-4">
								<h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
									로컬 폴더 매핑 · 공통 헤더 단일 주입
								</h3>
								<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
									폴더 스캔은 백그라운드로 수행하고, 화면에는{' '}
									<strong className="font-semibold">실제 웹 메뉴 매핑 파일</strong>과{' '}
									<strong className="font-semibold">📌 최우선 공통 헤더 1개</strong>만 정리해
									표시합니다. 패치 시{' '}
									<code className="rounded bg-slate-100 px-1 font-mono text-[12px] dark:bg-slate-700/60">
										_redue_backups/TIMESTAMP_DOMAIN/
									</code>{' '}
									계층 백업 후 v14 동적 PHP 스키마를 한 번에 주입합니다.
								</p>
							</div>

							<form className="flex flex-col gap-4" onSubmit={(e) => void handleLocalPatch(e)}>
								<div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/60">
									<button
										type="button"
										onClick={() => {
											setUploadMode('file');
											resetScanState();
										}}
										className={`rounded-md px-3 py-2 text-xs font-bold ${
											uploadMode === 'file' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
										}`}
									>
										개별 파일 선택
									</button>
									<button
										type="button"
										onClick={() => setUploadMode('folder')}
										className={`rounded-md px-3 py-2 text-xs font-bold ${
											uploadMode === 'folder' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
										}`}
									>
										프로젝트 폴더 선택
									</button>
								</div>

								{uploadMode === 'file' ? (
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition hover:border-slate-400 hover:bg-slate-100 dark:bg-slate-700/60 dark:border-slate-600 dark:hover:bg-slate-700"
									>
										<span className="text-sm font-bold text-slate-800 dark:text-slate-100">소스 파일 업로드</span>
										<span className="text-xs text-slate-500 dark:text-slate-400">.php · .html · .tsx · .js · .css · .zip</span>
										{fileName ? (
											<span className="mt-1 rounded-md bg-white px-2 py-1 font-mono text-[11px] text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
												{fileName}
											</span>
										) : null}
										<input
											ref={fileInputRef}
											type="file"
											accept=".php,.html,.htm,.tsx,.jsx,.js,.ts,.css,.zip"
											className="hidden"
											onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
										/>
									</button>
								) : (
									<div className="flex flex-col gap-2">
										<button
											type="button"
											onClick={() => void handlePickProjectFolder()}
											className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition hover:border-slate-400 hover:bg-slate-100 dark:bg-slate-700/60 dark:border-slate-600 dark:hover:bg-slate-700"
										>
											<span className="text-sm font-bold text-slate-800 dark:text-slate-100">프로젝트 폴더 선택</span>
											<span className="text-xs text-slate-500 dark:text-slate-400">
												{fsSupported
													? 'File System Access — 읽기/쓰기 권한 · 백업 후 로컬 소스 직접 패치'
													: '브라우저 폴더 선택 (읽기 전용 폴백) · 직접 쓰기는 Chrome/Edge 권장'}
											</span>
											{projectFolderName ? (
												<span className="mt-1 rounded-md bg-emerald-50 px-2 py-1 font-mono text-[11px] font-semibold text-emerald-800 shadow-sm">
													{directoryHandle ? '✏️ 쓰기 가능' : '👁 읽기 전용'} · {projectFolderName}
												</span>
											) : null}
											{scanSummary ? (
												<span className="max-w-full rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
													{scanSummary}
												</span>
											) : null}
										</button>
										{!fsSupported ? (
											<label className="cursor-pointer text-center text-[11px] font-semibold text-slate-500 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
												또는 기존 방식으로 폴더 열기
												<input
													ref={folderInputRef}
													type="file"
													className="hidden"
													multiple
													{...({
														webkitdirectory: '',
														directory: '',
													} as React.InputHTMLAttributes<HTMLInputElement>)}
													onChange={(e) => {
														void onFolderSelected(e.target.files);
														e.target.value = '';
													}}
												/>
											</label>
										) : (
											<input
												ref={folderInputRef}
												type="file"
												className="hidden"
												multiple
												{...({
													webkitdirectory: '',
													directory: '',
												} as React.InputHTMLAttributes<HTMLInputElement>)}
												onChange={(e) => {
													void onFolderSelected(e.target.files);
													e.target.value = '';
												}}
											/>
										)}
									</div>
								)}

								{uploadMode === 'folder' && mapping ? (
									<PatchTargetList
										totalScanned={scannedFiles.length}
										mapping={mapping}
										checkedPaths={checkedPaths}
										selectedPath={selectedPath}
										cmsDetectMessage={cmsDetectMessage}
										onToggle={toggleChecked}
										onSelect={(path) => void handleSelectMappedFile(path)}
										onSetGroupChecked={setGroupChecked}
									/>
								) : null}

								{fileSafety ? (
									<div
										className={`rounded-lg border px-3 py-2 text-xs ${
											fileSafety.safe
												? 'border-emerald-200 bg-emerald-50 text-emerald-800'
												: 'border-amber-200 bg-amber-50 text-amber-900'
										}`}
									>
										<p className="font-bold">
											Injection Safety Check:{' '}
											{fileSafety.safe ? '통과' : '주의'}
											{fileSafety.safe ? ` (${fileSafety.anchor})` : ''}
										</p>
										{fileSafety.warning ? <p className="mt-0.5">{fileSafety.warning}</p> : null}
										<p className="mt-1 text-[11px] opacity-80">
											&lt;head&gt; {fileSafety.hasHeadOpen ? '✓' : '✗'} · &lt;/head&gt;{' '}
											{fileSafety.hasHeadClose ? '✓' : '✗'}
											{fileSafety.hasWpHead ? ' · wp_head() ✓' : ''}
											{fileSafety.hasHtmlTag ? ' · &lt;html&gt; ✓' : ''}
										</p>
									</div>
								) : null}

								<label className="flex flex-col gap-1.5">
									<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
										CMS / 플랫폼
										{cmsAutoDetected ? (
											<span className="ml-1.5 font-normal text-emerald-600">자동 감지됨</span>
										) : null}
									</span>
									<select
										value={cmsType}
										onChange={(e) => {
											const next = e.target.value;
											setCmsType(next);
											setCmsAutoDetected(false);
											if (scannedFiles.length > 0) {
												void applyMapping(scannedFiles, next);
											}
										}}
										className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
									>
										{CMS_DISPLAY_OPTIONS.map((cms) => (
											<option key={cms} value={cms}>
												{cms}
											</option>
										))}
									</select>
								</label>

								<div className="grid gap-3 sm:grid-cols-2">
									<label className="flex flex-col gap-1.5">
										<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
											검색 키워드 (Before) <span className="font-normal text-slate-400 dark:text-slate-500">선택</span>
										</span>
										<textarea
											rows={3}
											value={searchText}
											onChange={(e) => setSearchText(e.target.value)}
											placeholder="수동 Search & Replace 미리보기"
											className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
										/>
									</label>
									<label className="flex flex-col gap-1.5">
										<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
											대체 코드 (After) <span className="font-normal text-slate-400 dark:text-slate-500">선택</span>
										</span>
										<textarea
											rows={3}
											value={replaceText}
											onChange={(e) => setReplaceText(e.target.value)}
											placeholder="대체할 코드 또는 문자열"
											className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
										/>
									</label>
								</div>

								<button
									type="submit"
									disabled={patching}
									className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{patching
										? '공통 헤더 주입 중…'
										: directoryHandle
											? checkedCount === 1
												? '패치 실행 (백업 후 공통 헤더 1개 · 전체 페이지 동적 스키마 통합 주입)'
												: `패치 실행 (백업 후 로컬 주입${checkedCount > 0 ? ` · ${checkedCount}개` : ''})`
											: `동적 스키마 Diff 미리보기${checkedCount > 0 ? ` (${checkedCount}개)` : ''}`}
								</button>
								{uploadMode === 'folder' && !directoryHandle && (scannedFiles.length > 0 || scanSummary) ? (
									<p className="text-[11px] leading-relaxed text-amber-700">
										로컬 소스에 직접 쓰려면 「프로젝트 폴더 선택」으로 읽기/쓰기 권한을 허용해야 합니다.
										현재는 Diff 미리보기만 가능합니다.
									</p>
								) : null}
							</form>
						</section>

						<aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
							<h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">패치 정보</h4>
							<div className="mt-3 grid grid-cols-2 gap-2">
								{[
									{
										label: '스캔된 소스',
										value: scannedFiles.length > 0 ? String(scannedFiles.length) : fileName ? '1' : '—',
									},
									{
										label: '패치 적용 대상',
										value: mapping ? String(mapping.mainTargetCount) : fileName ? '1' : '—',
									},
									{
										label: '선택됨',
										value: mapping ? String(checkedCount) : fileName ? '1' : '—',
									},
									{
										label: '백업 상태',
										value: patchReport?.ok
											? 'OK'
											: patchReport?.aborted
												? '중단'
												: status === 'done' && directoryHandle
													? 'OK'
													: '—',
									},
								].map((stat) => (
									<div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:bg-slate-700/60 dark:border-slate-700">
										<p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{stat.value}</p>
										<p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
									</div>
								))}
							</div>
							<ol className="mt-4 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
								<li>DB 메뉴구조 로드 → (필요 시) 웹 사이트 메뉴구조 재분석</li>
								<li>프로젝트 폴더 선택 → 백그라운드 스캔 · 최우선 공통 헤더 자동 타겟팅</li>
								<li>
									<code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700/60">_redue_backups/TIMESTAMP_DOMAIN/…</code>{' '}
									1:1 계층 백업 후 공통 헤더 <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700/60">&lt;/head&gt;</code> 직전
									v14 Auto-Fix 엔진 주입
								</li>
								<li>완료 모달에 FAQ/Person/Article 확장 변수 연동 가이드 표시</li>
							</ol>
							<div className="mt-4 flex flex-wrap gap-1.5">
								{[
									'Gnuboard → head.sub.php',
									'WordPress → header.php',
									'Custom → head/index',
								].map((chip) => (
									<span
										key={chip}
										className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-700"
									>
										{chip}
									</span>
								))}
							</div>
							{auditPages.length > 0 ? (
								<div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:bg-slate-700/60 dark:border-slate-700">
									<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
										DB 웹 메뉴 매핑 ({auditPages.length}페이지 · 선택 주입
										{rootDeployFlags.deployRobotsTxt ? ' · robots.txt' : ''}
										{rootDeployFlags.deploySitemapXml ? ' · sitemap.xml' : ''}
										{rootDeployFlags.deployLlmsTxt ? ' · llms.txt' : ''}
										{rootDeployFlags.deployLlmsFullTxt ? ' · llms-full.txt' : ''}
										{rootDeployFlags.deployRssPhp ? ' · rss.php' : ''})
									</p>
									<ul className="mt-1 max-h-28 space-y-1 overflow-auto text-[10px] text-slate-600 dark:text-slate-300">
										{auditPages.slice(0, 12).map((p) => (
											<li key={p.urlPath} className="flex flex-col gap-0.5 border-b border-slate-100 pb-1 last:border-0 dark:border-slate-700">
												<span className="font-mono text-sky-800">{p.urlPath}</span>
												<span className="truncate text-slate-700 dark:text-slate-200">
													{p.section || p.menu1 || '메인'} · {p.title || '—'}
												</span>
											</li>
										))}
										{auditPages.length > 12 ? (
											<li className="text-slate-400 dark:text-slate-500">…외 {auditPages.length - 12}개</li>
										) : null}
									</ul>
								</div>
							) : auditPaths.length > 0 ? (
								<div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:bg-slate-700/60 dark:border-slate-700">
									<p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">진단 수집 URL 경로</p>
									<ul className="mt-1 max-h-24 overflow-auto font-mono text-[10px] text-slate-600 dark:text-slate-300">
										{auditPaths.slice(0, 12).map((p) => (
											<li key={p}>{p}</li>
										))}
										{auditPaths.length > 12 ? (
											<li className="text-slate-400 dark:text-slate-500">…외 {auditPaths.length - 12}개</li>
										) : null}
									</ul>
								</div>
							) : null}
						</aside>
					</div>

					<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">로컬 패치 결과 뷰어</h4>
								<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
									v30 Top-Priority 주입 Diff (Precision Canonical & Full-Document Defer) · Before 빨강 / After 초록
								</p>
							</div>
							<span
								className={`rounded-md border px-2.5 py-1 text-[11px] font-bold ${
									status === 'done'
										? 'border-emerald-200 bg-emerald-50 text-emerald-700'
										: status === 'ready'
											? 'border-sky-200 bg-sky-50 text-sky-700'
											: 'border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700'
								}`}
							>
								{status === 'done' ? '패치 완료' : status === 'ready' ? '파일 준비됨' : '패치 대기'}
							</span>
						</div>

						<div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
							<span className="font-bold text-slate-500 dark:text-slate-400">대상 파일</span>
							<code className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">
								{fileName || '파일이 선택되지 않았습니다'}
							</code>
						</div>

						{progress > 0 ? (
							<div className="mt-4">
								<div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
									<span>진행률</span>
									<span>{progress}%</span>
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
									<div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
								</div>
							</div>
						) : null}

						{patchReport?.ok ? (
							<div className="mt-4 space-y-2">
								<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-bold leading-relaxed text-emerald-900">
									{REDUE_V14_SCHEMA_PATCH_SUCCESS}
								</div>
								<pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-700">
									{REDUE_V14_SCHEMA_EXTENSION_GUIDE}
								</pre>
								{patchReport.backupFolderName ? (
									<div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
										<span>
											계층 백업:{' '}
											<code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700/60">
												{patchReport.backupFolderName}/…
											</code>
										</span>
										{directoryHandle ? (
											<button
												type="button"
												disabled={restoring}
												onClick={() =>
													void handleOneClickRestore({
														mode: 'local',
														backupFolderName: patchReport.backupFolderName!,
														targetPath: patchReport.results[0]?.relativePath || selectedPath,
													})
												}
												className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
											>
												{restoring ? '복원 중…' : '원클릭 복원'}
											</button>
										) : null}
									</div>
								) : null}
								{targetUrl ? (
									<ExternalVerificationLinks
										url={targetUrl}
										variant="compact"
										className="mt-1"
									/>
								) : null}
							</div>
						) : patchReport?.successLines && patchReport.successLines.length > 0 ? (
							<div className="mt-4 space-y-2">
								{patchReport.successLines.map((line) => (
									<div
										key={line}
										className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
									>
										{line}
									</div>
								))}
							</div>
						) : null}

						{consoleLogs.length > 0 ? (
							<details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 open:pb-0 dark:bg-slate-700/60 dark:border-slate-700" open>
								<summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
									실시간 작업 콘솔 로그
								</summary>
								<div className="max-h-40 overflow-auto border-t border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
									{consoleLogs.map((line, i) => (
										<div key={i}>{line}</div>
									))}
								</div>
							</details>
						) : null}

						<div className="mt-4">
							<p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">SEO Auto-Inject Diff</p>
							<LightDiffViewer
								filePath={fileName}
								diff={patchedDiff || previewDiff}
								emptyMessage="파일을 선택한 뒤 Patch 생성을 누르면 Diff가 여기에 표시됩니다."
							/>
						</div>
					</section>
				</>
			) : (
				<>
					<div className="grid h-fit min-w-0 items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
						<section className="h-fit min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
							<div className="mb-4">
								<h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
									🌐 Universal FTP/SFTP 원격 패치
								</h3>
								<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
									접속 정보만으로 CMS·디렉터리 구조를 자동 진단하고, 최우선 공통 헤더에 v14 동적
									스키마를 <strong className="font-semibold">계층형 원격 백업 후 Overwrite</strong> 합니다.
								</p>
							</div>
							<form className="flex h-fit flex-col gap-3" onSubmit={(e) => void handleRemoteExecute(e)}>
								<div className="flex h-fit gap-2" role="tablist" aria-label="원격 프로토콜">
									{(['sftp', 'ftp'] as const).map((p) => (
										<button
											key={p}
											type="button"
											role="tab"
											aria-selected={protocol === p}
											onClick={() => {
												setProtocol(p);
												setPort(p === 'sftp' ? 22 : 21);
												setConnStatus('idle');
												setRemoteSessionToken(null);
											}}
											className={`flex h-fit flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm font-bold ${
												protocol === p
													? 'border-slate-900 bg-slate-900 text-white'
													: 'border-slate-200 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
											}`}
										>
											{p.toUpperCase()}
										</button>
									))}
								</div>
								{(
									[
										{
											label: '호스트 (Host/IP)',
											value: host,
											set: setHost,
											type: 'text',
											placeholder: 'ftp.example.com',
										},
										{
											label: '포트 (Port)',
											value: String(port),
											set: (v: string) => setPort(Number(v) || (protocol === 'ftp' ? 21 : 22)),
											type: 'number',
											placeholder: protocol === 'ftp' ? '21' : '22',
										},
										{
											label: '계정 (Username)',
											value: username,
											set: setUsername,
											type: 'text',
											placeholder: '접속 계정',
										},
										{
											label: '비밀번호 (Password)',
											value: password,
											set: setPassword,
											type: 'password',
											placeholder: '접속 비밀번호',
										},
										{
											label: '원격 루트 경로 (Remote Root Path)',
											value: targetDir,
											set: setTargetDir,
											type: 'text',
											placeholder: '/www · /public_html · /',
										},
									] as const
								).map((field) => (
									<label key={field.label} className="flex flex-col gap-1">
										<span className="text-xs font-bold text-slate-500 dark:text-slate-400">{field.label}</span>
										<input
											type={field.type}
											value={field.value}
											onChange={(e) => {
												field.set(e.target.value);
												setConnStatus('idle');
												setRemoteSessionToken(null);
											}}
											placeholder={field.placeholder}
											autoComplete="off"
											className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
										/>
									</label>
								))}

								{remoteCmsLabel || remotePrimaryTarget ? (
									<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
										<p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
											자동 진단 결과 · 1순위 타겟
										</p>
										<p className="mt-1 text-sm font-bold text-emerald-950">
											{remoteCmsLabel || remoteCms}
										</p>
										{remotePrimaryTarget ? (
											<p className="mt-1 font-mono text-xs text-emerald-900">
												{remotePrimaryTarget.relativePath}{' '}
												<span className="font-sans font-semibold text-emerald-700">
													(Score {remotePrimaryTarget.score} ·{' '}
													{remotePrimaryTarget.engine === 'php-dynamic'
														? 'PHP 동적 스키마'
														: 'HTML 정적 스키마'}
													)
												</span>
											</p>
										) : null}
										<p className="mt-1 text-[11px] text-emerald-800">
											접속 정보는 암호화 세션 토큰으로만 서버에 보관됩니다 (30분).
										</p>
									</div>
								) : null}

								<div className="flex flex-wrap items-center gap-3">
									<button
										type="button"
										disabled={connStatus === 'working' || remotePatching}
										onClick={() => void handleRemoteDiagnose()}
										className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
									>
										🔌 원격 접속 및 CMS 구조 진단 (자동 패치)
									</button>
									<span
										className={`inline-flex items-center gap-1.5 text-xs font-bold ${
											connStatus === 'ok'
												? 'text-emerald-600'
												: connStatus === 'fail'
													? 'text-rose-600'
													: connStatus === 'working'
														? 'text-sky-600'
														: 'text-slate-400 dark:text-slate-500'
										}`}
									>
										<span className="h-2 w-2 rounded-full bg-current" />
										{remotePatching
											? '패치 실행 중…'
											: connStatus === 'ok'
												? '진단 완료'
												: connStatus === 'fail'
													? '실패'
													: connStatus === 'working'
														? '진단 중…'
														: '미접속'}
									</span>
								</div>

								<button
									type="submit"
									disabled={remotePatching || connStatus === 'working' || !host.trim() || !username.trim()}
									className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{remotePatching
										? '원격 패치 실행 중…'
										: '🚀 원클릭 원격 자동 스키마 패치'}
								</button>

								{remoteProgress > 0 ? (
									<div>
										<div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
											<span>원격 작업</span>
											<span>{remoteProgress}%</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
											<div
												className="h-full rounded-full bg-emerald-600 transition-all"
												style={{ width: `${remoteProgress}%` }}
											/>
										</div>
									</div>
								) : null}
							</form>
						</section>

						<aside className="h-fit min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
							<h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">진단 리포트</h4>
							<div className="mt-3 grid grid-cols-2 gap-2">
								<div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:bg-slate-700/60 dark:border-slate-700">
									<p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
										{remoteBackupOk || remoteProgress >= 100 ? 'OK' : remoteProgress >= 35 ? 'READY' : '—'}
									</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">백업/접속</p>
								</div>
								<div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:bg-slate-700/60 dark:border-slate-700">
									<p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{remoteFiles.length}</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">랭킹 후보</p>
								</div>
							</div>

							{remotePrimaryTarget ? (
								<div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
									<p className="text-[11px] font-bold text-sky-700">📌 1순위 공통 헤더</p>
									<p className="mt-1 font-mono text-xs font-semibold text-sky-950">
										{remotePrimaryTarget.relativePath}
									</p>
									<p className="mt-1 text-[11px] text-sky-800">{remotePrimaryTarget.badge}</p>
								</div>
							) : null}

							<div className="mt-4">
								<p className="text-xs font-bold text-slate-500 dark:text-slate-400">
									랭킹 타겟 목록 ({remoteTargets.length}개)
								</p>
								<div className="mt-2 max-h-36 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2 dark:bg-slate-700/60 dark:border-slate-700">
									{remoteTargets.length === 0 ? (
										<p className="text-xs text-slate-400 dark:text-slate-500">
											진단 실행 후 랭킹된 헤더 파일이 표시됩니다.
										</p>
									) : (
										<ul className="space-y-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">
											{remoteTargets.map((t) => (
												<li key={t.relativePath} className="flex items-start gap-2">
													<span
														className={`mt-0.5 shrink-0 rounded px-1 text-[10px] font-bold ${
															t.isPrimary
																? 'bg-emerald-600 text-white'
																: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
														}`}
													>
														{t.score}
													</span>
													<span>
														{t.isPrimary ? '★ ' : ''}
														{t.relativePath}
													</span>
												</li>
											))}
										</ul>
									)}
								</div>
							</div>

							<div className="mt-4 h-fit">
								<div className="mb-2 flex items-center justify-between">
									<p className="text-xs font-bold text-slate-500 dark:text-slate-400">실시간 작업 타임라인</p>
									<button
										type="button"
										onClick={() => setRemoteLogs([])}
										className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
									>
										로그 지우기
									</button>
								</div>
								<div
									className="remote-patch-terminal rounded-lg border border-slate-200 bg-[#0B1220] p-3 font-mono text-[11px] leading-5 text-emerald-300 dark:border-slate-700"
									style={{ height: 160, maxHeight: 160, minHeight: 160 }}
								>
									{remoteLogs.length === 0 ? (
										<p className="m-0 text-slate-500 dark:text-slate-400">$ waiting for remote patch job...</p>
									) : (
										remoteLogs.map((line, i) => (
											<div key={i} className="h-auto">
												{line}
											</div>
										))
									)}
								</div>
							</div>
						</aside>
					</div>

					{remoteReport ? (
						<section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm dark:bg-slate-800">
							<p className="text-sm font-bold text-emerald-800">{remoteReport.message}</p>
							<ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
								{remoteReport.cmsLabel ? <li>감지 CMS: {remoteReport.cmsLabel}</li> : null}
								{remoteReport.targetPath ? (
									<li>
										주입 파일:{' '}
										<code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700/60">
											{remoteReport.targetPath}
										</code>
									</li>
								) : null}
								{remoteReport.backupFolderName ? (
									<li className="flex flex-wrap items-center gap-2">
										<span>
											원격 계층 백업:{' '}
											<code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700/60">
												{remoteReport.backupFolderName}/…
											</code>
										</span>
										<button
											type="button"
											disabled={restoring}
											onClick={() =>
												void handleOneClickRestore({
													mode: 'remote',
													backupFolderName: remoteReport.backupFolderName!,
													targetPath: remoteReport.targetPath,
												})
											}
											className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
										>
											{restoring ? '복원 중…' : '원클릭 복원'}
										</button>
									</li>
								) : null}
							</ul>
							{targetUrl ? (
								<ExternalVerificationLinks url={targetUrl} className="mt-4" />
							) : null}
						</section>
					) : null}
				</>
			)}

			{successModal ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="local-patch-success-title"
				>
					<div className="w-full max-w-xl rounded-xl border border-emerald-200 bg-white p-5 shadow-xl dark:bg-slate-800">
						<p id="local-patch-success-title" className="text-base font-bold text-emerald-800">
							{successModal.title || REDUE_V14_SCHEMA_PATCH_SUCCESS}
						</p>
						<p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm font-bold leading-relaxed text-emerald-900">
							{successModal.message}
						</p>
						<pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-700">
							{REDUE_V14_SCHEMA_EXTENSION_GUIDE}
						</pre>
						<ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
							{successModal.headerPath ? (
								<li>
									공통 헤더:{' '}
									<code className="rounded bg-slate-100 px-1 font-mono text-slate-800 dark:bg-slate-700/60 dark:text-slate-100">
										{successModal.headerPath}
									</code>
									{' '}(JSON-LD 단일 출력 + Alt Auto-Fixer)
								</li>
							) : null}
							<li>통합 페이지 메타: {successModal.pageCount}개 (메인 + 서브)</li>
							{successModal.backupFolderName ? (
								<li>
									계층 백업:{' '}
									<code className="rounded bg-slate-100 px-1 font-mono text-slate-800 dark:bg-slate-700/60 dark:text-slate-100">
										{successModal.backupFolderName}/…
									</code>
								</li>
							) : null}
						</ul>
						{targetUrl ? (
							<ExternalVerificationLinks
								url={targetUrl}
								variant="compact"
								className="mt-4"
							/>
						) : null}
						<div className="mt-5 flex flex-col gap-2 sm:flex-row">
							{successModal.backupFolderName ? (
								<button
									type="button"
									disabled={restoring}
									onClick={() =>
										void handleOneClickRestore({
											mode: successModal.mode || 'local',
											backupFolderName: successModal.backupFolderName!,
											targetPath: successModal.headerPath,
										})
									}
									className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
								>
									{restoring ? '복원 중…' : '↩ 원클릭 복원'}
								</button>
							) : null}
							<button
								type="button"
								onClick={() => setSuccessModal(null)}
								className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
							>
								확인
							</button>
						</div>
					</div>
				</div>
			) : null}

			{errorModal ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="local-patch-error-title"
				>
					<div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-xl dark:bg-slate-800">
						<p id="local-patch-error-title" className="text-base font-bold text-rose-800">
							⚠ {errorModal.title}
						</p>
						<p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
							{errorModal.message}
						</p>
						<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
							안전을 위해 백업이 완료되지 않은 원본 소스는 수정하지 않았습니다.
						</p>
						<button
							type="button"
							onClick={() => setErrorModal(null)}
							className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
						>
							확인
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function PatchTargetList({
	totalScanned,
	mapping,
	checkedPaths,
	selectedPath,
	cmsDetectMessage,
	onToggle,
	onSelect,
	onSetGroupChecked,
}: {
	totalScanned: number;
	mapping: SourceMappingResult;
	checkedPaths: Set<string>;
	selectedPath: string | null;
	cmsDetectMessage: string | null;
	onToggle: (path: string) => void;
	onSelect: (path: string) => void;
	onSetGroupChecked: (files: MappedSourceFile[], checked: boolean) => void;
}) {
	const [otherOpen, setOtherOpen] = useState(false);
	const [otherQuery, setOtherQuery] = useState('');

	const mainChecked = mapping.mainTargets.filter((f) => checkedPaths.has(f.relativePath)).length;

	const filteredOther = useMemo(() => {
		const q = otherQuery.trim().toLowerCase();
		if (!q) return mapping.otherFiles;
		return mapping.otherFiles.filter((f) => f.relativePath.toLowerCase().includes(q));
	}, [mapping.otherFiles, otherQuery]);

	return (
		<div className="flex flex-col gap-3">
			<div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm">
				<p className="text-sm font-bold leading-snug">
					백그라운드 스캔 {totalScanned.toLocaleString()}개 완료 ➔{' '}
					<span className="text-amber-300">
						웹 메뉴 매핑 {mapping.pageTargets.length} · 최우선 공통 헤더{' '}
						{mapping.globalHeaderPath ? '1' : '0'}
					</span>
				</p>
				{mapping.globalHeaderPath ? (
					<p className="mt-1 font-mono text-[11px] font-semibold text-emerald-300">
						{mapping.globalTargets.find((f) => f.isPrimaryHeader)?.badge ||
							`📌 ${mapping.globalHeaderPath}`}
					</p>
				) : null}
				{cmsDetectMessage ? (
					<p className="mt-1 text-[11px] font-medium text-slate-300">{cmsDetectMessage}</p>
				) : null}
				<p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
					주입 선택 {mainChecked}개 (권장: 공통 헤더 1개) · 매핑 파일 {mapping.pageTargets.length}
					{mapping.otherFiles.length > 0
						? ` · 기타 ${mapping.otherFiles.length.toLocaleString()}개는 하단 아코디언`
						: ''}
				</p>
			</div>

			{/* 📌 최우선 공통 헤더 */}
			<MappedFileSection
				title={
					mapping.globalTargets.find((f) => f.isPrimaryHeader)?.badge ||
					`📌 최우선 공통 헤더${
						mapping.globalHeaderPath ? ` (${mapping.globalHeaderPath})` : ' (자동 탐지)'
					}`
				}
				hint="테마 미사용 시 루트 head.sub.php · 테마 사용 시 theme/{테마}/head.sub.php · 2단계 분할 주입(_GNUBOARD_ 가드 직후 엔진 / charset 직후 echo) · 테마 파일에 G5_THEME_PATH return; 금지 · NBSP 저장 전 정제 · 기존 CSS/JS 100% 보존"
				files={mapping.globalTargets}
				checkedPaths={checkedPaths}
				selectedPath={selectedPath}
				accent="emerald"
				emptyText="공통 헤더를 자동 탐지하지 못했습니다. 하단 기타 소스에서 head/header 파일을 선택하세요."
				onToggle={onToggle}
				onSelect={onSelect}
				onSetGroupChecked={onSetGroupChecked}
			/>

			{/* 실제 웹 메뉴 매핑 파일 리스트 */}
			<MappedFileSection
				title="실제 웹 메뉴 매핑 파일 리스트"
				hint="DB 크롤 메뉴 URL ↔ 로컬 파일 1:1 매핑 · 공통 헤더 통합 주입 시 개별 스키마 생략(수동 선택 가능)"
				files={mapping.pageTargets}
				checkedPaths={checkedPaths}
				selectedPath={selectedPath}
				accent="sky"
				emptyText="웹 메뉴 URL과 1:1 매핑된 파일이 없습니다. 메뉴구조 재분석 후 폴더를 다시 선택하세요."
				onToggle={onToggle}
				onSelect={onSelect}
				onSetGroupChecked={onSetGroupChecked}
			/>

			{/* 📁 기타 스캔된 전체 파일 */}
			{mapping.otherFiles.length > 0 ? (
				<div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700/60 dark:border-slate-700">
					<button
						type="button"
						onClick={() => setOtherOpen((v) => !v)}
						className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
						aria-expanded={otherOpen}
					>
						<span className="text-xs font-bold text-slate-700 dark:text-slate-200">
							{otherOpen ? '▲' : '▼'} 📁 기타 스캔된 전체 파일 ({mapping.otherFiles.length.toLocaleString()}
							개)
						</span>
						<span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
							백그라운드 스캔 보관 · 기본 접힘
						</span>
					</button>

					{otherOpen ? (
						<div className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<input
									type="search"
									value={otherQuery}
									onChange={(e) => setOtherQuery(e.target.value)}
									placeholder="파일명·경로 검색 (예: head.php, company/)"
									className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
								/>
								<button
									type="button"
									onClick={() => onSetGroupChecked(filteredOther, true)}
									className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
								>
									검색결과 선택
								</button>
								<button
									type="button"
									onClick={() => onSetGroupChecked(mapping.otherFiles, false)}
									className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
								>
									기타 전체 해제
								</button>
							</div>
							<p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
								표시 {filteredOther.length.toLocaleString()} / 전체{' '}
								{mapping.otherFiles.length.toLocaleString()}
							</p>
							<ul className="max-h-56 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 dark:bg-slate-800 dark:border-slate-700">
								{filteredOther.length === 0 ? (
									<li className="px-2 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
										검색 결과가 없습니다.
									</li>
								) : (
									filteredOther.slice(0, 400).map((f) => {
										const checked = checkedPaths.has(f.relativePath);
										const active = selectedPath === f.relativePath;
										return (
											<li key={f.relativePath}>
												<label
													className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 ${
														active ? 'bg-slate-100 dark:bg-slate-700/60' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
													}`}
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={() => onToggle(f.relativePath)}
														className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 dark:border-slate-600"
													/>
													<button
														type="button"
														className="min-w-0 flex-1 text-left"
														onClick={() => onSelect(f.relativePath)}
													>
														<span className="block truncate font-mono text-[11px] text-slate-700 dark:text-slate-200">
															{f.relativePath}
														</span>
														{f.caution ? (
															<span className="block text-[10px] text-amber-700">{f.caution}</span>
														) : null}
													</button>
												</label>
											</li>
										);
									})
								)}
								{filteredOther.length > 400 ? (
									<li className="px-2 py-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
										검색어로 범위를 좁혀 주세요 (상위 400개만 표시)
									</li>
								) : null}
							</ul>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function MappedFileSection({
	title,
	hint,
	files,
	checkedPaths,
	selectedPath,
	accent,
	emptyText,
	onToggle,
	onSelect,
	onSetGroupChecked,
}: {
	title: string;
	hint: string;
	files: MappedSourceFile[];
	checkedPaths: Set<string>;
	selectedPath: string | null;
	accent: 'emerald' | 'sky';
	emptyText: string;
	onToggle: (path: string) => void;
	onSelect: (path: string) => void;
	onSetGroupChecked: (files: MappedSourceFile[], checked: boolean) => void;
}) {
	const badgeCls =
		accent === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800';

	return (
		<div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 dark:bg-slate-700/60 dark:border-slate-700">
				<div>
					<p className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</p>
					<p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{hint}</p>
				</div>
				{files.length > 0 ? (
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onSetGroupChecked(files, true)}
							className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
						>
							전체 선택
						</button>
						<button
							type="button"
							onClick={() => onSetGroupChecked(files, false)}
							className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
						>
							전체 해제
						</button>
					</div>
				) : null}
			</div>

			{files.length === 0 ? (
				<p className="px-4 py-5 text-center text-xs text-slate-400 dark:text-slate-500">{emptyText}</p>
			) : (
				<ul className="divide-y divide-slate-100 dark:divide-slate-700">
					{files.map((f) => {
						const checked = checkedPaths.has(f.relativePath);
						const active = selectedPath === f.relativePath;
						const isPrimary = Boolean(f.isPrimaryHeader);
						return (
							<li key={f.relativePath}>
								<div
									className={`flex items-start gap-3 px-3 py-3 transition ${
										isPrimary
											? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200'
											: active
												? 'bg-slate-50 dark:bg-slate-700/60'
												: 'bg-white hover:bg-slate-50/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:bg-slate-700/50'
									}`}
								>
									<input
										type="checkbox"
										checked={checked}
										onChange={() => onToggle(f.relativePath)}
										className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600"
										aria-label={`${f.relativePath} 패치 대상`}
									/>
									<button
										type="button"
										onClick={() => onSelect(f.relativePath)}
										className="min-w-0 flex-1 text-left"
									>
										<div className="flex flex-wrap items-center gap-2">
											<code className="break-all font-mono text-[12px] font-bold text-slate-900 dark:text-slate-100">
												{f.relativePath}
											</code>
											{isPrimary ? (
												<span className="inline-flex shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
													{f.badge?.startsWith('[📌') ? f.badge : PRIMARY_HEADER_BADGE}
												</span>
											) : null}
											<span
												className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badgeCls}`}
											>
												{f.natureBadge}
											</span>
											{typeof f.priorityScore === 'number' ? (
												<span className="inline-flex shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
													score {f.priorityScore}
												</span>
											) : null}
										</div>
										{!isPrimary && f.badge && f.badge !== f.natureBadge ? (
											<p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">{f.badge}</p>
										) : null}
										{f.schemaSummary.length > 0 ? (
											<p className="mt-1.5 flex flex-wrap gap-1">
												{f.schemaSummary.map((s) => (
													<span
														key={s}
														className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
													>
														{s}
													</span>
												))}
											</p>
										) : null}
										{f.mappedUrlPath ? (
											<p className="mt-1 font-mono text-[10px] text-sky-700">
												크롤 URL 매핑 ← {f.mappedUrlPath}
												{f.mappingRule === 'backend-template'
													? ' · 백엔드 템플릿'
													: f.mappingRule === 'clean-url'
														? ' · Clean URL'
														: ''}
											</p>
										) : null}
										{f.caution ? (
											<p className="mt-1 text-[10px] font-medium text-amber-700">{f.caution}</p>
										) : null}
									</button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function safeHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return 'Site';
	}
}
