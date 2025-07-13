ALTER TABLE "jobTrack"."website" ADD COLUMN "etags" text;--> statement-breakpoint
ALTER TABLE "jobTrack"."website" ADD COLUMN "frequency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "jobTrack"."website" DROP COLUMN "image_diff_metrics";--> statement-breakpoint
ALTER TABLE "jobTrack"."website" DROP COLUMN "next_track_at";