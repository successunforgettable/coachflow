-- Creates the testimonials library table for persistent, reusable testimonials.
-- Purely additive: new table, no ALTER on existing tables, touches nothing.
-- Testimonials are stored here; the selected 3 for a campaign are written
-- to the existing services.testimonial1-3 columns that all 5 generators read.
CREATE TABLE `testimonials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `serviceId` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NULL,
  `quote` TEXT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `idx_testimonials_userId` (`userId`),
  INDEX `idx_testimonials_serviceId` (`serviceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
