import { test as setup, expect } from "@playwright/test";
import path from "path";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

const PRIVY_TEST_OTP = process.env.TEST_USER_OTP;
const PRIVY_TEST_EMAIL = process.env.TEST_USER_EMAIL;

setup("Authenticating with Privy", async ({ page }) => {
  setup.skip(
    !PRIVY_TEST_EMAIL || !PRIVY_TEST_OTP,
    "TEST_USER_EMAIL and TEST_USER_OTP must be set"
  );

  const email = PRIVY_TEST_EMAIL as string;
  const otp = PRIVY_TEST_OTP as string;

  await page.goto("/login");

  // Wait for page to be ready
  await page.waitForLoadState("networkidle");

  // Click the Sign In button to open Privy modal
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for email input to appear in Privy modal
  const emailInput = page.getByPlaceholder(/email/i);
  await emailInput.waitFor({ timeout: 30000 });
  await emailInput.fill(email);

  // Click submit button to continue with email
  await page.getByRole("button", { name: "Submit" }).click();

  // Find and wait for OTP inputs to appear
  const otpInputs = page.locator(
    '[data-testid*="otp"] input, input[inputmode="numeric"], input[autocomplete="one-time-code"]'
  );
  await otpInputs.first().waitFor({ timeout: 30000 });

  // Place a gray cover over the OTP inputs so codes aren't visible in videos
  await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>(
      '[data-testid*="otp"] input, input[inputmode="numeric"], input[autocomplete="one-time-code"]'
    );
    if (!input) return;
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
  const otpDigits = otp.split("");

  if (inputCount >= 6) {
    // Individual digit inputs
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otpDigits[i]);
    }
  } else if (inputCount === 1) {
    // Single input field for full OTP
    await otpInputs.first().fill(otp);
  }

  // Wait for authentication to complete and redirect to home page
  await page.waitForURL("/", { timeout: 60000 });

  // Verify we're authenticated by checking for chat input on home page
  await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible({
    timeout: 10000,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log("Authentication successful! State saved.");
});
