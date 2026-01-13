import { test, expect, Page } from "@playwright/test";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

// Helper to handle Privy's "Sign and continue" button if it appears
async function handlePrivySignAndContinue(page: Page) {
  const signAndContinueButton = page.getByRole("button", {
    name: /sign and continue/i,
  });
  // Check if button appears within 5 seconds, click if present
  try {
    await signAndContinueButton.waitFor({ timeout: 5000 });
    await signAndContinueButton.click();
  } catch {
    // Button didn't appear, that's fine
  }
}

test.describe("Chat", () => {
  test("authenticated user sees chat interface", async ({ page }) => {
    await page.goto("/");
    await handlePrivySignAndContinue(page);

    // Verify the chat input is visible
    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    // Verify submit button is visible
    const submitButton = page.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeVisible();

    // Verify user is authenticated (chat input should be available)
    await expect(promptInput).toBeVisible();
  });

  test("user can send a prompt and receive a response", async ({ page }) => {
    await page.goto("/");
    await handlePrivySignAndContinue(page);

    // Wait for the chat interface to be ready
    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    // Type a simple prompt
    const testPrompt = "Hello, say hi back in one word";
    await promptInput.fill(testPrompt);

    // Submit the prompt
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the user message to appear in the chat
    // The message should be visible in the chat area
    await expect(page.getByText(testPrompt)).toBeVisible({ timeout: 10000 });

    // Wait for a response to appear
    // Assistant messages have the class "is-assistant"
    await expect(page.locator(".is-assistant")).toBeVisible({ timeout: 30000 });
  });

  test("chat input clears after sending", async ({ page }) => {
    await page.goto("/");
    await handlePrivySignAndContinue(page);

    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    // Type a message
    await promptInput.fill("Test message");

    // Verify the input has content
    await expect(promptInput).toHaveValue("Test message");

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Verify input is cleared after submission
    await expect(promptInput).toHaveValue("", { timeout: 5000 });
  });
});
