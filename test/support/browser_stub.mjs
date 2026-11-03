// The few browser globals the modules touch when they are imported or called by a test: a window, a document, an in-memory localStorage.
export function install() {
	const make = () => {
	const items = new Map();
	return {
		getItem: (key) => (items.has(key) ? items.get(key) : null),
		setItem: (key, value) => { items.set(key, String(value)); },
		removeItem: (key) => { items.delete(key); },
		clear: () => items.clear(),
		key: (index) => [...items.keys()][index] ?? null,
		get length() { return items.size; },
	};
	};
	globalThis.localStorage = make();
	globalThis.sessionStorage = make();
	globalThis.window = { location: { href: "https://app.example/auth", origin: "https://app.example" }, addEventListener() { } };
	globalThis.document = {};
}
