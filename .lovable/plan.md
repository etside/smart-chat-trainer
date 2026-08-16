# Project Redesign & Feature Hardening Plan

This plan outlines the redesign of Daddy AI with enhanced role-based security, fixed voice transcription, and robust social platform auto-reply flows.

## Security & RBAC Hardening
- **End-to-End Role Verification**: Audit all routes and server functions to ensure `Admin`, `Editor`, and `Viewer` roles are strictly enforced.
- **Tenant-like Isolation**: Ensure new sign-ups default to a restricted state and roles are managed centrally without compromising system credentials.
- **Credential Protection**: Hardening `agent_settings` and `api_keys` tables with stricter RLS policies to prevent unauthorized access even if a session is compromised.

## Voice & Transcription Fixes
- **Reliable Voice Capture**: Update `VoiceRecorder.tsx` to handle various mime-types and browser environments more robustly.
- **Transcription Workflow**: Fix the conflict between voice transcription and manual text entry to allow seamless editing of transcripts before saving.
- **Model Upgrade**: Ensure `whisper-large-v3-turbo` is consistently used with language-specific prompts for English and Bengali.

## AI Sales Agent Enhancements
- **Multi-lingual Context**: Refine `agent.server.ts` to better handle switching between English and Bengali based on customer input.
- **Auto-Reply Flows**: Implement configurable response templates for social platforms (WhatsApp, Messenger, IG) that leverage real-time catalog data.
- **Context Handling**: Improve memory of previous turns to maintain context during sales negotiations.

## Visual Redesign (Daddy AI Branding)
- **Glassmorphism Overhaul**: Apply consistent blur and transparency effects across all dashboard components.
- **High-Contrast Mode**: Finalize the implementation of the high-contrast toggle for accessibility.
- **Layout Optimization**: Ensure all 2/3 column layouts are fully responsive and touch-friendly on mobile devices.

## Legal & Navigation Pass
- **Wiring Verification**: Audit all navigation links for Privacy, Terms, and GDPR pages.
- **Cross-Device Accessibility**: Ensure navigation buttons are clearly visible and easy to interact with on small screens.

## Technical Details
- **Frontend**: React 19, TanStack Start, Tailwind CSS v4, Framer Motion for transitions.
- **Backend**: Supabase RLS, `createServerFn` for logic, HMAC for webhook security.
- **AI**: Lovable AI Gateway (GPT-4o-mini, Whisper).
