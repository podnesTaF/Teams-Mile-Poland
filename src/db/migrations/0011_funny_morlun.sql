CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_pl" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ua" text NOT NULL,
	"body_pl" text NOT NULL,
	"body_en" text NOT NULL,
	"body_ua" text NOT NULL,
	"cover_image_url" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_slug_unique" UNIQUE("slug")
);
