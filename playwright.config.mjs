// End-to-end tests: Chrome (the installed one), the web app served by scripts/serve.mjs with /api proxied to the backend's test server.
//   ../MCA-backend-and-API/tests/run.sh --keep e2e_none     (leaves the test server up on :8190; the filter matches no test)
//   npm run test:e2e
//   npm run build && BUILT=1 npm run test:e2e      (the same tests on dist/, the production build, served on another port)
import { defineConfig } from "@playwright/test";

export const API_PORT = 8190;
export const BUILT = process.env.BUILT === "1";
export const WEB_ROOT = BUILT ? "dist" : "src";
export const WEB_PORT = BUILT ? 8195 : 8194;

export default defineConfig({
	testDir: "test/e2e",
	testMatch: "*.spec.mjs",
	globalSetup: "./test/e2e/global_setup.mjs",
	fullyParallel: true,
	workers: 4,
	retries: 0,
	timeout: 20000,
	reporter: "dot",
	outputDir: "test-results",
	use: {
		baseURL: `http://localhost:${WEB_PORT}`,
		channel: "chrome",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	webServer: {
		command: `node scripts/serve.mjs ${WEB_PORT} --root ${WEB_ROOT} --api-proxy http://127.0.0.1:${API_PORT}`,
		url: `http://localhost:${WEB_PORT}/version.json`,
		reuseExistingServer: true,
	},
});
