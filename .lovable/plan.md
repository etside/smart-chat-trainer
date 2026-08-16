# Implementation Plan - visual text edits & feature enhancements

Apply requested visual text updates to the dashboard and implement comprehensive feature enhancements for the Wear Impressive AI console.

## User-facing changes

- **Dashboard update**: Replace the current summary text with the specific instruction and approval block.
- **AI credit & billing**: Display current credit usage/balance in the dashboard and settings.
- **Custom AI API keys**: Add support for users to provide their own OpenAI/Lovable API keys.
- **Model/Version tracking**: 
  - Track training "snapshots" or versions.
  - Allow selecting which version a connection (API key) uses.
  - Support rollback to previous training states.
- **Training progress page**: New page showing status, last run time, and errors for every automatic training job.
- **Webhook receiver**: Public endpoint to handle messages from external platforms and trigger training/response flows.
- **Data export**: Buttons to download JSON conversation exports, voice transcripts, and approved training sets.

## Technical details

- **Database schema updates**:
  - `agent_settings`: Add `lovable_api_key_override`.
  - `training_jobs`: New table to track status of automated training runs.
  - `training_versions`: New table to store snapshots of approved pairs.
  - `api_keys`: Add `version_id` to link keys to specific training snapshots.
- **Transcription & voice**: Ensure both Bengali and English models are explicitly supported in `ai.server.ts` prompts.
- **Server functions**:
  - `exportData`: New function to stream/return JSON/CSV exports.
  - `getTrainingJobs`: Fetch status of background tasks.
- **Webhook handler**: Implement `src/routes/api/public/webhook.ts`.

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
