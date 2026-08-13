declare module '@toast-ui/editor' {
	type HookCallback = (url: string, text?: string) => void;

	export type EditorOptions = {
		el: HTMLElement;
		height?: string;
		minHeight?: string;
		initialValue?: string;
		previewStyle?: 'tab' | 'vertical';
		initialEditType?: 'markdown' | 'wysiwyg';
		language?: string;
		placeholder?: string;
		usageStatistics?: boolean;
		autofocus?: boolean;
		toolbarItems?: (string | { name: string })[][];
		hooks?: {
			addImageBlobHook?: (blob: Blob | File, callback: HookCallback) => void;
		};
		events?: {
			change?: () => void;
			load?: () => void;
			focus?: () => void;
			blur?: () => void;
		};
	};

	export class Editor {
		constructor(options: EditorOptions);
		getMarkdown(): string;
		getHTML(): string;
		setMarkdown(markdown: string, cursorToEnd?: boolean): void;
		setHTML(html: string, cursorToEnd?: boolean): void;
		destroy(): void;
		focus(): void;
		blur(): void;
		changeMode(mode: 'markdown' | 'wysiwyg', isWithoutFocus?: boolean): void;
		getEditorElements(): {
			mdEditor: HTMLElement;
			mdPreview: HTMLElement;
			wwEditor: HTMLElement;
		};
	}

	export default Editor;
}

declare module '@toast-ui/editor/dist/i18n/ko-kr';

declare module '@toast-ui/editor/dist/toastui-editor.css';
