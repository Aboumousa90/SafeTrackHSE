const baseUrl = process.env.SAFETRACK_BASE_URL ?? "http://127.0.0.1:3010";

const pageChecks = [
  { path: "/dashboard", contains: "Operationeel veiligheidsoverzicht" },
  { path: "/incidents/new", contains: "Nieuwe incidentregistratie" },
  { path: "/analysis", contains: "AI-ondersteunde oorzaakanalyse" },
  { path: "/measures", contains: "MUOPO-maatregelen" },
  { path: "/proactive", contains: "Mobiele proactieve melding" },
  { path: "/observation-rounds", contains: "Gestructureerde observatieronde" },
  { path: "/analytics", contains: "AI-ondersteunde HSE-analyse" },
  { path: "/reports", contains: "Rapportagecentrum" },
  { path: "/settings", contains: "Bedrijfsbeheer" },
  { path: "/super-admin", contains: "Superbeheerconsole" },
  { path: "/offline", contains: "SafeTrack offline" },
];

const apiChecks = [
  { path: "/api/readiness", assert: (json) => typeof json.ready === "number" && Array.isArray(json.checks) },
  { path: "/api/analytics/monthly?year=2026&month=5", assert: (json) => json.snapshot?.periodYear === 2026 },
  { path: "/api/super-admin/tenants", assert: (json) => Array.isArray(json.tenants) && Array.isArray(json.healthChecks) },
  { path: "/api/push/public-key", assert: (json) => typeof json.configured === "boolean" },
];

async function expectOk(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response;
}

async function checkPage({ path, contains }) {
  const response = await expectOk(path);
  const body = await response.text();
  if (!body.includes(contains)) {
    throw new Error(`${path} did not include expected text: ${contains}`);
  }
  return `page ${path}`;
}

async function checkApi({ path, assert }) {
  const response = await expectOk(path);
  const json = await response.json();
  if (!assert(json)) {
    throw new Error(`${path} returned unexpected JSON`);
  }
  return `api ${path}`;
}

async function checkCsv() {
  const response = await expectOk("/api/analytics/monthly?year=2026&month=5&format=csv");
  const body = await response.text();
  if (!body.includes('"metric","value"') || !body.includes('"total_incidents"')) {
    throw new Error("CSV export did not include expected metrics");
  }
  return "csv analytics export";
}

async function checkPosts() {
  const proactive = await expectOk("/api/proactive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentId: "d-2",
      reportType: "unsafe_condition",
      description: "Smoke test proactive report for verification coverage.",
      location: "Smoke test area",
      riskLevel: "medium",
      anonymous: true,
    }),
  });
  const proactiveJson = await proactive.json();
  if (!proactiveJson.report?.id) throw new Error("Proactive POST did not return a report id");

  const observation = await expectOk("/api/observation-rounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentId: "d-2",
      roundDate: "2026-05-10",
      roundTime: "10:00",
      location: "Smoke test area",
      observations: [
        { category: "PPE compliance", status: "ok", comment: "Observed during smoke test.", photoUrl: null },
        { category: "Housekeeping", status: "not_ok", comment: "Temporary item staged in walkway.", photoUrl: null },
      ],
      overallScore: 3,
      followUpRequired: true,
      notes: "Smoke test observation round.",
    }),
  });
  const observationJson = await observation.json();
  if (!observationJson.round?.id || observationJson.followUpsCreated < 1) {
    throw new Error("Observation POST did not create round and follow-up");
  }

  return "post flows";
}

async function main() {
  const results = [];
  for (const page of pageChecks) results.push(await checkPage(page));
  for (const api of apiChecks) results.push(await checkApi(api));
  results.push(await checkCsv());
  results.push(await checkPosts());

  for (const result of results) {
    console.log(`ok - ${result}`);
  }
  console.log(`Smoke test passed against ${baseUrl}`);
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exit(1);
});
