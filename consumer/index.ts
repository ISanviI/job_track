import { chromium, firefox, Page } from 'playwright';
import * as z from 'zod';
import amqp from 'amqplib';
import { db } from '../src/db/index';
import { eq } from 'drizzle-orm';
import { website } from '../src/db/schema/website';
import { collectPageContent } from './scrapeConsumer';
import { sendWebsiteUpdateEmail } from './sendMailConsumer';

// const ScrapeSchema = z.object({
//   url: z.string().url(),
//   browser: z.enum(['chromium', 'firefox']).optional().default('chromium'),
// });

const exchange = 'jobTrack';
const exchangeType = 'direct';
const queue1 = 'scrapeListQueue';
const queue2 = 'sendMailQueue';
const routingKey1 = 'scrapeList';
const routingKey2 = 'sendMail';

const ScrapeSchema = z.object({
  url: z.string().url(),
  browser: z.enum(['chromium', 'firefox']).optional().default('chromium'),
  websiteId: z.string(),
  userId: z.string(),
});

const MailSchema = z.object({
  userId: z.string(),
  websiteId: z.string(),
  url: z.string().url(),
  hasChanged: z.boolean(),
  userEmail: z.string().email(),
});

async function scrapeListConsumer() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue(queue1, { durable: true });
  await channel.bindQueue(queue1, exchange, routingKey1);

  // const message = await channel.consume(queue1);
  channel.consume(queue1, async (msg) => {
    if (msg !== null) {
      console.log(msg.content.toString());

      const { url, browser, websiteId, userId } = ScrapeSchema.parse(JSON.parse(msg.content.toString()));
      const browserInstance = browser === 'chromium'
        ? await chromium.launch({ headless: true })
        : await firefox.launch({ headless: true });

      const page = await browserInstance.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // await page.goto(url, { 
      //   waitUntil: ['domcontentloaded', 'networkidle'],
      //   timeout: 30000 
      // });

      // Collect all content arrays from scrolling
      const allContent = await collectPageContent(page, userId, websiteId, url);

      await browserInstance.close();
      channel.ack(msg);
    }
  });
}

async function sendMailConsumer() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue(queue2, { durable: true });
  await channel.bindQueue(queue2, exchange, routingKey2);

  channel.consume(queue2, async (message) => {
    if (message !== null) {
      try {
        console.log('Received mail message:', message.content.toString());

        const mailData = MailSchema.parse(JSON.parse(message.content.toString()));

        if (mailData.hasChanged) {
          await sendWebsiteUpdateEmail({
            userEmail: mailData.userEmail,
            url: mailData.url,
            hasChanged: mailData.hasChanged
          });

          console.log(`Email sent successfully for website: ${mailData.url}`);
        }

        channel.ack(message);
      } catch (error) {
        console.error('Error processing mail message:', error);
        channel.nack(message, false, false); // Don't requeue failed messages
      }
    }
  });
}

scrapeListConsumer();
sendMailConsumer();