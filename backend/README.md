# Companion Backend

FastAPI application powering the companion project.

## Setup

```bash
cd backend
pip install -e .[dev]
# copy env template and fill in your Gemini key
cp .env.example .env
# then edit .env to set GEMINI_API_KEY
```

## Run locally

```bash
uvicorn app.main:app --reload --port 8000
```

The app auto-loads `.env` at startup.

## API surface

- `GET /health` – liveness probe.
- `POST /api/chat` – accepts `{ "message": "<user text>" }` and returns a Gemini-inspired reply payload:

```jsonc
{
  "reply": "차분하게 다음 단계를 제안해 드릴게요...",
  "emotion": "happy",
  "ttsDurationMs": 2400
}
```

The `emotion` field feeds the frontend `VideoAvatar`, and `ttsDurationMs` instructs how long the avatar should remain in the `*_talking` state before falling back to `*_idle`.
