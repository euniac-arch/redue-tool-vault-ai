/**
 * Minimal File System Access API typings for Chromium browsers.
 * Used by local backup + direct source patch workflow.
 */

interface FileSystemHandlePermissionDescriptor {
	mode?: 'read' | 'readwrite';
}

interface FileSystemCreateWritableOptions {
	keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
	write(data: BufferSource | Blob | string | WriteParams): Promise<void>;
	seek(position: number): Promise<void>;
	truncate(size: number): Promise<void>;
}

interface WriteParams {
	type: 'write' | 'seek' | 'truncate';
	data?: BufferSource | Blob | string;
	position?: number;
	size?: number;
}

interface FileSystemFileHandle {
	readonly kind: 'file';
	readonly name: string;
	getFile(): Promise<File>;
	createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
	queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
	requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
	readonly kind: 'directory';
	readonly name: string;
	getDirectoryHandle(
		name: string,
		options?: { create?: boolean },
	): Promise<FileSystemDirectoryHandle>;
	getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
	removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
	resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
	entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	keys(): AsyncIterableIterator<string>;
	values(): AsyncIterableIterator<FileSystemHandle>;
	queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
	requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
	[Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface DirectoryPickerOptions {
	id?: string;
	mode?: 'read' | 'readwrite';
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface Window {
	showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemHandle {
	readonly kind: 'file' | 'directory';
	readonly name: string;
}
