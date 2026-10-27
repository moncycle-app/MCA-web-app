// Runs before the tests: the backend's test server must be up (and be a test server), else one line and exit 1.
export default async function () {
	const hint = "No test server on http://127.0.0.1:8190. Start it: ../MCA-backend-and-API/tests/run.sh --keep e2e_none";
	try {
		const probe = await fetch("http://127.0.0.1:8190/_test/sql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "SELECT DATABASE() AS d", params: [] }) });
		const database = (await probe.json()).rows?.[0]?.d ?? "";
		if (!database.startsWith("test_")) throw new Error("not a test database");
		const info = await fetch("http://127.0.0.1:8190/api/v2/server_info");
		if (!info.ok) throw new Error("server_info " + info.status);
	} catch {
		console.error(hint);
		process.exit(1);
	}
}
