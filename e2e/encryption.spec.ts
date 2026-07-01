import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

// Exercises the encryption-key derivation failure path: a stalled Privy
// signing round-trip (the VPN scenario from #172) must surface a retryable
// error instead of an infinite spinner, and Retry must recover once the
// network is healthy again.
//
// Tagged @full: the failure test spends ~40s waiting out the timeout+retry
// window by design, which is too slow for the per-PR light suite.

const ERROR_HEADING = "Couldn't secure your session";

function captureConsole(page: Page): string[] {
  const lines: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (/encryption|privy|wallet/i.test(text)) {
      lines.push(`[${msg.type()}] ${text}`);
    }
  });
  page.on("pageerror", (err) => lines.push(`[pageerror] ${err.message}`));
  return lines;
}

async function attachDiagnostics(
  page: Page,
  testInfo: TestInfo,
  name: string,
  consoleLines: string[]
) {
  await testInfo.attach(`${name}-screenshot`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-console`, {
    body: consoleLines.join("\n") || "(no matching console output)",
    contentType: "text/plain",
  });
}

test.describe("encryption init resilience", () => {
  test("startup third-party request inventory @full", async ({ page }, testInfo) => {
    // Discovery aid for the blocking test below: record which non-localhost
    // endpoints the app calls between load and the chat input appearing
    // (the window where the encryption key is derived), so the stall
    // patterns stay honest as Privy internals evolve.
    const requests: string[] = [];
    page.on("request", (req) => {
      try {
        const url = new URL(req.url());
        if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
          requests.push(`${req.method()} ${url.origin}${url.pathname}`);
        }
      } catch {
        // data: URLs etc.
      }
    });
    const consoleLines = captureConsole(page);

    await page.goto("/");
    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible({ timeout: 60000 });

    await testInfo.attach("third-party-requests", {
      body: [...new Set(requests)].sort().join("\n"),
      contentType: "text/plain",
    });
    await attachDiagnostics(page, testInfo, "startup", consoleLines);
  });

  test("stalled Privy signing shows retryable error, Retry recovers @full", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    const consoleLines = captureConsole(page);

    // Stall (rather than fail) all Privy traffic: a hung request reproduces
    // the VPN scenario and exercises the client-side timeout, whereas a fast
    // network error would exercise the SDK's rejection path instead.
    let stalling = true;
    const releaseStalled: Array<() => void> = [];
    await page.route(/privy\.io/, async (route) => {
      if (stalling) {
        await new Promise<void>((resolve) => releaseStalled.push(resolve));
      }
      try {
        await route.continue();
      } catch {
        // Page may have moved on by the time the stall is released
      }
    });

    await page.goto("/");

    // Checkpoint at 15s: should still be inside the timeout/retry window
    await page.waitForTimeout(15000);
    await attachDiagnostics(page, testInfo, "t15s", consoleLines);

    // The retry loop gives up after ~36s worst case (10s + 2s + 10s + 4s +
    // 10s); allow slack for slow CI. If Privy session restore itself (not
    // just signing) turns out to be blocked by the stall, the app may
    // redirect to /login or sit on the spinner instead — the diagnostics
    // attached on failure will show which.
    const errorScreen = page.getByText(ERROR_HEADING);
    try {
      await expect(errorScreen).toBeVisible({ timeout: 60000 });
    } finally {
      await attachDiagnostics(page, testInfo, "t-post-timeout", consoleLines);
      await testInfo.attach("t-post-timeout-url", {
        body: page.url(),
        contentType: "text/plain",
      });
    }

    // Heal the network and release every held request
    stalling = false;
    for (const release of releaseStalled) release();

    await page.getByRole("button", { name: "Retry" }).click();

    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    try {
      await expect(promptInput).toBeVisible({ timeout: 45000 });
    } finally {
      await attachDiagnostics(page, testInfo, "t-post-retry", consoleLines);
    }
  });
});
