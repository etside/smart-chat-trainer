# Daddy AI Webhook & Training API Documentation

This document describes the API endpoints for Daddy AI, specifically for ingesting training data from trusted platforms.

## Base URL
The base URL for API requests is: `https://your-daddy-ai-instance.lovable.app`

## Training Data Ingestion Webhook

Used by external platforms to automatically submit new training pairs (Question/Answer) to Daddy AI's training pipeline.

**Endpoint:** `POST /api/public/webhook`

### Authentication

Requests must include a secret token in the `X-API-Key` header. This key is managed in the Admin Settings panel under "API Keys".

```bash
curl -X POST https://your-daddy-ai-instance.lovable.app/api/public/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_wi_api_key_here" \
  -d '{
    "training_data": {
      "question": "What is the return policy?",
      "answer": "We offer a 30-day return policy for all products.",
      "context": "Customer Service"
    },
    "idempotency_key": "unique_request_id_12345"
  }'
```

### Request Headers

| Header | Required | Description |
| :--- | :--- | :--- |
| `Content-Type` | Yes | Must be `application/json` |
| `X-API-Key` | Yes | Your Daddy AI API Key (WI prefix) |
| `X-Idempotency-Key` | No | A unique string for the request to prevent duplicate processing. |

### Request Body (JSON)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `training_data` | object | Yes | The training pair container |
| `training_data.question` | string | Yes | The customer question |
| `training_data.answer` | string | Yes | The AI's response |
| `training_data.context` | string | No | Optional context for the training pair |
| `idempotency_key` | string | No | Can also be sent in the body instead of headers. |

### Response Codes

| Status | Description |
| :--- | :--- |
| `200 OK` | Successfully received and queued for training. |
| `401 Unauthorized` | Invalid or missing API Key. |
| `400 Bad Request` | Missing required fields or invalid JSON. |
| `500 Server Error` | Internal error processing the request. |

### Idempotency
Daddy AI supports idempotency. If you send a request with an `X-Idempotency-Key` that has been processed within the last 24 hours, the system will return the original success response without creating a duplicate training pair.
