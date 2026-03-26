CREATE TABLE IF NOT EXISTS `favourites` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `nodeId` VARCHAR(50) NOT NULL,
  `itemIndex` INT NOT NULL,
  `itemText` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_favourites_user_node` (`userId`, `nodeId`)
);
