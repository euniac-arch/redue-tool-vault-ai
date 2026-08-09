export type CmsType = 'WORDPRESS' | 'UNKNOWN';

export type ThemeDetectionMethod = 'override' | 'database' | 'heuristic' | 'none';

export interface CmsDetectionResult {
	cmsType: CmsType;
	rootPath: string;
	hasWpConfig: boolean;
	hasWpLoad: boolean;
	themesDir: string | null;
	themesDirExists: boolean;
	activeTheme: string | null;
	activeThemePath: string | null;
	detectionMethod: ThemeDetectionMethod;
	detectionNote: string;
}

export type TargetPriority = 1 | 2;

export type InjectionAnchor = 'header-head-open' | 'functions-eof';

export interface TargetSelectionResult {
	found: boolean;
	filePath: string | null;
	priority: TargetPriority | null;
	anchor: InjectionAnchor | null;
	reason: string;
}

export interface DiagnosticCheck {
	id: string;
	label: string;
	passed: boolean;
	weight: number;
}

export type ScoreStatus = 'PASS' | 'WARN' | 'FAIL';

export interface DiagnosticReport {
	score: number;
	maxScore: number;
	status: ScoreStatus;
	statusLabel: string;
	checks: DiagnosticCheck[];
}

export interface DiffLineModel {
	type: 'context' | 'add' | 'remove';
	content: string;
	oldLineNumber: number | null;
	newLineNumber: number | null;
}

export interface IndexingPingSummary {
	attempted: boolean;
	siteUrl: string | null;
	indexNow: { success: boolean; message: string } | null;
	google: { success: boolean; message: string } | null;
}

export interface ScanBundle {
	kind: 'preview' | 'applied';
	timestamp: string;
	targetPathInput: string;
	themeOverrideInput: string | null;
	cms: CmsDetectionResult;
	target: TargetSelectionResult;
	diagnostics: DiagnosticReport;
	diff: DiffLineModel[] | null;
	fileRelativePath: string | null;
	injected: boolean;
	indexing?: IndexingPingSummary;
	error?: string;
}
