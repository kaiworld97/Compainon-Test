"""FastAPI entrypoint with Gemini integration (with mock fallback)."""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from .gemini_client import GeminiClient, GeminiReply, Emotion

app = FastAPI(title="Companion API", version="0.1.0")

# Local Next.js dev server runs on http://localhost:3000 by default.
FRONTEND_ORIGINS = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()  # load .env if present for local dev
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_gemini_client = GeminiClient(api_key=GEMINI_API_KEY)


class ChatRequest(BaseModel):
    """User prompt flowing into Gemini."""

    message: str = Field(..., min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    """Gemini response mirrored back to the UI."""

    model_config = ConfigDict(populate_by_name=True)

    reply: str
    emotion: Emotion
    tts_duration_ms: int = Field(
        ...,
        alias="ttsDurationMs",
        ge=0,
        description="Simulated speech synthesis duration in milliseconds.",
    )

    @classmethod
    def from_gemini(cls, payload: GeminiReply) -> "ChatResponse":
        return cls(
            reply=payload.reply,
            emotion=payload.emotion,
            tts_duration_ms=payload.tts_duration_ms,
        )


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Simple liveness endpoint for smoke tests."""
    return {"status": "ok"}


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    response_model_by_alias=True,
)
async def create_chat_completion(payload: ChatRequest) -> ChatResponse:
    """
    Relay the user message to Gemini (with mock fallback) and return text + emotion.
    """

    gemini_reply = _gemini_client.respond(payload.message)
    return ChatResponse.from_gemini(gemini_reply)
