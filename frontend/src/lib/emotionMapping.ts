export type Emotion = "base" | "happy" | "sad";

export type CompanionMode = "idle" | "talking" | "thinking";

type EmotionState = {
  label: string;
  idle: string;
};

const VIDEO_BASE_PATH = "/videos";

const emotionStates: Record<Emotion, EmotionState> = {
  base: {
    label: "안정",
    idle: `${VIDEO_BASE_PATH}/base_idle.mp4`,
  },
  happy: {
    label: "행복",
    idle: `${VIDEO_BASE_PATH}/happy_idle.mp4`,
  },
  sad: {
    label: "슬픔",
    idle: `${VIDEO_BASE_PATH}/sad_idle.mp4`,
  },
};

export const EMOTIONS: Emotion[] = Object.keys(emotionStates) as Emotion[];

export const isEmotion = (value: string): value is Emotion =>
  EMOTIONS.includes(value as Emotion);

const BASE_EMOTION: Emotion = "base";

export const resolveEmotion = (value: string | null | undefined): Emotion =>
  isEmotion(value ?? "") ? (value as Emotion) : BASE_EMOTION;

export const getEmotionLabel = (emotion: Emotion): string =>
  emotionStates[emotion]?.label ?? emotionStates[BASE_EMOTION].label;

export const getVideoForState = (
  emotion: Emotion,
  mode: CompanionMode,
): string => {
  if (mode === "thinking") {
    return emotionStates[BASE_EMOTION].idle;
  }

  const states = emotionStates[emotion] ?? emotionStates[BASE_EMOTION];
  return states.idle;
};
