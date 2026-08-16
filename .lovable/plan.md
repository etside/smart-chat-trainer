# Implementation Plan: Enhancing Daddy AI Infrastructure

This plan addresses the missing frontend and backend components identified during the analysis to improve user experience, operational reliability, and integration depth.

## Proposed Changes

### 1. Frontend Enhancements (UI/UX)
- **Shared Components**:
    - Implement a `ConfirmActionModal` using shadcn/ui Dialog for destructive actions (delete, revoke, reset).
    - Add `framer-motion` for page transitions and layout animations in the admin console.
- **Admin Dashboard**:
    - Add trend indicators (sparklines) to stats cards.
    - Implement a "View Sources" modal in the Playground to show RAG context (training pairs used).
- **Settings & Logs**:
    - Add a background noise texture to the glassmorphism theme for better depth.
    - Implement a "Log Detail" view in the Webhook Logs table.

### 2. Backend Enhancements (Logic & Security)
- **Meta Webhook Integration**:
    - Fully implement the `POST` handler in `src/routes/api.public.webhooks.meta.tsx` to process incoming Messenger/WhatsApp messages.
    - Integrate `generateReply` and `logConversation` into the Meta webhook flow.
- **Training Infrastructure**:
    - Refactor `triggerTraining` to actually process "pending" training pairs instead of just simulating a delay.
    - Add a `training_versions` snapshotting mechanism to allow reverting to previous training states.
- **Security & Reliability**:
    - Verify RLS policies for `webhook_logs` and `sync_runs`.
    - Implement a global error boundary for server functions using the existing `lovable-error-reporting.ts`.

## Technical Details
- **Framer Motion**: `npm install framer-motion` (if not present).
- **Meta API**: Use `FB.api` for browser-side interactions and `fetch` with Graph API versioning for server-side.
- **Database**: Add `training_versions` table and update RLS policies via Supabase migrations.

## User Impact
- **Improved Confidence**: Confirmation modals prevent accidental data loss.
- **Better Visibility**: RAG source view helps users understand *why* the AI answered a certain way.
- **Live Integration**: WhatsApp and Messenger messages will actually trigger AI responses.
