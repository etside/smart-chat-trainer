-- Generic AI provider routing: any OpenAI-compatible endpoint.
-- The API key is stored in ai_api_key (mirrored to lovable_api_key_override
-- for legacy consumers). ai_base_url points at the provider's OpenAI-style
-- root, e.g. https://api.xiaomimimo.com/v1 or https://api.openai.com/v1.
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS ai_base_url text;
ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS ai_api_key text;
