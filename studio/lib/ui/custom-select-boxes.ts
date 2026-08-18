/**
 * Progressive enhancement for native <select> elements.
 * Wraps each select, hides it, and mirrors value + change onto a custom listbox.
 * Safe to call again after async HTML (skips already-initialized nodes).
 */

export const CUSTOM_SELECT_ATTR = 'data-rd-custom-select';
export const CUSTOM_SELECT_OPEN_EVENT = 'rd-custom-select:open';

const WRAP_CLASS = 'rd-custom-select';
const OPEN_CLASS = 'is-open';

type SelectOption = { value: string; label: string; disabled: boolean };

let documentBound = false;

function isElement(node: EventTarget | null): node is Element {
	return node instanceof Element;
}

function selectedLabel(select: HTMLSelectElement): string {
	const option = select.selectedOptions[0];
	if (option) return (option.textContent || option.label || option.value).trim();
	const placeholder = select.querySelector('option[value=""]');
	return (placeholder?.textContent || '').trim();
}

function readOptions(select: HTMLSelectElement): SelectOption[] {
	return Array.from(select.options).map((option) => ({
		value: option.value,
		label: (option.textContent || option.label || option.value).trim(),
		disabled: option.disabled,
	}));
}

function closeAll(except?: HTMLElement | null) {
	document.querySelectorAll<HTMLElement>(`.${WRAP_CLASS}.${OPEN_CLASS}`).forEach((wrap) => {
		if (except && wrap === except) return;
		wrap.classList.remove(OPEN_CLASS);
		const trigger = wrap.querySelector<HTMLButtonElement>('.rd-custom-select__trigger');
		if (trigger) trigger.setAttribute('aria-expanded', 'false');
	});
}

function ensureDocumentListeners() {
	if (documentBound || typeof document === 'undefined') return;
	documentBound = true;

	document.addEventListener('pointerdown', (event) => {
		const target = event.target;
		if (!isElement(target)) return;
		if (target.closest(`.${WRAP_CLASS}`)) return;
		closeAll();
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closeAll();
	});

	window.addEventListener(CUSTOM_SELECT_OPEN_EVENT, (event) => {
		const except = (event as CustomEvent<HTMLElement | null>).detail;
		closeAll(except ?? null);
	});
}

