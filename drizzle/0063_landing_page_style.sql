-- D4b: Persist the published style (text vs visual) for landing pages
ALTER TABLE `landingPages` ADD `publishedStyle` enum('text','visual') DEFAULT 'text';
