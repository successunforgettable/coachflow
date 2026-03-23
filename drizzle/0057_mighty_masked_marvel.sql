CREATE TABLE `campaignKits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`icpId` int NOT NULL,
	`name` varchar(255),
	`status` enum('draft','complete','exported') NOT NULL DEFAULT 'draft',
	`selectedOfferId` int,
	`selectedMechanismId` int,
	`selectedHvcoId` int,
	`selectedHeadlineId` int,
	`selectedAdCopyId` int,
	`selectedLandingPageId` int,
	`selectedLandingPageAngle` varchar(50),
	`selectedEmailSequenceId` int,
	`selectedWhatsAppSequenceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaignKits_id` PRIMARY KEY(`id`)
);
