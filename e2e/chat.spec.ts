import { test, expect } from "@playwright/test";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

test.describe("Chat", () => {
  test("authenticated user sees chat interface", async ({ page }) => {
    await page.goto("/");

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

  test("user can attach an image and ask about it", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");

    // Wait for the chat interface to be ready
    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    // Attach the cat image via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/cat.jpg");

    // Wait for the image attachment preview to appear (alt is the filename)
    await expect(page.locator("img[alt='cat.jpg']")).toBeVisible({
      timeout: 5000,
    });

    // Type a question about the image
    await promptInput.fill("What's on this image?");

    // Submit the prompt
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the user message to appear
    await expect(page.getByText("What's on this image?")).toBeVisible({
      timeout: 10000,
    });

    // Wait for the assistant response that mentions "cat"
    await expect(page.locator(".is-assistant")).toContainText(/cat/i, {
      timeout: 60000,
    });
  });

  test("user can ask to generate an image", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");

    // Wait for the chat interface to be ready
    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    // Ask to generate an image of a cat (explicit request for actual image generation)
    const prompt = "Generate an actual image of a cat. Use image generation, not ASCII art.";
    await promptInput.fill(prompt);

    // Submit the prompt
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the user message to appear
    await expect(page.getByText(prompt)).toBeVisible({
      timeout: 10000,
    });

    // Wait for the generated image to appear in the assistant's response
    // The image may be rendered inline via markdown or as a separate image part
    await expect(page.locator(".is-assistant img")).toBeVisible({
      timeout: 90000,
    });
  });
});
