CREATE TABLE `system_health_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metric_date` timestamp NOT NULL,
	`api_error_count` int DEFAULT 0,
	`api_success_count` int DEFAULT 0,
	`llm_error_count` int DEFAULT 0,
	`llm_success_count` int DEFAULT 0,
	`webhook_delivery_success` int DEFAULT 0,
	`webhook_delivery_failed` int DEFAULT 0,
	`storage_usage_bytes` bigint DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `system_health_metrics_id` PRIMARY KEY(`id`)
);
