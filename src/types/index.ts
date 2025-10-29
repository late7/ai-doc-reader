// Shared types for the application

export interface Question {
  id: string;
  question: string;
  category: string;
}

export interface Category {
  id: string;
  title: string;
  prompt: string;
  categoryName: string;
}

export interface QuestionsConfig {
  questions: Question[];
  prompts: {
    companySummary: string;
    prefix: string;
    suffix: string;
  };
}

export interface CategoriesConfig {
  categories: Category[];
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  threads?: Array<{ user_id: string | null; slug: string; name: string }>;
  vectorTag?: string | null;
  createdAt?: string;
  lastUpdatedAt?: string;
  openAiPrompt?: string | null;
  similarityThreshold?: number;
  chatMode?: string;
}

export interface AnalysisResult {
  questionId: string;
  result: string;
  timestamp: Date;
  additionalNotes?: string;
  coverageScore?: string;
  sources?: Array<{
    document: string;
    text: string;
  }>;
}
