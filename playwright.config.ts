import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (#55): the real app in Chromium, on the Vite dev server,
 * against the Firestore emulator, never production. Run them with
 * `npm run test:e2e`, which starts the emulator around them; see
 * docs/agent/testing.md.
 */
const PORT = 5174;

export default defineConfig({
    testDir: "e2e",
    // A quiz runs on real 15-second question slots.
    timeout: 240_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: "retain-on-failure",
        ...devices["Pixel 7"],
    },
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            // A demo project: the emulator accepts it, production never sees it.
            VITE_USE_FIREBASE_EMULATOR: "true",
            VITE_FIREBASE_API_KEY: "demo-key",
            VITE_FIREBASE_PROJECT_ID: "demo-escparty",
            VITE_FIREBASE_APP_ID: "demo-app",
            VITE_FIREBASE_AUTH_DOMAIN: "demo-escparty.firebaseapp.com",
        },
    },
});
