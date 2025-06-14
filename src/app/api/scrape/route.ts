// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { chromium, firefox } from 'playwright';

const ScrapeSchema = z.object({
  url: z.string().url(),
  browser: z.enum(['chromium', 'firefox']).optional().default('chromium'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, browser } = ScrapeSchema.parse(body);

    const browserInstance =
      browser === 'chromium' ? await chromium.launch({ headless: true }) : await firefox.launch({ headless: true });

    const page = await browserInstance.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    let allContent: string[] = [];
    const collectContent = async () => {
      const content = await page.content();
      allContent.push(content);
    };

    await collectContent();

    // Example strategy to find and click pagination buttons
    const nextPageSelector = 'button[aria-label="Next"], a[rel="next"], .pagination-next';

    while (true) {
      const nextButton = await page.$(nextPageSelector);
      if (!nextButton) break;

      const isDisabled = await nextButton.getAttribute('disabled');
      if (isDisabled !== null) break;

      await Promise.all([
        nextButton.click(),
        page.waitForLoadState('networkidle'),
      ]);

      await collectContent();
    }

    await browserInstance.close();

    return NextResponse.json({ success: true, pages: allContent.length, data: allContent });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
