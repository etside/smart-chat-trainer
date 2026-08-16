# Daddy AI Advanced Features & RBAC Implementation Plan

This plan introduces role-based access control, secure webhook delivery management with retries, and enhanced data validation for the training pipeline.

## 1. Role-Based Access Control (RBAC)

### Database Changes
- Add `editor` and `viewer` to `app_role` enum.
- Update `has_role` function to support role hierarchy (admin > editor > viewer).
- Grant `SELECT` access to `editor` and `viewer` roles on appropriate tables.

### Logic Changes
- Update `amIAdmin` to `getMyRole` to return the specific role.
- Update `assertAdmin` helper to `assertRole(requiredRole)` to allow flexible access control in server functions.
- Modify `AdminLayout` to conditionally render navigation items and actions based on the user's role.

## 2. Webhook Retries & Dead-Letter Queue (DLQ)

### Database Changes
- Update `webhook_logs` to include:
  - `retry_count`: Number of failed attempts.
  - `next_retry_at`: Scheduled time for the next attempt.
  - `error_details`: Specific error messages from the handler.
  - `processing_status`: `pending`, `success`, `failed`, or `dead_letter`.

### Logic Changes
- **Webhook Handler**: Wrap the main logic in a try-catch. If an internal error occurs (e.g., database timeout, AI failure), mark the log as `pending` with a `next_retry_at` using exponential backoff.
- **Retry Worker**: Implement a server-side function triggered by a cron job that picks up `pending` webhooks where `next_retry_at <= now()` and re-executes the handler logic.
- **DLQ Dashboard**: Create a new page (`/admin/webhook-dlq`) to list failed webhooks that have exhausted retries, allowing manual re-runs or deletion.

## 3. Strict JSON Validation & Dataset Preview

### Logic Changes
- **JSON Schema**: Define a strict Zod schema for the training data JSON upload (`conversation_id`, `messages` with specific `role` and `content`).
- **Validation Step**: Add a `validateJson` server function that checks the schema and returns a summarized preview (e.g., number of conversations, total messages, detected entities).
- **UI Enhancement**: In the "JSON Upload" tab, add a "Validate & Preview" button. Only after successful validation and user confirmation of the preview will the "Import" button become active.

## Technical Details

### `app_role` hierarchy
```text
admin  -> Full access (settings, API keys, deletions)
editor -> Read/Write access (add data, test webhooks, edit pairs)
viewer -> Read-only access (view stats, logs, progress)
```

### Exponential Backoff Strategy
- Attempt 1: 1 minute
- Attempt 2: 5 minutes
- Attempt 3: 30 minutes
- Attempt 4: 2 hours
- Attempt 5: 12 hours (Mark as DLQ after 5 failures)
