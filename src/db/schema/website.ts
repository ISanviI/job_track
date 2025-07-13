import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { dbSchema, user } from ".";

export const website = dbSchema.table("website", {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  s3Url: text('s3_url'), // Stores the S3 object parameters for the website's image
  websiteText: text('website_text'), // Stores the website's text content
  imageHash: text('image_hash'), // Stores perceptual hash of the image for quick comparison
  // imageDiffMetrics: jsonb('image_diff_metrics'), // Stores detailed image comparison metrics
  etags: text('etags'), // Stores the website's etags for change detection
  frequency: text('frequency').$defaultFn(() => 'weekly').notNull(), 
  // Tracking frequency - 'daily' || 'weekly' || 'monthly' || 'quaterly'
  // nextTrackAt: timestamp('next_track_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull()
});

export type WebsiteType = typeof website.$inferSelect;

// Image hash functions
// import { createHash } from 'crypto';
// import sharp from 'sharp';
// 
// async function generateImageHash(imageBuffer: Buffer): Promise<string> {
//   // 1. Resize image to a small size (e.g., 8x8)
//   const resized = await sharp(imageBuffer)
//     .resize(8, 8)
//     .grayscale()
//     .raw()
//     .toBuffer();

//   // 2. Calculate average pixel value
//   const pixels = new Uint8Array(resized);
//   const avg = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;

//   // 3. Create hash by comparing each pixel to average
//   const hash = pixels.reduce((hash, pixel) => {
//     return hash + (pixel > avg ? '1' : '0');
//   }, '');

//   // 4. Convert binary hash to hexadecimal
//   return parseInt(hash, 2).toString(16).padStart(16, '0');
// }

// // Example usage:
// const hash1 = await generateImageHash(image1Buffer);
// const hash2 = await generateImageHash(image2Buffer);

// // Calculate Hamming distance between hashes
// function hammingDistance(hash1: string, hash2: string): number {
//   let distance = 0;
//   for (let i = 0; i < hash1.length; i++) {
//     if (hash1[i] !== hash2[i]) distance++;
//   }
//   return distance;
// }

// // If distance is small, images are similar
// const distance = hammingDistance(hash1, hash2);
// const isSimilar = distance < 5; // threshold for similarity


// Example of image diff metrics
// const imageDiffMetrics = {
//   "diffPercentage": 5.2,
//   "numDiffPixels": 24960,
//   "regions": [
//     {
//       "x": 100,
//       "y": 200,
//       "width": 50,
//       "height": 30,
//       "diffPercentage": 15.5
//     }
//   ],
//   "ssim": 0.92,
//   "mse": 125.5
// }

// Example of image comparison using sharp and pixelmatch
// import sharp from 'sharp';
// import pixelmatch from 'pixelmatch';
// import { PNG } from 'pngjs';
// 
// async function compareImages(oldImage: Buffer, newImage: Buffer) {
//   // Resize images to same dimensions for comparison
//   const [oldResized, newResized] = await Promise.all([
//     sharp(oldImage).resize(800, 600).raw().toBuffer(),
//     sharp(newImage).resize(800, 600).raw().toBuffer()
//   ]);

//   // Create output image
//   const diff = new PNG({ width: 800, height: 600 });
  
//   // Compare images
//   const numDiffPixels = pixelmatch(
//     oldResized,
//     newResized,
//     diff.data,
//     800,
//     600,
//     { threshold: 0.1 }
//   );

//   // Calculate difference percentage
//   const totalPixels = 800 * 600;
//   const diffPercentage = (numDiffPixels / totalPixels) * 100;

//   return {
//     diffPercentage,
//     diffImage: diff,
//     numDiffPixels
//   };
// }