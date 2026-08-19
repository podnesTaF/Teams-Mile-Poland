CREATE TABLE "event_media" (
	"event_slug" text PRIMARY KEY NOT NULL,
	"drive_folder_id" text NOT NULL,
	"cover_file_id" text,
	"photo_count" integer NOT NULL,
	"video_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
