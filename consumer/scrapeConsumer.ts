import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { db } from '../src/db/index';
import { eq } from 'drizzle-orm';
import { user } from '../src/db/schema/user';
import { website } from '../src/db/schema/website';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import amqp from 'amqplib';

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Function to generate image hash
async function generateImageHash(imageBuffer: Buffer): Promise<string> {
  try {
    // Resize image to a small size (8x8) and convert to grayscale
    const resized = await sharp(imageBuffer)
      .resize(8, 8)
      .grayscale()
      .raw()
      .toBuffer();

    // Calculate average pixel value
    const pixels = new Uint8Array(resized);
    const avg = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;

    // Create hash by comparing each pixel to average
    const hash = pixels.reduce((hash, pixel) => {
      return hash + (pixel > avg ? '1' : '0');
    }, '');

    // Convert binary hash to hexadecimal
    return parseInt(hash, 2).toString(16).padStart(16, '0');
  } catch (error) {
    console.error('Error generating image hash:', error);
    throw error;
  }
}

// Function to combine multiple images vertically
async function combineImages(imagePaths: string[]): Promise<Buffer> {
  try {
    if (imagePaths.length === 0) {
      throw new Error('No images to combine');
    }

    if (imagePaths.length === 1) {
      return fs.readFileSync(imagePaths[0]);
    }

    // Get dimensions of first image to determine width
    const firstImage = sharp(imagePaths[0]);
    const { width } = await firstImage.metadata();

    // Create array of sharp instances
    const images = imagePaths.map(path => sharp(path));

    // Get heights of all images
    const heights = await Promise.all(
      images.map(async (img) => {
        const { height } = await img.metadata();
        return height || 0;
      })
    );

    const totalHeight = heights.reduce((sum, h) => sum + h, 0);

    // Create a blank canvas
    const combined = sharp({
      create: {
        width: width || 1280,
        height: totalHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    // Prepare composite array
    const composite = [];
    let top = 0;

    for (let i = 0; i < imagePaths.length; i++) {
      composite.push({
        input: imagePaths[i],
        top: top,
        left: 0
      });
      top += heights[i];
    }

    // Combine images
    const result = await combined.composite(composite).png().toBuffer();
    return result;
  } catch (error) {
    console.error('Error combining images:', error);
    throw error;
  }
}

// Function to upload image to S3
async function uploadToS3(buffer: Buffer, key: string): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    });

    await s3Client.send(command);
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// Function to create S3 key from URL
function createS3Key(userId: string, url: string, type: 'latest' | 'previous', scrollCount?: number): string {
  // const domain = new URL(url).hostname.replace(/\./g, '_');
  const urlNew = url.replace(/\//g, '_');
  const baseKey = `job_track.website/${userId}/${urlNew}/${type}`;

  if (scrollCount !== undefined) {
    return `${baseKey}/${scrollCount}.png`;
  }
  return `${baseKey}/combined.png`;
}

// RabbitMQ producer function
async function sendToMailQueue(websiteData: {
  userId: string;
  websiteId: string;
  url: string;
  hasChanged: boolean;
  userEmail: string;
  websiteName?: string;
}) {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const exchange = process.env?.exchange as string;
    const exchangeType = process.env?.exchangeType as string || 'direct';
    const queue = process.env?.queue2 as string;
    const routingKey = process.env?.routingKey2 as string;

    await channel.assertExchange(exchange, exchangeType, { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, routingKey);

    const message = JSON.stringify(websiteData);
    channel.publish(exchange, routingKey, Buffer.from(message));

    console.log(`Sent website data to mail queue: ${websiteData.url}`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('Error sending to mail queue:', error);
  }
}

export async function collectPageContent(page: Page, userId: string, websiteId: string, websiteUrl: string) {
  // Basic page load
  await page.waitForLoadState('domcontentloaded');

  // Wait for either XHR or substantial text
  await Promise.race([
    page.waitForResponse(resp => {
      const type = resp.request().resourceType();
      return type === 'xhr' || type === 'fetch';
    }),
    page.waitForFunction(() => document.body.innerText.length > 500)
  ]);

  // Wait until enough DOM nodes are visible
  await page.waitForFunction(() => document.querySelectorAll('body *').length > 100);

  // Try infinite scroll until no more changes
  let prevHeight = 0;
  let scrollCount = 0;
  let noChangeCount = 0;

  // Array to collect content after each scroll
  const collectedContent: string[][] = [];
  const screenshotPaths: string[] = [];
  let prevContent: string[] = [];

  // First check if page is scrollable
  const pageInfo = await page.evaluate(() => {
    // Force a reflow to ensure correct height calculation
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';

    // Get the maximum height from different properties
    const maxHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    return {
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      maxHeight,
      viewportHeight: window.innerHeight,
      scrollable: maxHeight > window.innerHeight,
      overflow: window.getComputedStyle(document.body).overflow,
      overflowY: window.getComputedStyle(document.body).overflowY,
      bodyStyle: {
        height: document.body.style.height,
        overflow: document.body.style.overflow,
        position: document.body.style.position
      }
    };
  });
  console.log('Page Info:', pageInfo);

  // Set viewport to a larger size to ensure we can see more content
  await page.setViewportSize({ width: 1280, height: 800 });

  // Force the page to be scrollable if it isn't
  await page.evaluate(() => {
    document.body.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
  });

  let firstLoop = true;
  while (true) {
    if (!firstLoop) {
      // Scroll to bottom before checking for new content (not on first loop)
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1000);
    }

    const scrollInfo = await page.evaluate(() => ({
      scrollHeight: Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      ),
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      totalHeight: document.body.scrollHeight
    }));

    console.log(`Scroll attempt ${scrollCount}:`, scrollInfo);

    if (scrollInfo.scrollHeight === prevHeight) {
      noChangeCount++;
      console.log(`Height unchanged, attempt ${noChangeCount}`);
      // If height hasn't changed after 3 attempts, break
      if (noChangeCount >= 3) {
        console.log('No height change after multiple attempts, breaking scroll loop');
        break;
      }

      // Try to trigger any lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight - 100);
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Scroll with a small pause in the middle to trigger lazy loading
      await page.evaluate(() => {
        const currentScroll = window.scrollY;
        window.scrollTo(0, currentScroll + 500);
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

    } else {
      noChangeCount = 0;  // Reset counter if height changed
      scrollCount++;

      // Collect content after each scroll
      const content = await page.evaluate(() => {
        const elements = document.querySelectorAll('body *');
        return Array.from(elements)
          .filter(el => el.children.length === 0)
          .map(el => el.textContent?.trim())
          .filter((text): text is string => text !== null && text !== '');
      });

      // Only push if content changed
      // const contentChanged = prevContent.length !== content.length || prevContent.some((v, i) => v !== content[i]);
      // if (contentChanged) {
      collectedContent.push(content);
      prevContent = content;

      // Take a screenshot here
      const screenshotPath = path.join(screenshotsDir, `${websiteId}-scroll-${scrollCount}-${Date.now()}.png`);
      console.log(`Taking screenshot buffer: ${screenshotPath}`);
      try {
        const screenshotBuffer = await page.screenshot({
          // You get the buffer by not adding a path.
          // path: `/public/screenshots/debug-scroll-${scrollCount}-${Date.now()}.png`,
          // path: screenshotPath,  
          fullPage: true
        });
        console.log(`Screenshot saved successfully`);
        const s3Key = createS3Key(userId, websiteUrl, 'latest', scrollCount);
        await uploadToS3(screenshotBuffer, s3Key);
      } catch (error) {
        console.error('Error taking screenshot:', error);
      }
      prevHeight = scrollInfo.scrollHeight;
    }
    firstLoop = false;
  }

  // Combine all screenshots
  if (screenshotPaths.length > 0) {
    try {
      console.log(`Combining ${screenshotPaths.length} screenshots...`);
      const combinedImageBuffer = await combineImages(screenshotPaths);

      // Upload combined image to S3
      const combinedS3Key = createS3Key(userId, websiteUrl, 'latest', scrollCount);
      await uploadToS3(combinedImageBuffer, combinedS3Key);
      console.log(`Combined image uploaded to S3: ${combinedS3Key}`);

      // Generate hash of combined image
      const imageHash = await generateImageHash(combinedImageBuffer);
      console.log(`Generated image hash: ${imageHash}`);

      // Get current image hash from database
      const currentWebsite = await db
        .select({
          imageHash: website.imageHash,
          websiteUrl: website.url,
          userEmail: user.email,
        })
        .from(website)
        .innerJoin(user, eq(website.userId, user.id))
        .where(eq(website.id, websiteId))
        .then(rows => rows[0]);

      let hasChanged = false;

      if (!currentWebsite?.imageHash || currentWebsite.imageHash !== imageHash) {
        hasChanged = true;
        console.log(`Image hash changed for website ${websiteUrl}`);

        // Move current latest to previous (if exists)
        if (currentWebsite?.imageHash) {
          try {
            // This is a simplified approach - in production you might want to
            // copy the existing latest image to previous location
            console.log('Moving current latest to previous...');
          } catch (error) {
            console.error('Error moving current to previous:', error);
          }
        }

        // Update database with new hash
        await db
          .update(website)
          .set({
            imageHash: imageHash,
            updatedAt: new Date()
          })
          .where(eq(website.id, websiteId));

        // Send to mail queue instead of pushing to array
        await sendToMailQueue({
          userId: userId,
          websiteId: websiteId,
          url: websiteUrl,
          hasChanged: true,
          userEmail: currentWebsite.userEmail,
          // websiteUrl: currentWebsite.websiteUrl
        });

        console.log(`Sent website ${websiteUrl} to mail queue`);
      } else {
        console.log(`No image changes detected for website ${websiteUrl}`);
      }

      // Return deduplicated collected content array
      const deduped = Array.from(
        new Set(collectedContent.map(arr => JSON.stringify(arr)))
      ).map(str => JSON.parse(str));
      return deduped;
    }
    catch (error) {
      console.error('Error combining screenshots:', error);
    }
  }
}