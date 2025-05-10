/**
 * Quiz Data Provider - handles loading quiz data across both development and production environments
 */
import { getAssetPath, isDevelopmentEnvironment } from "./pathUtils";

// Define quiz difficulty types for better type safety
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

// Interface for quiz questions
export interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    disabled?: boolean;
}

// Fallback quiz data in case nothing else loads
const fallbackQuizData: Record<QuizDifficulty, QuizQuestion[]> = {
    'easy': [
        {
            "id": 1,
            "question": "Which two countries are tied for the most Eurovision wins?",
            "options": ["Sweden and Ireland", "United Kingdom and France", "Sweden and Norway", "Ireland and Netherlands"],
            "correctAnswer": "Sweden and Ireland"
        },
        {
            "id": 2,
            "question": "What year did ABBA win Eurovision with 'Waterloo'?",
            "options": ["1969", "1974", "1982", "1990"],
            "correctAnswer": "1974"
        }
    ],
    'medium': [
        {
            "id": 11,
            "question": "In which year did Alexander Rybak win Eurovision with 'Fairytale'?",
            "options": ["2007", "2009", "2011", "2013"],
            "correctAnswer": "2009"
        },
        {
            "id": 12,
            "question": "Which country won Eurovision in 2010 with Lena's 'Satellite'?",
            "options": ["Germany", "Denmark", "Norway", "Sweden"],
            "correctAnswer": "Germany"
        }
    ],
    'hard': [
        {
            "id": 21,
            "question": "In which city did Dana International win Eurovision with 'Diva' in 1998?",
            "options": ["Birmingham", "Jerusalem", "Dublin", "Oslo"],
            "correctAnswer": "Birmingham"
        },
        {
            "id": 22,
            "question": "Which countries were declared joint winners of the Eurovision Song Contest in 1969 due to a four-way tie?",
            "options": [
                "Spain, United Kingdom, Netherlands, and France",
                "Spain, United Kingdom, Netherlands, and Germany",
                "Spain, United Kingdom, France, and Italy",
                "Spain, Netherlands, France, and Germany"
            ],
            "correctAnswer": "Spain, United Kingdom, Netherlands, and France"
        }
    ]
};

// Map difficulty levels to file names
const difficultyToFileName = {
    'easy': 'escBeginnerQuiz.json',
    'medium': 'escIntermediateQuiz.json',
    'hard': 'escAdvancedQuiz.json'
};

/**
 * Direct import the JSON files
 * This is the most reliable method in development mode
 */
const directImportQuizData = async (difficulty: QuizDifficulty): Promise<QuizQuestion[]> => {
    console.log(`🔍 Attempting direct import for ${difficulty} quiz`);

    try {
        let quizData;

        // Force type assertion to any to avoid TypeScript errors with dynamic imports
        let importPromise: Promise<any>;

        switch (difficulty) {
            case 'easy':
                importPromise = import('../data/escBeginnerQuiz.json');
                break;
            case 'medium':
                importPromise = import('../data/escIntermediateQuiz.json');
                break;
            case 'hard':
                importPromise = import('../data/escAdvancedQuiz.json');
                break;
            default:
                importPromise = import('../data/escBeginnerQuiz.json');
                break;
        }

        // Use Promise.race with a timeout to avoid hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Import timeout after 5 seconds')), 5000);
        });

        quizData = await Promise.race([importPromise, timeoutPromise]);

        if (quizData?.default && Array.isArray(quizData.default)) {
            console.log('✅ Successfully loaded quiz data via direct import:', quizData.default.length, 'questions');
            return quizData.default;
        } else {
            console.error('⚠️ Invalid data format from direct import:', quizData);
            throw new Error('Invalid data format from direct import');
        }
    } catch (error) {
        console.error('❌ Error during direct import:', error);
        throw error;
    }
};

/**
 * Fetch quiz data from public directory
 * This is the preferred method in production
 */
const fetchQuizData = async (difficulty: QuizDifficulty): Promise<QuizQuestion[]> => {
    const fileName = difficultyToFileName[difficulty];
    const publicPath = getAssetPath(`quizdata/${fileName}`);

    console.log(`🔍 Fetching quiz from public path: ${publicPath}`);

    try {
        // Use fetch with timeout to avoid hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(publicPath, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' } // Avoid caching issues
        });

        clearTimeout(timeoutId);

        console.log(`📋 Fetch response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('⚠️ Fetched data is not an array:', data);
            throw new Error('Fetched data is not in the expected array format');
        }

        console.log('✅ Successfully loaded quiz data from public directory:', data.length, 'questions');
        return data;
    } catch (error) {
        console.error('❌ Error fetching from public directory:', error);
        throw error;
    }
};

/**
 * Load quiz data for a specific difficulty level
 * Tries multiple methods to ensure compatibility across environments
 */
export const loadQuizData = async (difficulty: QuizDifficulty = 'easy'): Promise<QuizQuestion[]> => {
    console.log(`📚 Loading quiz data for difficulty: ${difficulty}`);
    console.log(`🌐 Current environment: ${isDevelopmentEnvironment() ? 'Development' : 'Production'}`);

    // Support both direct type and string conversion (for params from URL)
    const normalizedDifficulty = ((typeof difficulty === 'string' && !['easy', 'medium', 'hard'].includes(difficulty))
        ? 'easy'
        : difficulty) as QuizDifficulty;

    // Method priority depends on environment
    if (isDevelopmentEnvironment()) {
        try {
            // In development, try direct import first (most reliable)
            console.log('🔄 Development environment: Trying direct import first...');
            return await directImportQuizData(normalizedDifficulty);
        } catch (error) {
            console.warn('⚠️ Direct import failed in development, trying public fetch...');
            try {
                // Try public fetch as backup
                return await fetchQuizData(normalizedDifficulty);
            } catch (fetchError) {
                console.warn('⚠️ Public fetch also failed, using fallback data...');
                console.log('✅ Using fallback quiz data:', fallbackQuizData[normalizedDifficulty].length, 'questions');
                // Last resort - use hardcoded fallback data
                return fallbackQuizData[normalizedDifficulty];
            }
        }
    } else {
        // In production, try public fetch first (most reliable)
        try {
            console.log('🔄 Production environment: Trying public fetch first...');
            return await fetchQuizData(normalizedDifficulty);
        } catch (error) {
            console.warn('⚠️ Public fetch failed in production, trying direct import...');
            try {
                // Try direct import as backup
                return await directImportQuizData(normalizedDifficulty);
            } catch (importError) {
                console.warn('⚠️ Direct import also failed, using fallback data...');
                console.log('✅ Using fallback quiz data:', fallbackQuizData[normalizedDifficulty].length, 'questions');
                // Last resort - use hardcoded fallback data
                return fallbackQuizData[normalizedDifficulty];
            }
        }
    }
};