# Daddy AI Training Logs Export & Deployment Plan

Implement training log exports, real-time finish notifications, and a paginated/searchable transcription table. Finalize Netlify GitHub sync configuration for seamless deployment.

## User Actions
- **Export Training Logs**: Download JSON/CSV reports of training runs directly from the progress page.
- **Real-time Notifications**: Receive instant toast notifications when a training job completes successfully or fails.
- **Enhanced Run Details**: Filter and search through transcription samples in the detail modal to find low-confidence entries.

## Implementation Details

### 1. Training Logs & Export
- **Server Function**: Update `src/lib/console.functions.ts` to add `exportTrainingRunLogs` which fetches a job's validation errors, versioning, and timeline for CSV/JSON export.
- **UI Enhancement**: Add an "Export Logs" button to the job detail modal in `src/routes/admin.progress.tsx`.

### 2. Notifications & Live Progress
- **Real-time Monitoring**: Update `TrainingProgress` component to track job completion state changes between refetch cycles.
- **Toast Alerts**: Trigger `sonner` notifications when a job's status transitions to 'completed' or 'failed'.

### 3. Transcription Samples Table
- **Server Function**: Enhance `getTrainingJobDetail` in `src/lib/console.functions.ts` to support pagination and search parameters for samples.
- **UI Detail View**: Replace the static sample list with a searchable, paginated table in the job detail dialog.

### 4. Netlify Sync & Deployment
- **Config Audit**: Verify `netlify.toml` and `.env.example` include all critical keys (Meta, B2B, Sync).
- **GitHub Sync Support**: Ensure the build pipeline uses `bun` and correctly maps SSR routes for Netlify Functions.

## Technical Tasks

### Frontend
- **Pagination Logic**: Implement state for `page` and `search` within the `TrainingProgress` modal.
- **CSV Generator**: Add a client-side utility to convert JSON logs to CSV for download.

### Backend
- **Query Optimization**: Update `getTrainingJobDetail` to handle query filters for `training_pairs` associated with a specific run.
- **Environment Integrity**: Sync `NETLIFY_CHECKLIST.md` with the latest B2B and VPS variable requirements.
