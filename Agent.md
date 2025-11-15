# Grok AI Companion PoC – Web Spec (Next.js + FastAPI)

## 0. 목표 정리 (Epic 연결)

- **Epic 1 (완료)**: PoC 기획 및 페르소나 정의  
- **Epic 2 (거의 완료)**: Veo2 에셋 3×2종(기본/기쁨/슬픔 × idle/말하기) 제작  
- **지금 목표**
  - 웹에서 돌아가는 **AI Companion PoC**를 만든다.
  - **프론트**: 영상(상태별 Veo2 클립) + 텍스트/음성 채팅 UI
  - **백엔드**: Gemini 연동, 상태 결정 로직, STT/TTS 연동

---

## 1. 전체 아키텍처

### 1.1 구성

- **frontend/** → Next.js(React, TypeScript, App Router)
- **backend/** → FastAPI (Python 3.11+)

브라우저  
→ `Next.js` (채팅 UI + Veo2 영상 플레이어)  
→ (HTTP / fetch)  
→ `FastAPI` (Gemini, STT, TTS, 상태 머신)  
→ 외부 API들 (Gemini, STT/TTS, Veo2 생성은 이미 완료된 파일 사용)

---

## 2. 프론트엔드 스펙 (Next.js)

### 2.1 Tech Stack

- **Next.js 14+ (App Router)**
- **TypeScript**
- **TailwindCSS** (빠른 UI 구성)
- 상태관리: **React Query** + 컴포넌트 내부 state 정도로 충분
- 비디오: `<video>` 태그 또는 React Player (필요 시)

### 2.2 폴더 구조 (제안)

```bash
frontend/
  app/
    layout.tsx
    page.tsx                 # 메인 Companion 화면
    api/                     # (선택) Next API Route, 현재는 FastAPI 사용이 메인
  src/
    components/
      ChatPanel.tsx          # 텍스트 채팅 UI
      VideoAvatar.tsx        # Veo2 캐릭터 영상 컴포넌트
      MessageBubble.tsx      # 채팅 말풍선
      MicButton.tsx          # STT 트리거 버튼
      AudioPlayer.tsx        # TTS 재생 컴포넌트
    hooks/
      useChat.ts             # 채팅 / 상태 전환 로직 훅
    lib/
      apiClient.ts           # FastAPI 호출 클라이언트
      emotionMapping.ts      # 상태→영상 URL 매핑
      types.ts               # 공통 타입 정의
    styles/
      globals.css
  package.json
  tsconfig.json
  tailwind.config.js
2.3 상태/영상 매핑 정의
상태 정의

base_idle

base_talking

happy_idle

happy_talking

sad_idle

sad_talking

또는

emotion = "base" | "happy" | "sad"

mode = "idle" | "talking"

예시 – src/lib/emotionMapping.ts

ts
코드 복사
export type Emotion = 'base' | 'happy' | 'sad';
export type Mode = 'idle' | 'talking';

export type VideoState = {
  emotion: Emotion;
  mode: Mode;
};

export const VIDEO_SOURCES: Record<Emotion, Record<Mode, string>> = {
  base: {
    idle: '/videos/base_idle.mp4',
    talking: '/videos/base_talking.mp4',
  },
  happy: {
    idle: '/videos/happy_idle.mp4',
    talking: '/videos/happy_talking.mp4',
  },
  sad: {
    idle: '/videos/sad_idle.mp4',
    talking: '/videos/sad_talking.mp4',
  },
};
2.4 주요 컴포넌트 설명
2.4.1 <VideoAvatar />
props:

emotion: Emotion

mode: Mode

isSpeaking: boolean (TTS 재생 중 여부)

역할:

VIDEO_SOURCES[emotion][mode]로 비디오 src 선택

autoPlay, loop, muted 설정

말하는 상태일 땐 mode = 'talking' 사용, 아닐 땐 'idle'

tsx
코드 복사
// src/components/VideoAvatar.tsx
import { Emotion, Mode, VIDEO_SOURCES } from '@/lib/emotionMapping';

type Props = {
  emotion: Emotion;
  mode: Mode;
};

export function VideoAvatar({ emotion, mode }: Props) {
  const src = VIDEO_SOURCES[emotion][mode];

  return (
    <div className="w-full max-w-md mx-auto aspect-video rounded-xl overflow-hidden bg-black">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
2.4.2 <ChatPanel />
유저 텍스트 입력

이전 메시지 리스트 렌더

useChat 훅을 사용해 FastAPI /chat 호출

응답 받으면:

메시지 목록 업데이트

emotion, mode에 따라 상단 VideoAvatar 상태 갱신

TTS URL 있으면 <AudioPlayer>로 재생

2.4.3 useChat 훅
내부 state:

messages: ChatMessage[]

videoState: { emotion: Emotion; mode: Mode }

isLoading

메서드:

sendTextMessage(text: string)

나중에 sendVoiceMessage(blob: Blob)도 추가(STT)

3. 백엔드 스펙 (FastAPI)
3.1 Tech Stack
Python 3.11+

FastAPI

uvicorn

HTTP 클라이언트: httpx 혹은 requests

TTS/STT는 나중에 실제 서비스 붙일 수 있도록 추상화 레이어로 설계

3.2 폴더 구조 (제안)
bash
코드 복사
backend/
  app/
    main.py
    api/
      __init__.py
      chat.py         # /chat 엔드포인트
      stt.py          # /stt (선택)
      tts.py          # /tts (선택)
    core/
      config.py       # 환경변수, 설정
      state_machine.py# 텍스트 → 감정/상태 결정 로직
      gemini_client.py# Gemini 호출 래퍼
      tts_client.py   # TTS 래퍼
      stt_client.py   # STT 래퍼
    models/
      __init__.py
      chat.py         # Pydantic 모델
  requirements.txt
3.3 환경변수 (예시)
GEMINI_API_KEY

TTS_API_KEY (선택)

STT_API_KEY (선택)

ALLOWED_ORIGINS (CORS)

3.4 주요 엔드포인트 설계
3.4.1 POST /api/chat
요청(Request)

json
코드 복사
{
  "session_id": "optional-session-id",
  "user_message": "string",
  "current_emotion": "base | happy | sad",
  "current_mode": "idle | talking"
}
응답(Response)

json
코드 복사
{
  "reply": "AI의 텍스트 응답",
  "emotion": "base | happy | sad",
  "mode": "idle | talking",
  "tts_audio_url": "https://.../audio/file.mp3",
  "debug": {
    "gemini_raw": {},
    "state_reason": "왜 이 감정/상태가 결정되었는지 간단 설명"
  }
}
기본 PoC에서는 tts_audio_url 없이 텍스트만 리턴해도 OK.

나중에 TTS 붙이면 URL 리턴.

FastAPI 예시 스켈레톤 – app/api/chat.py

python
코드 복사
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.state_machine import decide_state
from app.core.gemini_client import call_gemini

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str | None = None
    user_message: str
    current_emotion: str = "base"
    current_mode: str = "idle"

class ChatResponse(BaseModel):
    reply: str
    emotion: str
    mode: str
    tts_audio_url: str | None = None
    debug: dict | None = None


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # 1) Gemini에 유저 메시지 전달
    gemini_reply = await call_gemini(req.user_message)

    # 2) 상태 결정 로직 (키워드 기반 간단 룰 → 나중에 고도화)
    emotion, mode, reason = decide_state(
        user_message=req.user_message,
        model_reply=gemini_reply,
        current_emotion=req.current_emotion,
    )

    # 3) (선택) TTS 호출 후 URL 반환
    tts_url = None
    # tts_url = await synthesize_tts(gemini_reply)

    return ChatResponse(
        reply=gemini_reply,
        emotion=emotion,
        mode=mode,
        tts_audio_url=tts_url,
        debug={"state_reason": reason},
    )
3.5 상태 머신 / 키워드 기반 로직
app/core/state_machine.py

간단 키워드 기반으로 PoC:

“ㅋㅋ, 😆, good, awesome, 좋아, 재밌” → happy

“힘들, sad, 우울, 막힌, 안돼, 답답” → sad

그 외 → base

말하는 상태(talking)는:

프론트에서 응답 재생 중일 때 mode='talking'

TTS 끝나면 mode='idle'로 돌아가게 프론트에서 처리
→ 백엔드는 기본적으로 emotion만 결정해도 됨

python
코드 복사
def decide_state(user_message: str, model_reply: str, current_emotion: str):
    text = (user_message + " " + model_reply).lower()
    reason = ""

    happy_keywords = ["good", "great", "awesome", "재밌", "좋아", "ㅋㅋ", "행복"]
    sad_keywords = ["sad", "힘들", "우울", "막힌", "답답", "슬프", "불안"]

    emotion = "base"

    if any(k in text for k in happy_keywords):
        emotion = "happy"
        reason = "Detected happy-related keywords."
    elif any(k in text for k in sad_keywords):
        emotion = "sad"
        reason = "Detected sad-related keywords."
    else:
        emotion = "base"
        reason = "No strong emotional keywords found."

    # mode는 프론트에서 TTS 재생 여부로 컨트롤하므로 여기서는 idle로 반환
    mode = "idle"

    return emotion, mode, reason
4. 프론트–백 통신 규약 (Cursor에서 참고용)
4.1 프론트 apiClient
ts
코드 복사
// src/lib/apiClient.ts
import { Emotion, Mode } from './emotionMapping';

export type ChatRequest = {
  session_id?: string;
  user_message: string;
  current_emotion: Emotion;
  current_mode: Mode;
};

export type ChatResponse = {
  reply: string;
  emotion: Emotion;
  mode: Mode;
  tts_audio_url?: string | null;
  debug?: Record<string, unknown>;
};

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error('Chat API Error');
  }

  return res.json();
}
5. 구현 단계 체크리스트 (Cursor 작업 순서 가이드)
Step 1 – 프로젝트 스캐폴드
frontend/에 Next.js + TS + Tailwind 초기화

backend/에 FastAPI 초기 프로젝트 생성

CORS 설정 (프론트 도메인 허용)

Step 2 – Veo2 에셋 통합 (Epic 2 연계)
public/videos/에 Veo2 결과물 6개(mp4) 배치

emotionMapping.ts에 상태→영상 매핑 정의

<VideoAvatar> 컴포넌트로 상태에 따라 영상 변경 잘 되는지 확인

Step 3 – 텍스트 채팅 + Gemini 연동 (Epic 3)
ChatPanel + useChat로 텍스트 채팅 UI 제작

FastAPI /api/chat + gemini_client 작성 (실제 Gemini 호출 or Mock)

응답의 emotion에 따라 VideoAvatar 상태 변경

프론트에서 mode:

유저 입력 직후 → Companion “생각 중” → 잠깐 base_idle

응답 도착 + TTS 재생 시작 → *_talking

TTS 종료 후 → *_idle

Step 4 – 음성(STT/TTS) 기능 추가 (Epic 4)
<MicButton>에서 녹음 → /api/stt로 전송 → 텍스트로 변환

/api/chat에서 tts_audio_url 리턴

<AudioPlayer>에서 URL 기반 오디오 재생 