function dispatchNativeChange(select: HTMLSelectElement, value: string) {
	const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
	if (descriptor?.set) descriptor.set.call(select, value);
	else select.value = value;

	for (const option of Array.from(select.options)) {
		option.selected = option.value === value;
	}

	select.dispatchEvent(new Event('input', { bubbles: true }));
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderList(list: HTMLUListElement, select: HTMLSelectElement, triggerText: HTMLElement) {
	const options = readOptions(select);
	list.replaceChildren();

	for (const option of options) {
		const item = document.createElement('li');
		item.className = 'rd-custom-select__option';
		item.setAttribute('role', 'option');
		item.dataset.value = option.value;
		item.textContent = option.label;
		if (option.disabled) {
			item.classList.add('is-disabled');
			item.setAttribute('aria-disabled', 'true');
		}
		if (option.value === select.value) {
			item.classList.add('is-selected');
			item.setAttribute('aria-selected', 'true');
		} else {
			item.setAttribute('aria-selected', 'false');
		}

		item.addEventListener('click', (event) => {
			event.preventDefault();
			if (option.disabled) return;
			dispatchNativeChange(select, option.value);
			triggerText.textContent = option.label || selectedLabel(select);
			const wrap = list.closest<HTMLElement>(`.${WRAP_CLASS}`);
			if (wrap) {
				wrap.classList.remove(OPEN_CLASS);
				wrap.querySelector('.rd-custom-select__trigger')?.setAttribute('aria-expanded', 'false');
			}
			refreshSelected(list, select);
		});

		list.appendChild(item);
	}

	triggerText.textContent = selectedLabel(select);
}

function refreshSelected(list: HTMLUListElement, select: HTMLSelectElement) {
	list.querySelectorAll<HTMLElement>('.rd-custom-select__option').forEach((item) => {
		const selected = item.dataset.value === select.value;
		item.classList.toggle('is-selected', selected);
		item.setAttribute('aria-selected', selected ? 'true' : 'false');
	});
}

function enhanceSelect(select: HTMLSelectElement) {
	if (select.dataset.rdCustomSelect) return;
	if (select.multiple || select.size > 1) return;

	select.dataset.rdCustomSelect = '1';
	select.classList.add('rd-custom-select__native');
	select.setAttribute('tabindex', '-1');
	select.setAttribute('aria-hidden', 'true');

	const wrap = document.createElement('div');
	wrap.className = WRAP_CLASS;
	select.parentNode?.insertBefore(wrap, select);
	wrap.appendChild(select);

	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'rd-custom-select__trigger';
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');
	if (select.id) trigger.setAttribute('aria-labelledby', select.id);
	if (select.disabled) trigger.disabled = true;

	const triggerText = document.createElement('span');
	triggerText.className = 'rd-custom-select__value';
	triggerText.textContent = selectedLabel(select);

	const arrow = document.createElement('span');
	arrow.className = 'rd-custom-select__arrow';
	arrow.setAttribute('aria-hidden', 'true');

	trigger.append(triggerText, arrow);

	const list = document.createElement('ul');
	list.className = 'rd-custom-select__list';
	list.setAttribute('role', 'listbox');
	if (select.id) list.id = `${select.id}-listbox`;
	trigger.setAttribute('aria-controls', list.id);

	wrap.append(trigger, list);
	renderList(list, select, triggerText);

	trigger.addEventListener('click', (event) => {
		event.preventDefault();
		if (select.disabled) return;
		const willOpen = !wrap.classList.contains(OPEN_CLASS);
		if (willOpen) {
			window.dispatchEvent(new CustomEvent(CUSTOM_SELECT_OPEN_EVENT, { detail: wrap }));
			wrap.classList.add(OPEN_CLASS);
			trigger.setAttribute('aria-expanded', 'true');
		} else {
			wrap.classList.remove(OPEN_CLASS);
			trigger.setAttribute('aria-expanded', 'false');
		}
	});

	select.addEventListener('change', () => {
		triggerText.textContent = selectedLabel(select);
		refreshSelected(list, select);
	});

	const optionObserver = new MutationObserver(() => {
		renderList(list, select, triggerText);
	});
	optionObserver.observe(select, { childList: true, subtree: true, characterData: true });
}

function resolveRoot(containerSelector?: string | ParentNode | null): ParentNode | null {
	if (!containerSelector) return document;
	if (typeof containerSelector === 'string') return document.querySelector(containerSelector);
	return containerSelector;
}

/**
 * Enhance every native <select> inside a container.
 * Re-entrant: already wrapped or React-managed selects are skipped.
 */
export function initCustomSelectBoxes(containerSelector?: string | ParentNode | null): number {
	if (typeof document === 'undefined') return 0;
	const root = resolveRoot(containerSelector);
	if (!root) return 0;

	ensureDocumentListeners();

	const selects = root.querySelectorAll<HTMLSelectElement>('select');
	let count = 0;
	selects.forEach((select) => {
		if (select.dataset.rdCustomSelect) return;
		enhanceSelect(select);
		if (select.dataset.rdCustomSelect === '1') count += 1;
	});
	return count;
}

/** Watch a container for async-rendered selects and enhance them. */
export function observeCustomSelectBoxes(
	containerSelector?: string | ParentNode | null,
): () => void {
	if (typeof document === 'undefined') return () => undefined;
	const root = resolveRoot(containerSelector);
	if (!root) return () => undefined;

	initCustomSelectBoxes(root);
	const observer = new MutationObserver(() => {
		initCustomSelectBoxes(root);
	});
	observer.observe(root, { childList: true, subtree: true });
	return () => observer.disconnect();
}
