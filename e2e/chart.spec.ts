import { test, expect } from "@playwright/test";
import { CHAT_INPUT_PLACEHOLDER } from "@/lib/constants";

const VIDEO_PAUSE_MS = 3000;
const PRE_SUBMIT_PAUSE_MS = 1000;

test.describe("Chart display tool", () => {
  test.beforeEach(async ({ page }) => {
    page.on("requestfailed", (request) => {
      const url = request.url();
      const postData = request.postData();
      const bodySize = postData ? `${(postData.length / 1024).toFixed(1)}KB` : "no body";
      process.stderr.write(`[NETWORK FAILED] ${request.method()} ${url} (${bodySize}) — ${request.failure()?.errorText}\n`);
    });
  });

  test("user can ask for a bar chart with hard-coded data", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");

    const promptInput = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(promptInput).toBeVisible();

    const prompt =
      'Show a bar chart with title "Test Scores" and this data: ' +
      "x=Math score 85, y=Science score 92, z=English score 78. " +
      "Use the labels x, y, z on the x-axis and scores as the bars.";
    await promptInput.fill(prompt);
    await page.waitForTimeout(PRE_SUBMIT_PAUSE_MS);

    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for the user message to appear
    await expect(page.getByRole("main").getByText("Test Scores")).toBeVisible({
      timeout: 10000,
    });

    // The chart renders inside a div[data-slot="chart"] which contains an SVG
    // from recharts. Wait for that SVG to appear.
    const chartContainer = page.locator('[data-slot="chart"]');
    await expect(chartContainer).toBeVisible({ timeout: 60000 });

    // recharts renders bar rectangles as <rect> elements inside the SVG
    const svg = chartContainer.locator("svg").first();
    await expect(svg).toBeVisible();

    // Verify the chart has rendered rect elements (the actual bars)
    const rects = svg.locator(".recharts-bar-rectangle");
    await expect(rects.first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(VIDEO_PAUSE_MS);
  });
});
