const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // Owner 2026-11-26 (Supabase Free plan, 500k Edge Function calls a month): browser tests never reach the live
    // Supabase projects. Every page load used to call public-version / public-community-stats for real (about 65 calls
    // per CI run, about 2.4k a day). Both hosts resolve to a closed local port; page.route() mocks still answer first.
    launchOptions: { args: ["--host-resolver-rules=MAP bbgwvpwzkyudbtcgrbtm.supabase.co 127.0.0.1:9, MAP frepunpqswciugwoyvxo.supabase.co 127.0.0.1:9"] },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // A deeper listen queue: the home loads many small hero/keycap assets at once and the default backlog (5) resets connections.
    command: "python3 -c \"from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler; ThreadingHTTPServer.request_queue_size = 128; ThreadingHTTPServer(('127.0.0.1', 4173), SimpleHTTPRequestHandler).serve_forever()\"",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
    timeout: 15_000,
  },
});
