export interface SeminarOutline {
  title: string;
  description: string;
  sessions: Session[];
  fullSermon?: string;
  specializedPrayers?: SpecializedPrayerPoint[];
  podcastScript?: string;
}

export interface SpecializedPrayerPoint {
  category: string;
  scripture: string;
  prayer: string;
}

export interface TalkingPoint {
  point: string;
  deepDive: string;
}

export interface Session {
  id: string;
  title: string;
  duration: string;
  keyScriptures: string[];
  talkingPoints: string[];
  detailedTalkingPoints?: TalkingPoint[];
  prayerFocus?: string;
}

export interface StudyDay {
  day: number;
  title: string;
  passage: string;
  summary: string;
  reflectionQuestions: string[];
  personalNotes?: string;
}

export interface StudyPlan {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  days: StudyDay[];
  createdAt: string;
}

export interface GenerationState {
  isLoading: boolean;
  isGeneratingSermon: boolean;
  isGeneratingPrayers: boolean;
  isGeneratingPodcast: boolean;
  isGeneratingVideo: boolean;
  isGeneratingStudyPlan?: boolean;
  error: string | null;
  outline: SeminarOutline | null;
  studyPlan?: StudyPlan | null;
}

export interface HistoryItem {
  id: string;
  title: string;
  topic: string;
  date: string;
  outline: SeminarOutline;
  isFinished?: boolean;
}
