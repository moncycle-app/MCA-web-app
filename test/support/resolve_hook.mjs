const src = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, next) {
	if (specifier.startsWith("/js/") || specifier.startsWith("/screens/") || specifier.startsWith("/i18n/")) return next(new URL("." + specifier, src).href, context);
	return next(specifier, context);
}
