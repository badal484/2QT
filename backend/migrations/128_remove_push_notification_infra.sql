-- Migration 128: Remove push notification (FCM / web-push) infrastructure
-- The external/device push system (FCM + VAPID web-push) has been removed from the
-- backend. The in-app, DB-backed notifications table/bell/preferences remain intact —
-- this only drops the columns/table that existed solely to support device push delivery.

ALTER TABLE users DROP COLUMN IF EXISTS device_token;
ALTER TABLE users DROP COLUMN IF EXISTS fcm_token;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS push_enabled;
DROP TABLE IF EXISTS push_subscriptions;
