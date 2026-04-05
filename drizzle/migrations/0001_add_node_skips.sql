CREATE TABLE `nodeSkips` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `serviceId` int NOT NULL,
  `nodeType` varchar(50) NOT NULL,
  `skippedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `nodeSkips_id_pk` PRIMARY KEY(`id`),
  CONSTRAINT `nodeSkips_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `nodeSkips_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE,
  CONSTRAINT `nodeSkips_userId_serviceId_nodeType_unique` UNIQUE(`userId`,`serviceId`,`nodeType`)
);
