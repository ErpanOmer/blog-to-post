-- Add idempotency support for publish task creation
ALTER TABLE publish_tasks ADD COLUMN idempotencyKey TEXT;

-- Unique idempotency key for task deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_tasks_idempotencyKey
ON publish_tasks(idempotencyKey);

