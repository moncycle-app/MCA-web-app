// Static server for src/, with no dependency. The app is one page: an address with no file and no extension (/auth, /settings) answers
// index.html, as the Docker image's Apache does (FallbackResource), and the router shows the screen. /api/ never falls back.
//   node scripts/serve.mjs [port] [--api-url URL] [--api-proxy URL]
// --api-url answers /config.json with that apiUrl instead of the file, to try another API without editing anything.
// --api-proxy forwards /api/... to another server, so that the page and the API share one origin (cookie mode, like production).
//   The Host and the headers go through as they came (the API compares Origin with Host), and so do the status, headers and Set-Cookie.
// It sends the headers of the Docker image's Apache (Content-Security-Policy, Cache-Control), so that a CSP problem shows up here.
import { createServer, request as http_request } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const args = process.argv.slice(2);
function option(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : null;
}
const api_url = option("--api-url");
const api_proxy = option("--api-proxy") ? new URL(option("--api-proxy")) : null;
const values = new Set([api_url, option("--api-proxy")]);
const port = parseInt(args.find((arg) => /^\d+$/.test(arg) && !values.has(arg)) ?? "8080", 10);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
	".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".txt": "text/plain" };
// zz-moncycleapp.conf, with the defaults of the entrypoint when no news or terms address is set
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; " +
	"frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
const security_headers = { "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };

async function find(path) {
	for (const candidate of [path, join(path, "index.html")]) {
		try { if ((await stat(candidate)).isFile()) return candidate; } catch { }
	}
	return null;
}

function proxy(request, response) {
	const headers = { ...request.headers };
	headers["x-forwarded-for"] ??= request.socket.remoteAddress;
	const upstream = http_request({ hostname: api_proxy.hostname, port: api_proxy.port, path: request.url, method: request.method, headers }, (answer) => {
		response.writeHead(answer.statusCode, answer.headers);
		answer.pipe(response);
	});
	upstream.on("error", (error) => {
		response.writeHead(502, { "Content-Type": "text/plain" });
		response.end("api proxy: " + error.message);
	});
	request.pipe(upstream);
}

createServer(async (request, response) => {
	const url = new URL(request.url, "http://localhost");
	if (api_proxy && url.pathname.startsWith("/api/")) return proxy(request, response);
	if (api_url && url.pathname === "/config.json") {
		response.writeHead(200, { "Content-Type": types[".json"], "Cache-Control": "no-cache", ...security_headers });
		return response.end(JSON.stringify({ apiUrl: api_url }));
	}
	const path = normalize(join(root, decodeURIComponent(url.pathname)));
	let file = path.startsWith(root) ? await find(path) : null;
	// no file, and what is asked is not a file (an address of a screen, or an old one ending in .html): the app
	if (!file && !url.pathname.startsWith("/api/") && [".html", ""].includes(extname(url.pathname))) file = join(root, "index.html");
	if (!file) { response.writeHead(404, security_headers); return response.end("not found"); }
	const extension = extname(file);
	const cache = [".html", ".js", ".css", ".json"].includes(extension) ? { "Cache-Control": "no-cache" } : {};
	response.writeHead(200, { "Content-Type": types[extension] ?? "application/octet-stream", ...cache, ...security_headers });
	response.end(await readFile(file));
}).listen(port, () => console.log("serving src/ on http://localhost:" + port + (api_url ? " with apiUrl " + api_url : "") + (api_proxy ? " with /api/ proxied to " + api_proxy.origin : "")));
