"""Speech transcription utilities with optional Whisper support."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

try:
    from faster_whisper import WhisperModel
except Exception:  # pragma: no cover - optional dependency
    WhisperModel = None  # type: ignore[assignment]


class SpeechTranscriber:
    """Transcribes audio files using Whisper when available, else fallback."""

    def __init__(self, model_size: str = "small") -> None:
        self._logger = logging.getLogger(__name__)
        self._model: Optional[WhisperModel] = None
        self._model_size = model_size

        if WhisperModel is not None:
            try:
                self._model = WhisperModel(
                    model_size,
                    device="cpu",
                    compute_type="int8",
                )
            except Exception as error:  # pragma: no cover
                self._logger.warning(
                    "Failed to initialize Whisper model (%s): %s",
                    model_size,
                    error,
                )
                self._model = None

    def transcribe(self, audio_file: Path) -> str:
        """Return the transcription text or a descriptive placeholder."""

        if self._model is not None:
            try:
                segments, _ = self._model.transcribe(
                    str(audio_file),
                    beam_size=1,
                    vad_filter=True,
                )
                text = " ".join(
                    segment.text.strip() for segment in segments if segment.text
                ).strip()
                if text:
                    return text
            except Exception as error:  # pragma: no cover
                self._logger.warning("Whisper transcription failed: %s", error)

        size_kb = audio_file.stat().st_size / 1024
        return f"음성으로 전달된 메시지 (약 {size_kb:.1f}KB)"
