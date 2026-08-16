# Implementation Plan - Visual Text Edits & Feature Enhancements

Apply requested visual text updates and implement comprehensive feature enhancements for the Wear Impressive AI console.

## User-facing changes

- **Dashboard Update**: The dashboard summary has been updated with the requested instruction and approval block.
- **AI Credit & Billing**: Display AI credit usage and allow adding custom API keys in the settings.
- **Model/Version Tracking**: New interface to track training versions, select versions for API connections, and roll back if needed.
- **Training Progress Page**: A dedicated page showing the status, timing, and errors for automatic training jobs.
- **Webhook Receiver**: Support for external platforms to send messages to the app via a dedicated webhook endpoint.
- **Data Export**: Tools to download training sets, JSON exports, and voice transcripts.

## Technical details

- **Database Schema Updates**:
  - `agent_settings`: Add `lovable_api_key_override`.
  - `training_jobs`: New table for tracking background training tasks.
  - `training_versions`: Table to store snapshots of approved Q&A pairs.
  - `api_keys`: Add `version_id` to link keys to specific snapshots.
- **AI & Transcription**: Refine `ai.server.ts` to explicitly handle simultaneous Bengali and English transcription and voice processing.
- **API Enhancements**:
  - Implement `src/routes/api/public/webhook.ts` for external integrations.
  - Add data export server functions using streamed responses.

## Architecture

```text
[Dashboard] -> [Training Progress] -> [Settings (API Keys, Versions)]
      |               |
      v               v
[Agent Logic] <-> [Training Jobs Table]
      |               |
      v               v
[Supabase] <-> [External Webhooks]
```
