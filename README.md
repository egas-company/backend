# egas-backend

## Notification Infrastructure Quickstart

- Migrations: run `npx prisma migrate deploy` (or `migrate dev`) after pulling to create the new `NotificationDevice`, `NotificationLog`, and `DriverAssignmentAlarm` tables.
- Prisma Client: run `npx prisma generate` whenever the schema changes so enums like `NotificationApp`/`NotificationPlatform` become available to the codebase.
- Redis: set `REDIS_URL` in your environment; BullMQ powers the notification queue and requires a reachable Redis instance.
- Firebase: point `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_CREDENTIALS` to a Firebase Admin service-account JSON with messaging enabled.
- Driver alarm cadence: override `DRIVER_ALARM_REPEAT_MS` (default 120000) to control how often persistent driver reminders are enqueued.
- Worker process: start the queue processor locally with `npm run worker:dev`; production builds should run `npm run worker` (after `npm run build`) in a separate process alongside the API.
