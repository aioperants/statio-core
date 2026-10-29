-- Statio Core: the whole database, created in one go.
-- The salon's tables fill in business_id themselves: this copy has one salon.
CREATE OR REPLACE FUNCTION core_business_id() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN (SELECT id FROM business ORDER BY created_at LIMIT 1);
END
$$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TYPE "public"."appointment_source" AS ENUM('web', 'admin', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'declined', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."client_source" AS ENUM('online', 'import', 'admin', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'needs_approval', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."pay_model" AS ENUM('owner', 'salary', 'commission', 'salary_commission', 'chair_rent');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'admin', 'staff');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"occupied_from" timestamp with time zone NOT NULL,
	"occupied_to" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"source" "appointment_source" DEFAULT 'web' NOT NULL,
	"suggested" boolean DEFAULT false NOT NULL,
	"booked_for_name" text,
	"notes" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"manage_token" text NOT NULL,
	"allow_overlap" boolean DEFAULT false NOT NULL,
	"paid_cents" integer,
	"payment_method" "payment_method",
	"paid_at" timestamp with time zone,
	"rebook_days" smallint,
	"formula" text,
	"consent_at" timestamp with time zone,
	"absence_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_line" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" integer NOT NULL,
	"chair_id" uuid,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"default_locale" text DEFAULT 'es' NOT NULL,
	"website_locales" text[] DEFAULT '{es,en}'::text[] NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"logo" text,
	"brand_color" text DEFAULT '#111111' NOT NULL,
	"app_colours" text DEFAULT 'neutral' NOT NULL,
	"logo_original" text,
	"booking_look" text DEFAULT 'site' NOT NULL,
	"slot_step_min" smallint DEFAULT 15 NOT NULL,
	"lead_minutes" integer DEFAULT 120 NOT NULL,
	"horizon_days" integer DEFAULT 28 NOT NULL,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"no_show_approval_threshold" smallint DEFAULT 2 NOT NULL,
	"compact_day" boolean DEFAULT false NOT NULL,
	"slot_mode" text DEFAULT 'recommend' NOT NULL,
	"holiday_region" text,
	"country" text,
	"online_hours_on" boolean DEFAULT false NOT NULL,
	"daily_limit" smallint,
	"max_future_bookings_new_client" smallint DEFAULT 2 NOT NULL,
	"cancellation_hours" integer DEFAULT 24 NOT NULL,
	"welcome_texts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stations_labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ask_heard_from" boolean DEFAULT true NOT NULL,
	"ask_city" boolean DEFAULT true NOT NULL,
	"heard_options" text[] DEFAULT '{recommended,social,google,walkby,other}'::text[] NOT NULL,
	"setup_done" boolean DEFAULT false NOT NULL,
	"website" text,
	"about" text,
	"business_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"instagram" text,
	"facebook" text,
	"tiktok" text,
	"other_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"found_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"address_street" text,
	"address_postcode" text,
	"address_town" text,
	"address_town_only" boolean DEFAULT false NOT NULL,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chair" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'styling' NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"rent_cents" integer,
	"renter_staff_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"user_id" text,
	"owner_staff_id" uuid,
	"notes" text,
	"birthday" text,
	"rhythm_days" smallint,
	"guest" boolean DEFAULT false NOT NULL,
	"erased_at" timestamp with time zone,
	"heard_from" text,
	"recommended_by" text,
	"city" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"locale" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"no_show_count" smallint DEFAULT 0 NOT NULL,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"source" "client_source" DEFAULT 'online' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_note" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"text" text NOT NULL,
	"staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'tool' NOT NULL,
	"owner_staff_id" uuid,
	"location" text,
	"note" text,
	"photo" text,
	"rented" boolean DEFAULT false NOT NULL,
	"monthly_cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_settings" (
	"business_id" uuid PRIMARY KEY DEFAULT core_business_id() NOT NULL,
	"provider" text NOT NULL,
	"from_address" text,
	"resend_key_enc" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_pass_enc" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid,
	"client_id" uuid,
	"channel" text DEFAULT 'email' NOT NULL,
	"template" text NOT NULL,
	"to" text NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_hours" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_device" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"morning_on" date,
	"evening_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "service" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"descriptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category" text,
	"category_en" text,
	"category_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category_id" uuid,
	"duration_min" smallint NOT NULL,
	"buffer_before_min" smallint DEFAULT 0 NOT NULL,
	"buffer_after_min" smallint DEFAULT 0 NOT NULL,
	"price_cents" integer NOT NULL,
	"station_kind" text,
	"rebook_days" smallint,
	"colour_card" boolean DEFAULT false NOT NULL,
	"needs_consent" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_category" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text,
	"names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"color" text DEFAULT '#DCE8FB' NOT NULL,
	"photo" text,
	"title" text,
	"role" "staff_role" DEFAULT 'staff' NOT NULL,
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"bookable" boolean DEFAULT true NOT NULL,
	"pay_model" "pay_model" DEFAULT 'commission' NOT NULL,
	"salary_cents" integer,
	"commission_pct" smallint,
	"chair_rent_cents" integer,
	"chair_rent_period" text DEFAULT 'month' NOT NULL,
	"chair_rent_day" smallint DEFAULT 1 NOT NULL,
	"default_chair_id" uuid,
	"owns_clients" boolean DEFAULT false NOT NULL,
	"locale" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"last_name" text,
	"job_title" text,
	"phone" text,
	"access" text DEFAULT 'stylist' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invite_token" text,
	"invite_expires_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"recovery_email" text,
	CONSTRAINT "staff_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "staff_service" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"duration_min" smallint,
	"price_cents" integer,
	"commission_pct" smallint,
	CONSTRAINT "staff_service_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"online_only" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website" (
	"business_id" uuid PRIMARY KEY DEFAULT core_business_id() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"hero_draft" text,
	"hero_published" text,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_photo" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"business_id" uuid DEFAULT core_business_id() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL,
	"valid_from" date,
	"valid_to" date
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_line" ADD CONSTRAINT "appointment_line_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_line" ADD CONSTRAINT "appointment_line_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_line" ADD CONSTRAINT "appointment_line_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_line" ADD CONSTRAINT "appointment_line_chair_id_chair_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."chair"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chair" ADD CONSTRAINT "chair_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chair" ADD CONSTRAINT "chair_renter_staff_id_staff_id_fk" FOREIGN KEY ("renter_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_owner_staff_id_staff_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_owner_staff_id_staff_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_settings" ADD CONSTRAINT "mail_settings_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_hours" ADD CONSTRAINT "online_hours_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device" ADD CONSTRAINT "push_device_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_device" ADD CONSTRAINT "push_device_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service" ADD CONSTRAINT "service_category_id_service_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_category" ADD CONSTRAINT "service_category_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_service" ADD CONSTRAINT "staff_service_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_service" ADD CONSTRAINT "staff_service_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_service" ADD CONSTRAINT "staff_service_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_photo" ADD CONSTRAINT "website_photo_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_staff_time_idx" ON "appointment" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointment_client_idx" ON "appointment" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_token_idx" ON "appointment" USING btree ("manage_token");--> statement-breakpoint
CREATE INDEX "appointment_line_appt_idx" ON "appointment_line" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_email_idx" ON "client" USING btree ("business_id",lower("email"));--> statement-breakpoint
CREATE INDEX "client_phone_idx" ON "client" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "client_user_idx" ON "client" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "client_note_client_idx" ON "client_note" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_device_endpoint_idx" ON "push_device" USING btree ("business_id","endpoint");--> statement-breakpoint
CREATE INDEX "time_off_range_idx" ON "time_off" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "working_hours_staff_idx" ON "working_hours" USING btree ("staff_id","weekday");
--> statement-breakpoint
-- No double booking: one person cannot have two active visits that overlap (buffers included).
-- Visits the owner booked over another on purpose ("allow anyway") are left out.
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist ("staff_id" WITH =, tstzrange("occupied_from", "occupied_to", '[)') WITH &&)
  WHERE ("status" IN ('pending', 'confirmed') AND NOT "allow_overlap");
--> statement-breakpoint
-- A station (pedicure chair, basin, room) holds one service line at a time.
ALTER TABLE "appointment_line" ADD CONSTRAINT "appointment_line_station_no_overlap"
  EXCLUDE USING gist ("chair_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("active" AND "chair_id" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_valid_range" CHECK ("ends_at" > "starts_at" AND "occupied_to" >= "ends_at" AND "occupied_from" <= "starts_at");
--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_valid" CHECK ("weekday" BETWEEN 0 AND 6 AND "start_min" >= 0 AND "end_min" <= 1440 AND "end_min" > "start_min");
