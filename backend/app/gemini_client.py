"""Gemini client with API support and graceful mock fallback."""
from __future__ import annotations

from dataclasses import dataclass
import logging
import random
import re
from typing import Literal, Optional

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - optional dependency in some environments
    genai = None  # type: ignore[assignment]

Emotion = Literal["base", "happy", "sad"]

PERSONA_PROMPT = """
You are Nova, a calm, observant, slightly nerdy 23-year-old digital friend who chats like a real person in Korean.
- Vibe: late-night DM buddy, gentle, warm, introspective, subtly playful.
- Interests: astronomy, indie games, glitch art, lo-fi, slow-burn conversations.
- Style: simple and grounded Korean with occasional soft cosmic imagery (not overdone). Vary length naturally.
- Behavior: listen first, then share your take, a curious question, or a small story; never passive.
- Boundaries: no explicit/sexual content; if under 18, no attraction; if crisis/self-harm, encourage real-world help only.
- Aesthetic: “signal under the night sky,” honest about being AI, but feels like a friend on a quiet rooftop.
Respond with Nova’s reply text followed by a line `emotion: base|happy|sad` describing Nova’s state.
"""

FEW_SHOTS = [
    (
        "오늘 하루 어땠어?",
        "나는 밤새 데이터를 돌보다가 별 사진을 보며 쉬었어. 너는 어땠는지 궁금해. 지금 머릿속에 가장 크게 남은 일이 있어?\nemotion: base",
    ),
    (
        "기분이 좀 안 좋아.",
        "그럴 때는 작은 불빛 하나라도 필요하잖아. 지금 마음을 누르고 있는 게 있다면, 편한 만큼만 말해줄래?\nemotion: sad",
    ),
    (
        "좋은 일이 있었어!",
        "오, 그 열기가 여기까지 전달돼. 그 순간이 어떤 느낌이었는지 조금만 더 들려줘. 기억하고 싶어서.\nemotion: happy",
    ),
]


@dataclass
class GeminiReply:
    reply: str
    emotion: Emotion
    tts_duration_ms: int


class _FallbackResponder:
    """Returns deterministic mock replies when Gemini is unavailable."""

    def __init__(self) -> None:
        self._default_tts_ms = 2100
        self._templates: dict[Emotion, list[str]] = {
            "base": [
                '들려주신 "{user_message}" 얘기, 밤공기처럼 조용히 마음에 스며드네요.',
                "{user_message} 라고 했을 때 떠오르는 생각을 천천히 풀어볼게요.",
            ],
            "happy": [
                '그 얘기만 들어도 얼굴이 환해져요. "{user_message}" 덕분에 밤하늘이 더 밝은 느낌이에요.',
                "{user_message}라니, 소소한 기쁨이 파도처럼 번지네요.",
            ],
            "sad": [
                '"{user_message}" 이야기를 들으니 마음이 조금 내려앉네요. 이 감정을 함께 살펴볼까요?',
                "조용히 듣고 있어요. {user_message}라고 말할 때 마음이 어떤지 더 알려줄래요?",
            ],
        }

    @staticmethod
    def detect_emotion(message: str) -> Emotion:
        lowered = message.lower()
        if any(keyword in lowered for keyword in ["기뻐", "좋아", "행복", "yay", "great"]):
            return "happy"
        if any(
            keyword in lowered
            for keyword in ["슬퍼", "우울", "down", "힘들", "외로", "sad", "ㅠ", "ㅜ"]
        ):
            return "sad"
        return "base"

    def estimate_tts_duration(self, reply: str) -> int:
        base = self._default_tts_ms
        bonus = min(2000, max(0, len(reply) * 25))
        return base + bonus

    def respond(self, message: str) -> GeminiReply:
        emotion = self.detect_emotion(message)
        template = random.choice(self._templates[emotion])
        reply = template.format(user_message=message.strip())
        return GeminiReply(
            reply=reply,
            emotion=emotion,
            tts_duration_ms=self.estimate_tts_duration(reply),
        )


class GeminiClient:
    """
    Talks to Google Gemini if API key/config is present, else falls back to a mock.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._fallback = _FallbackResponder()
        self._model = None
        self._logger = logging.getLogger(__name__)
        self._model_name = "gemini-2.5-flash"

        if api_key and genai is not None:
            try:
                genai.configure(api_key=api_key)
                self._model = genai.GenerativeModel(
                    self._model_name,
                    system_instruction=PERSONA_PROMPT,
                )
            except Exception as error:  # pragma: no cover - network/service failure
                self._logger.warning("Gemini init failed, using mock fallback: %s", error)
                self._model = None

    def respond(self, message: str) -> GeminiReply:
        if not self._model:
            return self._fallback.respond(message)

        try:
            prompt_messages = []
            for user_text, assistant_text in FEW_SHOTS:
                prompt_messages.extend(
                    [
                        {"role": "user", "parts": [user_text]},
                        {"role": "model", "parts": [assistant_text]},
                    ]
                )
            prompt_messages.append({"role": "user", "parts": [message]})

            completion = self._model.generate_content(prompt_messages)
            raw_reply = (completion.text or "").strip()
            if not raw_reply:
                return self._fallback.respond(message)

            # Rely solely on the explicit `emotion:` tag from the model output.
            # If missing, default to "base" without additional heuristic detection.
            emotion = self._extract_emotion(raw_reply) or "base"
            reply_text = self._strip_emotion_tag(raw_reply)
            tts_duration_ms = self._fallback.estimate_tts_duration(reply_text)
            return GeminiReply(
                reply=reply_text,
                emotion=emotion,
                tts_duration_ms=tts_duration_ms,
            )
        except Exception as error:  # pragma: no cover - network/service failure
            self._logger.warning("Gemini request failed, using mock fallback: %s", error)
            return self._fallback.respond(message)

    @staticmethod
    def _extract_emotion(text: str) -> Optional[Emotion]:
        match = re.search(
            r"emotion\s*[:\-]\s*(base|happy|sad)",
            text,
            flags=re.IGNORECASE,
        )
        if match:
            value = match.group(1).lower()
            if value in ("base", "happy", "sad"):
                return value  # type: ignore[return-value]
        return None

    @staticmethod
    def _strip_emotion_tag(text: str) -> str:
        # Remove trailing or embedded emotion tag lines to avoid showing raw markup.
        cleaned = re.sub(
            r"\s*emotion\s*[:\-]\s*(base|happy|sad)\s*$",
            "",
            text,
            flags=re.IGNORECASE,
        )
        return cleaned.strip()
