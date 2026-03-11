import { test, expect } from "@playwright/test";
import path from "path";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

// Override storageState so we start logged out
test.use({ storageState: { cookies: [], origins: [] } });

const PAUSE_MS = 2000;
const TYPE_DELAY_MS = 40;

const email = process.env.TEST_USER_EMAIL!;
const otp = process.env.TEST_USER_OTP!;

test("demo walkthrough", async ({ page }) => {
  test.setTimeout(180000);

  // Inject CSS before every page load to hide the Privy loading dot
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = ".animate-pulse-dot { display: none !important; }";
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener("DOMContentLoaded", () =>
        document.head.appendChild(style)
      );
    }
  });

  await page.goto("/login");

  // Wait for the login screen to fully render
  const signInButton = page.getByRole("button", { name: "Sign In" });
  await expect(signInButton).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(PAUSE_MS);

  // --- Sign in ---

  await signInButton.click();

  const emailInput = page.getByPlaceholder(/email/i);
  await emailInput.waitFor({ timeout: 30000 });
  await emailInput.pressSequentially(email, { delay: TYPE_DELAY_MS });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Submit" }).click();

  // Wait for OTP inputs
  const otpInputs = page.locator(
    '[data-testid*="otp"] input, input[inputmode="numeric"], input[autocomplete="one-time-code"]'
  );
  await otpInputs.first().waitFor({ timeout: 30000 });

  // Place a gray cover over the OTP inputs inside their parent container
  // so it sits at the same z-level as the Privy modal content
  await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>(
      '[data-testid*="otp"] input, input[inputmode="numeric"], input[autocomplete="one-time-code"]'
    );
    if (!input) return;
    // Walk up to find the container that holds all OTP inputs
    const container =
      input.closest('[data-testid*="otp"]') ||
      input.parentElement?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const parent = container.parentElement!;
    parent.style.position = parent.style.position || "relative";
    const cover = document.createElement("div");
    cover.id = "otp-cover";
    cover.style.cssText = `
      position: absolute;
      top: ${container.getBoundingClientRect().top - parent.getBoundingClientRect().top - 4}px;
      left: ${container.getBoundingClientRect().left - parent.getBoundingClientRect().left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      background: #e5e5e5;
      border-radius: 8px;
      z-index: 1;
    `;
    parent.appendChild(cover);
  });

  const inputCount = await otpInputs.count();
  if (inputCount >= 6) {
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otp[i]);
    }
  } else {
    await otpInputs.first().fill(otp);
  }

  // Wait for auth to complete behind the cover
  const chatInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
  await expect(chatInput).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(PAUSE_MS);

  // --- First message ---

  await chatInput.pressSequentially("What is the capital of France?", {
    delay: TYPE_DELAY_MS,
  });
  await page.waitForTimeout(1000);
  await page.locator("form button[type='submit']").click();

  // Wait for the response to finish: isLoading goes true then false.
  // When loading, the button switches to type="button" (stop). Wait for that,
  // then wait for the button to switch back to submit.
  await page.getByRole("button", { name: "Stop generating" }).waitFor({ timeout: 10000 });
  await page
    .locator("form button[type='submit']")
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(PAUSE_MS);

  // --- Second message ---

  await chatInput.click();
  await chatInput.pressSequentially("Tell me one fun fact about it", {
    delay: TYPE_DELAY_MS,
  });
  await page.waitForTimeout(1000);
  await page.locator("form button[type='submit']").click();

  await page.getByRole("button", { name: "Stop generating" }).waitFor({ timeout: 10000 });
  await page
    .locator("form button[type='submit']")
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(PAUSE_MS * 2);

  // Save the recorded video to public/demo.webm
  const dest = path.resolve(__dirname, "../public/demo.webm");
  await page.close();
  await page.video()?.saveAs(dest);
});
