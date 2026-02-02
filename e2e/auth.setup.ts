import { test as setup, expect } from "@playwright/test";
import path from "path";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

const PRIVY_TEST_OTP = process.env.TEST_USER_OTP;
const PRIVY_TEST_EMAIL = process.env.TEST_USER_EMAIL;

if (!PRIVY_TEST_EMAIL || !PRIVY_TEST_OTP) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_OTP must be set");
}

setup("authenticate via Privy", async ({ page }) => {
  await page.goto("/login");

  // Wait for page to be ready
  await page.waitForLoadState("networkidle");

  // Click the Sign In button to open Privy modal
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for email input to appear in Privy modal
  const emailInput = page.getByPlaceholder(/email/i);
  await emailInput.waitFor({ timeout: 30000 });
  await emailInput.fill(PRIVY_TEST_EMAIL);

  // Click submit button to continue with email
  await page.getByRole("button", { name: "Submit" }).click();

  // Find and wait for OTP inputs to appear
  const otpInputs = page.locator(
    '[data-testid*="otp"] input, input[inputmode="numeric"], input[autocomplete="one-time-code"]'
  );
  await otpInputs.first().waitFor({ timeout: 30000 });

  const inputCount = await otpInputs.count();
  const otpDigits = PRIVY_TEST_OTP.split("");

  if (inputCount >= 6) {
    // Individual digit inputs
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otpDigits[i]);
    }
  } else if (inputCount === 1) {
    // Single input field for full OTP
    await otpInputs.first().fill(PRIVY_TEST_OTP);
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
