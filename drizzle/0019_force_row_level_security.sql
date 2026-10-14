-- Migration 0019: Enforce RLS for table owners and direct connection strings
ALTER TABLE "chats" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_grants" FORCE ROW LEVEL SECURITY;
