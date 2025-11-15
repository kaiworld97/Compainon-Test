"""FastAPI entrypoint with Gemini + speech integration."""
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from .gemini_client import GeminiClient, GeminiReply, Emotion
from .speech import SpeechTranscriber

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
_speech_transcriber = SpeechTranscriber()


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


class VoiceResponse(ChatResponse):
    """Speech-to-text transcription bundled with Gemini response."""

    transcript: str


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


@app.post(
    "/api/voice",
    response_model=VoiceResponse,
    response_model_by_alias=True,
)
async def create_voice_completion(audio: UploadFile = File(...)) -> VoiceResponse:
    """
    Accepts an audio blob, transcribes to text, and generates a Gemini reply.
    """

    if not audio.filename:
        audio.filename = "voice-message.webm"

    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="빈 음성 파일입니다.")

    suffix = Path(audio.filename).suffix or ".webm"
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(data)
            temp_path = Path(temp_file.name)

        transcript = _speech_transcriber.transcribe(temp_path)
        if not transcript.strip():
            transcript = "음성 메시지를 받았어요."

        gemini_reply = _gemini_client.respond(transcript)
        return VoiceResponse(
            transcript=transcript,
            reply=gemini_reply.reply,
            emotion=gemini_reply.emotion,
            tts_duration_ms=gemini_reply.tts_duration_ms,
        )
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
