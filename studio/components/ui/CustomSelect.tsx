'use client';

import {
	Children,
	isValidElement,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type SelectHTMLAttributes,
} from 'react';
import { CUSTOM_SELECT_OPEN_EVENT } from '@/lib/ui/custom-select-boxes';

type OptionItem = { value: string; label: string; disabled: boolean };

function optionsFromChildren(children: ReactNode): OptionItem[] {
	return Children.toArray(children).flatMap((child) => {
		if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) {
			return [];
		}
		if (child.type !== 'option') return [];
		const value = child.props.value != null ? String(child.props.value) : '';
		const label = String(child.props.children ?? value);
		return [{ value, label, disabled: Boolean(child.props.disabled) }];
	});
}

export type CustomSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Drop-in <select> replacement: keeps a hidden native select in sync
 * (value + change) and renders an animated custom listbox.
 */
export function CustomSelect({
	id,
	value,
	defaultValue,
	onChange,
	disabled,
	className,
	children,
	'aria-label': ariaLabel,
	...rest
}: CustomSelectProps) {
	const reactId = useId();
	const selectId = id || `rd-custom-select-${reactId}`;
	const listId = `${selectId}-listbox`;
	const nativeRef = useRef<HTMLSelectElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ''));

	const options = useMemo(() => optionsFromChildren(children), [children]);
	const isControlled = value !== undefined;
	const currentValue = isControlled ? String(value) : uncontrolled;
	const currentLabel =
		options.find((option) => option.value === currentValue)?.label ||
		options[0]?.label ||
		'';

	useEffect(() => {
		const native = nativeRef.current;
		if (native) native.dataset.rdCustomSelect = 'react';
	}, []);

	useEffect(() => {
		if (!open) return;

		function onPointerDown(event: PointerEvent) {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}
		function onOtherOpen(event: Event) {
			const except = (event as CustomEvent<HTMLElement | null>).detail;
			if (except !== rootRef.current) setOpen(false);
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKey);
		window.addEventListener(CUSTOM_SELECT_OPEN_EVENT, onOtherOpen);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener(CUSTOM_SELECT_OPEN_EVENT, onOtherOpen);
		};
	}, [open]);

	function commit(next: string) {
		const native = nativeRef.current;
		if (native) {
			const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
			if (descriptor?.set) descriptor.set.call(native, next);
			else native.value = next;
			for (const option of Array.from(native.options)) {
				option.selected = option.value === next;
			}
			native.dispatchEvent(new Event('input', { bubbles: true }));
			native.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (!isControlled) setUncontrolled(next);
		setOpen(false);
	}

	function toggle() {
		if (disabled) return;
		const willOpen = !open;
		if (willOpen && rootRef.current) {
			window.dispatchEvent(
				new CustomEvent(CUSTOM_SELECT_OPEN_EVENT, { detail: rootRef.current }),
			);
		}
		setOpen(willOpen);
	}

	return (
		<div
			ref={rootRef}
			className={`rd-custom-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${
				currentValue ? '' : ' is-placeholder'
			}`}
		>
			<select
				{...rest}
				ref={nativeRef}
				id={selectId}
				value={currentValue}
				disabled={disabled}
				onChange={onChange}
				onFocus={() => {
					if (disabled) return;
					if (rootRef.current) {
						window.dispatchEvent(
							new CustomEvent(CUSTOM_SELECT_OPEN_EVENT, { detail: rootRef.current }),
						);
					}
					setOpen(true);
				}}
				tabIndex={-1}
				aria-hidden="true"
				className="rd-custom-select__native"
				data-rd-custom-select="react"
			>
				{children}
			</select>
			<button
				type="button"
				className={`rd-custom-select__trigger${className ? ` ${className}` : ''}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-label={ariaLabel}
				disabled={disabled}
				onClick={toggle}
				onKeyDown={(event) => {
					if (event.key === 'ArrowDown' && !open) {
						event.preventDefault();
						toggle();
					}
				}}
			>
				<span className="rd-custom-select__value">{currentLabel}</span>
				<span className="rd-custom-select__arrow" aria-hidden />
			</button>
			<ul id={listId} className="rd-custom-select__list" role="listbox">
				{options.map((option) => {
					const selected = option.value === currentValue;
					return (
						<li
							key={`${selectId}-${option.value || 'empty'}-${option.label}`}
							role="option"
							aria-selected={selected}
							aria-disabled={option.disabled || undefined}
							data-value={option.value}
							className={`rd-custom-select__option${selected ? ' is-selected' : ''}${
								option.disabled ? ' is-disabled' : ''
							}`}
							onClick={() => {
								if (option.disabled) return;
								commit(option.value);
							}}
						>
							{option.label}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
