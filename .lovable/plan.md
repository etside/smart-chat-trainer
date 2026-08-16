# implementation plan - visual text edits & feature enhancements

Apply requested visual text updates to the dashboard and implement comprehensive feature enhancements for the Wear Impressive AI console.

## user-facing changes

- **dashboard update**: replace the current summary text with the specific approval and instruction block requested.
- **ai credit & billing**: display current credit usage/balance in the dashboard and settings.
- **custom ai api keys**: add support for users to provide their own OpenAI/Lovable API keys if they prefer.
- **model/version tracking**: 
  - track training "snapshots" or versions.
  - allow selecting which version a connection (API key) uses.
  - support rollback to previous training states.
- **training progress page**: new page showing status, last run time, and errors for every automatic training job.
- **webhook receiver**: public endpoint to handle messages from external platforms and trigger training/response flows.
- **data export**: buttons to download JSON conversation exports, voice transcripts, and approved training sets.

## technical details

- **database schema updates**:
  - `agent_settings`: add `lovable_api_key_override`.
  - `training_jobs`: new table to track status of automated training runs.
  - `training_versions`: new table to store snapshots of approved pairs.
  - `api_keys`: add `version_id` to link keys to specific training snapshots.
- **transcription & voice**: ensure both Bengali and English models are explicitly supported in `ai.server.ts` prompts.
- **server functions**:
  - `exportData`: new function to stream/return JSON/CSV exports.
  - `getTrainingJobs`: fetch status of background tasks.
- **webhook handler**: implement `src/routes/api/public/webhook.ts`.

## architecture

```text
[Dashboard] -> [Training Progress] -> [Settings (API Keys, Versions)]
      |               |
      v               v
[Agent Logic] <-> [Training Jobs Table]
      |               |
      v               v
[Supabase] <-> [External Webhooks]
```
