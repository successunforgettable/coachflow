-- D4: Public landing page columns for Cloudflare Workers deployment
ALTER TABLE `landingPages` ADD `publicSlug` varchar(255);--> statement-breakpoint
ALTER TABLE `landingPages` ADD `publicUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `landingPages` ADD UNIQUE INDEX `landingPages_publicSlug_unique` (`publicSlug`);
