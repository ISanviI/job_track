// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { website } from '@/db/schema';
import * as z from 'zod';
import amqp from 'amqplib';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

const exchange = 'jobTrack';
const exchangeType = 'direct';
const queue1 = 'scrapeListQueue';
const queue2 = 'sendMailQueue';
const routingKey1 = 'scrapeList';
const routingKey2 = 'sendMail';

async function scrapeListProducer(content: object) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, exchangeType, { durable: false })
  channel.publish(exchange, routingKey1, Buffer.from(JSON.stringify(content)), { persistent: true }); // sends message to exchange
  // await channel.sendToQueue() // sends message directly to queue

  setTimeout(() => {
    connection.close();
  }, 1000);
}

const ScrapeSchema = z.object({
  url: z.string().url(),
  browser: z.enum(['chromium', 'firefox']).optional().default('chromium'),
});

export async function POST(req: NextRequest) {
  try {
    // Get the session from the request headers
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: No session found' }, { status: 401 });
    }
    // Parse the request body
    const body = await req.json();
    const { url, browser } = ScrapeSchema.parse(body);

    // Use the session's user id
    const websiteInstance = await db.insert(website).values({
      userId: session.user.id,
      url,
      // nextTrackAt: new Date(Date.now() + 60 * 1000), // 1 minute from now
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    scrapeListProducer({ url, browser, websiteId: websiteInstance[0].id, userId: session.user.id });

    return NextResponse.json({
      success: true,
      message: 'Scraping started',
    });
  } catch (err: any) {
    console.error(JSON.stringify(err));
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}