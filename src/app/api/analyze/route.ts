import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';
import questionsConfig from '@/config/questions.json';
import globalPrompts from '@/config/globalPrompts.json';
import categoriesConfig from '@/config/categoryPrompts.json';
import formattingPrompt from '@/config/formattingPrompt.json';

interface Category {
  id: string;
  title: string;
  prompt: string;
  categoryName: string;
}

interface CategoriesConfig {
  categories: Category[];
}

export async function POST(request: Request) {
  try {
  const { workspaceSlug, questionId, customPrompt, adHocQuestion, categoryName } = await request.json();
  logger.debug('Analyze API called:', { workspaceSlug, questionId, customPrompt, adHocQuestion, categoryName });
    logger.debug('Questions config loaded:', questionsConfig.questions.length, 'questions');
    
    const typedCategoriesConfig = categoriesConfig as CategoriesConfig;
    logger.debug('Categories config loaded:', typedCategoriesConfig.categories.length, 'categories');

    if (!workspaceSlug) {
      return NextResponse.json(
        { error: 'Workspace slug is required' },
        { status: 400 }
      );
    }

    let prompt = '';
    
  if (questionId) {
      logger.debug('Processing question analysis for questionId:', questionId);
      const question = questionsConfig.questions.find(q => q.id === questionId);
      if (!question) {
        logger.error('Question not found:', questionId);
        return NextResponse.json(
          { error: 'Question not found' },
          { status: 404 }
        );
      }
      
      // Find the category prompt for this question
      const category = typedCategoriesConfig.categories.find(c => c.categoryName === question.category);
      if (!category) {
        logger.error('Category not found for question:', question.category);
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
      
  // Build prompt without deprecated prefix/suffix, using global summary style as base formatting
  prompt = `${category.prompt} \n Focus specifically on this question in your answer: ${adHocQuestion} \n ${formattingPrompt.prompt}`;
      // logger.debug('Question found:', question.title);
      logger.debug('Using category prompt:', category.prompt);
      logger.debug('Focusing on question:', question.question);
    } else if (adHocQuestion && categoryName) {
      logger.debug('Processing ad-hoc question for category:', categoryName);
      const category = typedCategoriesConfig.categories.find(c => c.categoryName === categoryName);
      if (!category) {
        logger.error('Category not found for ad-hoc question:', categoryName);
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
      prompt = `${category.prompt} \n Focus specifically on this question in your answer: ${adHocQuestion} \n ${formattingPrompt.prompt}`;
      logger.debug('Using category prompt (ad-hoc):', category.prompt);
      logger.debug('Ad-hoc question:', adHocQuestion);
    } else if (customPrompt) {
      logger.debug('Processing custom prompt');
      prompt = customPrompt;
    } else {
      logger.debug('Processing summary (default)');
      // Default  summary
  // Use summary from global prompts file if available
  // @ts-ignore - backward compatibility if old structure remains in questionsConfig
  const summary = globalPrompts?.prompts?.companySummary || questionsConfig?.prompts?.companySummary || '';
  // For summary we intentionally do NOT apply formattingPrompt guidance (applies only to questions)
  prompt = summary.trim();
    }

    logger.debug('Sending prompt to AnythingLLM:', { prompt });
    const result = await anythingLLM.sendMessage(workspaceSlug, prompt);
    logger.debug('AnythingLLM result received:', result);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error analyzing:', error);
    return NextResponse.json(
      { error: 'Failed to analyze' },
      { status: 500 }
    );
  }
}
