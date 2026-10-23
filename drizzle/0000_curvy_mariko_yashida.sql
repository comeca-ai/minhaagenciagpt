CREATE TABLE `workspace_chunks` (
	`user_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`part` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `snapshot`, `part`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`snapshot` text NOT NULL
);
