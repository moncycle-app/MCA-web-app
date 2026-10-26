// Static server for src/, with no dependency. Extension-less addresses (/auth) answer auth.html, as Apache MultiViews does.
//   node scripts/serve.mjs [port] [--api-url URL]
// --api-url answers /config.json with that apiUrl instead of the file, to try another API without editing anything.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const args = process.argv.slice(2);
const api_index = args.indexOf("--api-url");
const api_url = api_index >= 0 ? args[api_index + 1] : null;
const port = parseInt(args.find((arg, i) => /^\d+$/.test(arg) && api_index < 0 || i !== api_index + 1) ?? "8080", 10);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
	".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".txt": "text/plain" };

async function find(path) {
	for (const candidate of [path, path + ".html", join(path, "index.html")]) {
		try { if ((await stat(candidate)).isFile()) return candidate; } catch { }
	}
	return null;
}

createServer(async (request, response) => {
	const url = new URL(request.url, "http://localhost");
	if (api_url && url.pathname === "/config.json") {
		response.writeHead(200, { "Content-Type": types[".json"] });
		return response.end(JSON.stringify({ apiUrl: api_url }));
	}
	const path = normalize(join(root, decodeURIComponent(url.pathname)));
	const file = path.startsWith(root) ? await find(path) : null;
	if (!file) { response.writeHead(404); return response.end("not found"); }
	response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
	response.end(await readFile(file));
}).listen(port, () => console.log("serving src/ on http://localhost:" + port + (api_url ? " with apiUrl " + api_url : "")));
