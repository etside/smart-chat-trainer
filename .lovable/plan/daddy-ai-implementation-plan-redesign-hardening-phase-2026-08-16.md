# Daddy AI Implementation Plan - Redesign & Hardening Phase

Comprehensive update focused on multilingual sales automation, voice reliability, RBAC hardening, and mobile-first UI enhancements.

## User Experience & Redesign
- **Mobile Navigation Fix**: Ensure sidebar/mobile-nav buttons are fully visible and tappable on all device sizes.
- **Hero Section Animation**: Add dynamic animations in the hero section showing AI answering industry-specific customer questions (Real Estate, E-commerce, Fashion).
- **Voice Interface Polish**:
  - Add explicit "Recording..." and "Processing..." states.
  - Implement a "Retry Transcript" button if AI extraction fails.
  - Improve error messaging for microphone permission or network failures.
- **Typing Workflow**: Fix conflicts between manual text entry and voice transcription updates in the `Add Data` console.

## Features & Automation
- **Auto-Reply Template Manager**:
  - New Admin UI to create and edit response templates.
  - Multilingual support: English, Bengali, and Banglish.
  - Platform-specific context (WhatsApp vs. Messenger vs. Web).
- **Audit Logging**:
  - Expand `audit_logs` to capture login events, role changes, and AI message triggers.
  - New Admin UI for searching and filtering audit logs.
- **Tenant Onboarding**:
  - Auto-generate `sync_token` and `sync_secret` for new tenant accounts.
  - Guided setup for Meta Graph API versioning and platform requirements.

## Security & Reliability
- **RBAC Hardening**:
  - Strict verification of `admin`, `editor`, and `viewer` roles on all protected server functions.
  - Ensure tenant admins have full access except for global security/system settings.
- **Legal Routing**:
  - End-to-end verification of Privacy, Terms, and GDPR navigation across mobile and desktop.
- **E2E Testing Suite**:
  - Playwright tests for permission isolation and auth security.
  - Verification of core business flows (Training -> Sync -> Reply).

## Technical Details
- **Schema Updates**:
  - `auto_reply_templates` table: `id`, `name`, `platform`, `language`, `template_text`, `variables`.
  - `audit_logs` expansion: Add `event_type` and refined `metadata` indexing.
- **Voice Logic**: Enhance `VoiceRecorder.tsx` with `MediaRecorder` state listeners and failure recovery.
- **Translations**: Standardize Bengali/English sales context in `agent.server.ts`.
