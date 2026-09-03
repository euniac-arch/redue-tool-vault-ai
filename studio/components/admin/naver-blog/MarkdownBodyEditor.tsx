'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor as ToastEditor } from '@toast-ui/editor';
import { uploadNaverBlogImage } from '@/lib/naver-blog/upload-image';

type Props = {
	value: string;
	onChange: (value: string) => void;
	/** Kept for API compatibility; TOAST UI uses a fixed 600px height. */
	rows?: number;
	disabled?: boolean;
};

function looksLikeHtml(content: string): boolean {
	const trimmed = content.trim();
	return trimmed.startsWith('<') && /<\/[a-zA-Z][\w:-]*>/.test(trimmed);
}

function blobFileName(blob: Blob | File): string {
	if (blob instanceof File && blob.name) return blob.name;
	const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
	return `paste-${Date.now()}.${ext}`;
}

function bindEditorContent(editor: ToastEditor, content: string) {
	if (looksLikeHtml(content)) {
		editor.setHTML(content || '', false);
	} else {
		editor.setMarkdown(content || '', false);
	}
}

/**
 * TOAST UI Editor manages its own DOM subtree (toolbar popups, tooltips, etc.) outside of
 * React's reconciliation, and some of it can reference nodes that React has already detached
 * (e.g. `el.parentNode`) by the time our passive-effect cleanup runs. Swallow teardown errors
 * here so a stale internal reference inside the library can never surface as an uncaught
 * "removeChild"/commit-phase crash in the host page.
 */
function safeDestroy(editor: ToastEditor | null) {
	if (!editor) return;
	try {
		editor.destroy();
	} catch (err) {
		if (process.env.NODE_ENV !== 'production') {
			// eslint-disable-next-line no-console
			console.warn('[MarkdownBodyEditor] editor.destroy() threw during teardown (ignored):', err);
		}
	}
}

/** Same rationale as safeDestroy(): guard external content sync against a mid-teardown editor. */
function safeBindEditorContent(editor: ToastEditor, content: string) {
	try {
		bindEditorContent(editor, content);
	} catch (err) {
		if (process.env.NODE_ENV !== 'production') {
			// eslint-disable-next-line no-console
			console.warn('[MarkdownBodyEditor] failed to sync external content (ignored):', err);
		}
	}
}

/**
 * Naver Blog body editor powered by NHN TOAST UI Editor.
 * WYSIWYG-first with Markdown tab, Korean UI, and image upload hooks.
 */
export function MarkdownBodyEditor({ value, onChange, disabled }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<ToastEditor | null>(null);
	const onChangeRef = useRef(onChange);
	const lastSyncedRef = useRef(value);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	onChangeRef.current = onChange;

	// Mount TOAST UI Editor (client-only; avoids Next.js SSR `window` issues).
	useEffect(() => {
		if (!containerRef.current) return;

		let cancelled = false;
		let editor: ToastEditor | null = null;

		async function mount() {
			const [{ default: Editor }] = await Promise.all([
				import('@toast-ui/editor'),
				import('@toast-ui/editor/dist/toastui-editor.css'),
				import('@toast-ui/editor/dist/i18n/ko-kr'),
			]);

			if (cancelled || !containerRef.current) return;

			editor = new Editor({
				el: containerRef.current,
				initialEditType: 'wysiwyg',
				previewStyle: 'vertical',
				height: '600px',
				language: 'ko-KR',
				initialValue: value || '',
				placeholder: '본문을 작성하세요. 이미지 드래그·붙여넣기·툴바 업로드를 지원합니다.',
				usageStatistics: false,
				autofocus: false,
				toolbarItems: [
					['heading', 'bold', 'italic', 'strike'],
					['hr', 'quote'],
					['ul', 'ol', 'task', 'indent', 'outdent'],
					['table', 'image', 'link'],
					['code', 'codeblock'],
					['scrollSync'],
				],
				hooks: {
					addImageBlobHook(blob: Blob | File, callback: (url: string, alt?: string) => void) {
						void (async () => {
							try {
								setError(null);
								const url = await uploadNaverBlogImage(blob, blobFileName(blob));
								const alt =
									blob instanceof File
										? blob.name.replace(/\.[^.]+$/, '') || '이미지'
										: '이미지';
								// Inserts the uploaded image into the editor body immediately.
								callback(url, alt);
							} catch (err) {
								setError(
									err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.',
								);
							}
						})();
					},
				},
				events: {
					change: () => {
						const instance = editorRef.current;
						if (!instance) return;
						try {
							const md = instance.getMarkdown();
							lastSyncedRef.current = md;
							onChangeRef.current(md);
						} catch (err) {
							if (process.env.NODE_ENV !== 'production') {
								// eslint-disable-next-line no-console
								console.warn('[MarkdownBodyEditor] change handler failed (ignored):', err);
							}
						}
					},
				},
			});

			// Guard against the effect having been cancelled (unmounted / key-remounted)
			// while the dynamic imports above were in flight — never adopt a stale instance.
			if (cancelled) {
				safeDestroy(editor);
				return;
			}

			editorRef.current = editor;
			lastSyncedRef.current = value || '';
			setReady(true);
		}

		void mount();

		return () => {
			cancelled = true;
			safeDestroy(editor);
			editorRef.current = null;
			setReady(false);
		};
		// Mount once per component instance; external value sync is handled below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Bind AI-generated (or externally updated) markdown/HTML via setMarkdown / setHTML.
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !ready) return;
		if (value === lastSyncedRef.current) return;

		lastSyncedRef.current = value;
		safeBindEditorContent(editor, value);
	}, [value, ready]);

	useEffect(() => {
		if (!ready) return;
		const ui = containerRef.current?.querySelector('.toastui-editor-defaultUI');
		if (ui instanceof HTMLElement) {
			ui.classList.add('w-full', 'max-w-full');
			ui.style.width = '100%';
			ui.style.maxWidth = '100%';
			ui.style.minWidth = '0';
			ui.style.pointerEvents = disabled ? 'none' : '';
			ui.style.opacity = disabled ? '0.6' : '';
		}
	}, [disabled, ready]);

	useEffect(() => {
		if (!error) return;
		const t = window.setTimeout(() => setError(null), 5000);
		return () => window.clearTimeout(t);
	}, [error]);

	return (
		<div className="flex w-full min-w-0 max-w-full flex-col gap-1.5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">본문 (TOAST UI Editor)</span>
				<span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
					WYSIWYG · Markdown 탭 · 이미지 드래그/Ctrl+V
				</span>
			</div>
			<div
				ref={containerRef}
				className="naver-blog-toast-editor w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
			/>
			{error ? (
				<p className="text-[12px] font-medium text-rose-600" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
