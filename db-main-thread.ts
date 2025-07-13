import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { db } from './src/db/index'
import { eq, and, lte, sql } from 'drizzle-orm';
import { website, WebsiteType } from './src/db/schema/website';
import cron from 'node-cron';
import amqp from 'amqplib';
import { user } from './auth-schema';
// import axios from 'axios';
// import { z } from 'zod';
// import postgres from 'postgres';
// import { drizzle } from 'drizzle-orm/postgres-js';

// If this file is run directly, start the tracking
// Parse command line arguments to determine behavior
const args = process.argv.slice(2);
const isOneTime = args.includes('--once') || args.includes('--now');

const workerFile = './db-worker-thread.ts';

const exchange = 'jobTrack';
const exchangeType = 'direct';
const queue1 = 'scrapeListQueue';
const queue2 = 'sendMailQueue';
const routingKey1 = 'scrapeList';
const routingKey2 = 'sendMail';

// Types
interface WebsiteToTrack {
  id: string;
  url: string;
  etags: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  updatedAt: Date;
}

interface TrackingResult {
  id: string;
  url: string;
  oldEtags: string | null;
  newEtags: string | null;
  hasChanged: boolean;
  error?: string;
}

// Main execution function
async function main() {
  await runMainThread();
  // if (isMainThread) {
  //   // Main thread - orchestrates the work
  // } else {
  //   // Worker thread - processes individual websites
  //   await runWorkerThread();
  // }
}

// Main thread logic
async function runMainThread() {
  try {
    console.log('Starting website tracking job...');

    // Get websites that need tracking today
    const websitesToTrack = await getWebsitesToTrack(db);

    if (websitesToTrack.length === 0) {
      console.log('No websites to track today');
      return;
    }

    console.log(`Found ${websitesToTrack.length} websites to track`);

    // Process websites in batches using worker threads
    const batchSize = 10;
    const results: TrackingResult[] = [];

    for (let i = 0; i < websitesToTrack.length; i += batchSize) {
      const batch = websitesToTrack.slice(i, i + batchSize);
      const batchResults = await processBatch(batch);
      results.push(...batchResults);
    }

    // Update database with results
    await updateTrackingResults(db, results);

    // Log summary
    const changedWebsites = results.filter(r => r.hasChanged);
    const erroredWebsites = results.filter(r => r.error);

    // Send changed websites to scraping queue
    if (changedWebsites.length > 0) {
      console.log('Sending changed websites to scraping queue...');
      await sendChangedWebsitesToQueue(changedWebsites);
    }

    console.log(`Tracking completed:
    - Total websites: ${results.length}
    - Changed websites: ${changedWebsites.length}
    - Errored websites: ${erroredWebsites.length}`);

    if (changedWebsites.length > 0) {
      console.log('Websites with changes:', changedWebsites.map(w => w.url));
    }

    if (erroredWebsites.length > 0) {
      console.log('Websites with errors:', erroredWebsites.map(w => `${w.url}: ${w.error}`));
    }

  } catch (error) {
    console.error('Error in main tracking job:', error);
    process.exit(1);
  }
}

// Get websites that need tracking today
async function getWebsitesToTrack(dbConnect: typeof db): Promise<WebsiteToTrack[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const websites = await dbConnect
    .select({
      id: website.id,
      url: website.url,
      etags: website.etags,
      frequency: website.frequency,
      updatedAt: website.updatedAt
    })
    .from(website)
    .where(
      sql`
        CASE 
          WHEN frequency = 'daily' THEN 
            DATE(updated_at) < DATE(${today})
          WHEN frequency = 'weekly' THEN 
            DATE(updated_at) <= DATE(${today}) - INTERVAL '7 days'
          WHEN frequency = 'monthly' THEN 
            DATE(updated_at) <= DATE(${today}) - INTERVAL '1 month'
          WHEN frequency = 'quarterly' THEN 
            DATE(updated_at) <= DATE(${today}) - INTERVAL '3 months'
          ELSE false
        END
      `
    );

  return websites as WebsiteToTrack[];
}

// Process a batch of websites using worker threads
async function processBatch(websites: WebsiteToTrack[]): Promise<TrackingResult[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, {
      workerData: { websites }
    });

    worker.on('message', (data) => {
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.results);
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Update database with tracking results
async function updateTrackingResults(
  dbConnect: typeof db,
  results: TrackingResult[]
) {
  const now = new Date();

  for (const result of results) {
    await dbConnect
      .update(website)
      .set({
        etags: result.newEtags,
        updatedAt: now
      })
      .where(eq(website.id, result.id));
  }
}

// AMQP Producer function
async function sendChangedWebsitesToQueue(changedWebsites: TrackingResult[]) {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Declare exchange and queue
    await channel.assertExchange(exchange, exchangeType, { durable: true });
    // await channel.assertQueue(queue1, { durable: true });
    // await channel.bindQueue(queue1, exchange, routingKey1);

    // Send each changed website to the queue
    for (const websitte of changedWebsites) {
      const websiteToTrack = await db.select().from(website).where(eq(website.id, websitte.id)).then(res => res[0]);
      const message = {
        url: websitte.url,
        browser: 'chromium', // default browser
        websiteId: websitte.id,
        userId: websiteToTrack.userId
      };

      channel.publish(
        exchange,
        routingKey1,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      console.log(`Sent website to queue: ${website.url}`);
    }

    await channel.close();
    await connection.close();

    console.log(`Successfully sent ${changedWebsites.length} changed websites to scraping queue`);
  } catch (error) {
    console.error('Error sending websites to queue:', error);
    throw error;
  }
}

// Schedule the job to run daily using cron
export function scheduleWebsiteTracking() {
  console.log('Setting up scheduled website tracking...');

  // Schedule to run daily at 2:00 AM
  // Cron pattern: '0 2 * * *' means:
  // - 0 minutes
  // - 2 hours (2 AM)
  // - Every day of month (*)
  // - Every month (*)
  // - Every day of week (*)
  cron.schedule('0 2 * * *', () => {
    console.log('Running scheduled website tracking at 2:00 AM');
    main().catch((error: String | any) => {
      console.log(`Error executing the main thread function - ${error}`)
    });
  }, {
    // scheduled: true,
    timezone: "UTC" // You can change this to your preferred timezone
  });

  console.log('Website tracking scheduled to run daily at 2:00 AM UTC');
}

if (require.main === module) {
  if (isOneTime) {
    // Run once and exit
    console.log('Running website tracking once...');
    main().catch(console.error);
  } else {
    // Start the scheduled service
    console.log('Starting scheduled website tracking service...');
    scheduleWebsiteTracking();

    // Keep the process alive
    console.log('Service is running. Press Ctrl+C to stop.');
  }
}

export { main as runWebsiteEtagsTrack };