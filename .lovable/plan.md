# Implementation Plan - Training Console Enhancements

Apply requested visual text updates and implement a comprehensive suite of features for the Wear Impressive AI Sales Agent Training Console, including bilingual support, version tracking, and external integrations.

## User-facing changes

- **Dashboard Update**: The main admin dashboard summary text is updated with specific instructions and approval status.
- **AI Credit Monitoring**: View current credit usage and balance directly within the training console.
- **Custom API Keys**: Support for adding custom AI API keys (OpenAI/Lovable) in Settings for personalized usage tracking.
- **Model & Version Management**:
  - Track training "snapshots" or versions of the AI's knowledge.
  - Choose specific training versions for different API connections.
  - Ability to roll back to a previous training state if performance degrades.
- **Training Progress Page**: A new management view showing real-time status, execution history, and error logs for all automatic training jobs.
- **Webhook Integration**: A new webhook endpoint allows external platforms (like Facebook Messenger or WhatsApp) to send messages directly to the app to trigger responses or training.
- **Data Export**: Structured export tools to download your uploaded JSON files, voice transcripts, and training pair sets.

## Technical details

- **Bilingual Core**: Enhance `src/lib/ai.server.ts` to ensure the transcription and generation prompts explicitly support simultaneous Bengali and English (Banglish) processing.
- **Database Schema**:
  - `agent_settings`: Add `lovable_api_key_override` and `credit_usage` tracking.
  - `training_jobs`: Create a table to log the lifecycle of automated training tasks.
  - `training_versions`: Create a table to store immutable snapshots of approved training pairs.
  - `api_keys`: Add a `version_id` column to route API requests to specific snapshots.
- **Server Functions**:
  - `exportData`: A new server function to generate and stream JSON/CSV datasets.
  - `getTrainingJobs`: Fetch background job status for the UI.
- **External API**: Implement `src/routes/api/public/webhook.ts` with signature validation for secure external platform connectivity.
- **Git Sync Readiness**: Ensure all credentials and environment configurations are structured for seamless synchronization.

## Architecture

```text
[Training Console] -> [Training Progress View] -> [Settings & Versions]
       |                     |
       v                     v
[Agent RAG Logic] <-> [Versioned Training Sets]
       |                     |
       v                     v
[Supabase / Cloud] <-> [External Platform Webhooks]
```
