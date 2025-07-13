import { chromium, firefox, Page } from 'playwright';
import * as z from 'zod';
import amqp from 'amqplib';
import { db } from '../src/db/index';
import { eq } from 'drizzle-orm';
import { website } from '../src/db/schema/website';
import { collectPageContent } from './scrapeConsumer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// SES Client configuration
const sesClient = new SESClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Function to send email using AWS SES
export async function sendWebsiteUpdateEmail(emailData: {
  userEmail: string;
  url: string;
  hasChanged: boolean;
}) {
  try {
    const { userEmail, url, hasChanged } = emailData;
    const domain = new URL(url).hostname;
    const subject = `Website Update Alert - ${url}`;
    const htmlBody = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Website Update Notification</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Website Details:</h3>
              <p><strong>URL:</strong> <a href="${url}" style="color: #007bff;">${url}</a></p>
              ${domain ? `<p><strong>Name:</strong> ${domain}</p>` : ''}
              <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Updated</span></p>
            </div>
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; color: #6c757d;">
                This is an automated notification from your website monitoring service. 
                The above website has been updated with new content.
              </p>
            </div>
            <p style="margin-top: 20px; color: #6c757d; font-size: 12px;">
              You are receiving this email because you have subscribed to monitor changes on this website.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Website Update Notification

Website Details:
- URL: ${url}
${`- Name: ${domain}`}
- Status: Updated

This is an automated notification from your website monitoring service. 
The above website has been updated with new content.

You are receiving this email because you have subscribed to monitor changes on this website.
    `;

    const command = new SendEmailCommand({
      Source: process.env.AWS_SES_FROM_EMAIL!, // Add this to your .env file
      Destination: {
        ToAddresses: [userEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const result = await sesClient.send(command);
    console.log(`Email sent successfully to ${userEmail}. MessageId: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}