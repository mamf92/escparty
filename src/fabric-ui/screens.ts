import {
    COLUMN_X,
    DESIGN_HALF_WIDTH,
    LAYOUT,
    MARKER,
    MAX_FEATURES,
    OPTION_COUNT,
    STATE_ELEVATION,
} from './constants';
import type { FabricFeature, OptionState } from './types';

export type ScreenId = 'difficulty' | 'quiz' | 'results';

export const SCREEN_LABEL: Record<ScreenId, string> = {
    difficulty: 'Choose difficulty',
    quiz: 'Question',
    results: 'Results',
};

/** One DOM element sitting on one feature's plateau. */
export interface OverlayItem {
    key: string;
    /** Index into the feature array this element tracks. */
    slot: number;
    text: string;
    sub?: string;
    interactive: boolean;
    disabled?: boolean;
    /** Rendered as aria-pressed on an interactive item. */
    selected?: boolean;
    scale?: 'body' | 'lead';
    /**
     * Correctness, for renderers that cannot push a glyph through the sheet and
     * have to draw one instead.
     */
    marker?: 'correct' | 'wrong';
    /**
     * Where this sits in the surface's elevation ladder. The membrane reads a
     * continuous elevation off the feature; a shadow based renderer only has
     * discrete steps, so it reads this.
     */
    level?: 'high' | 'rest' | 'low';
    onSelect?: () => void;
    onHover?: (on: boolean) => void;
    onPress?: (on: boolean) => void;
}

export interface ScreenBuild {
    features: FabricFeature[];
    items: OverlayItem[];
}

/** Geometry and material values every screen shares, from the leva panel. */
export interface ScreenStyle {
    elevation: number;
    shapeWidth: number;
    shapeHeight: number;
    cornerRadius: number;
    falloff: number;
    tension: number;
    /** How dark the pressable plate on a control's flat top is. */
    topShade: number;
}

const NO_TINT: [number, number, number] = [0, 0, 0];

function blank(style: ScreenStyle): FabricFeature {
    return {
        active: false,
        shape: 'rect',
        center: [0, 0],
        halfSize: [style.shapeWidth, style.shapeHeight],
        cornerRadius: style.cornerRadius,
        elevation: 0,
        falloff: style.falloff,
        tension: style.tension,
        tint: NO_TINT,
        tintStrength: 0,
    };
}

/**
 * A pressable row.
 *
 * Every control carries the darker plate on its flat top. That plate, not
 * colour, is what says a surface can be pressed, which keeps the correct and
 * wrong markers as the only coloured things on the sheet.
 */
function control(
    style: ScreenStyle,
    y: number,
    state: OptionState,
    opts: Partial<FabricFeature> = {},
): FabricFeature {
    return {
        ...blank(style),
        active: true,
        center: [COLUMN_X, y],
        elevation: style.elevation * STATE_ELEVATION[state],
        topShade: style.topShade,
        ...opts,
    };
}

/** A raised panel that is not a control, so it gets no plate. */
function panel(
    style: ScreenStyle,
    y: number,
    halfSize: [number, number],
    radius: number,
    ratio: number,
): FabricFeature {
    return {
        ...blank(style),
        active: true,
        center: [COLUMN_X, y],
        halfSize,
        cornerRadius: radius,
        elevation: style.elevation * ratio,
    };
}

function markerBase(style: ScreenStyle): FabricFeature {
    return {
        ...blank(style),
        shape: 'check',
        halfSize: [...MARKER.halfSize],
        // For a glyph this carries the stroke half thickness, which is also the
        // radius of its round caps.
        cornerRadius: MARKER.halfSize[1] * MARKER.strokeRatio,
        elevation: style.elevation * MARKER.elevationRatio,
        falloff: style.falloff * MARKER.falloffRatio,
        tension: 1,
        tintStrength: 1,
        matte: true,
    };
}

/** x of the marker gutter, tracking the control width so it never collides. */
function markerX(style: ScreenStyle): number {
    return Math.max(
        COLUMN_X - style.shapeWidth - MARKER.gap - MARKER.halfSize[0],
        -(DESIGN_HALF_WIDTH - MARKER.halfSize[0] - 0.04),
    );
}

function pad(features: FabricFeature[], style: ScreenStyle): FabricFeature[] {
    while (features.length < MAX_FEATURES) features.push(blank(style));
    return features.slice(0, MAX_FEATURES);
}

// ---------------------------------------------------------------------------

export interface QuizScreenInput {
    style: ScreenStyle;
    question: string;
    options: string[];
    optionStates: OptionState[];
    submitState: OptionState;
    submitLabel: string;
    submitDisabled: boolean;
    correctIndex: number;
    wrongIndex: number;
    submitted: boolean;
    correctTint: [number, number, number];
    wrongTint: [number, number, number];
    onSelectOption: (i: number) => void;
    onHoverOption: (i: number, on: boolean) => void;
    onPressOption: (i: number, on: boolean) => void;
    onSubmit: () => void;
    onHoverSubmit: (on: boolean) => void;
    onPressSubmit: (on: boolean) => void;
}

export function buildQuizScreen(input: QuizScreenInput): ScreenBuild {
    const { style } = input;
    const features: FabricFeature[] = [];
    const items: OverlayItem[] = [];

    // The question panel is raised and plain. Raised so it reads as part of the
    // same family as the controls, plain so it never invites a press.
    features.push(panel(style, LAYOUT.questionCard.center[1], [...LAYOUT.questionCard.halfSize], LAYOUT.questionCard.radius, 0.75));
    items.push({ key: 'question', slot: 0, text: input.question, interactive: false, scale: 'lead' });

    for (let i = 0; i < OPTION_COUNT; i++) {
        const state = input.optionStates[i];
        const slot = features.length;
        features.push({
            ...control(style, LAYOUT.optionRowY[i], state),
            active: i < input.options.length,
            shake: state === 'incorrect',
        });
        if (i < input.options.length) {
            items.push({
                key: `option-${input.options[i]}`,
                slot,
                text: input.options[i],
                interactive: true,
                disabled: input.submitted,
                selected: state === 'selected',
                marker: state === 'correct' ? 'correct' : state === 'incorrect' ? 'wrong' : undefined,
                level: state === 'correct' ? 'high' : state === 'incorrect' ? 'low' : 'rest',
                onSelect: () => input.onSelectOption(i),
                onHover: (on) => input.onHoverOption(i, on),
                onPress: (on) => input.onPressOption(i, on),
            });
        }
    }

    const submitSlot = features.length;
    features.push(control(style, LAYOUT.submit.center[1], input.submitState, {
        halfSize: [...LAYOUT.submit.halfSize],
        cornerRadius: LAYOUT.submit.radius,
    }));
    items.push({
        key: 'submit',
        slot: submitSlot,
        text: input.submitLabel,
        interactive: true,
        disabled: input.submitDisabled,
        onSelect: input.onSubmit,
        onHover: input.onHoverSubmit,
        onPress: input.onPressSubmit,
    });

    const mx = markerX(style);
    features.push({
        ...markerBase(style),
        active: input.submitted && input.correctIndex >= 0,
        center: [mx, LAYOUT.optionRowY[Math.max(input.correctIndex, 0)]],
        tint: input.correctTint,
    });
    features.push({
        ...markerBase(style),
        shape: 'cross',
        active: input.submitted && input.wrongIndex >= 0,
        center: [mx, LAYOUT.optionRowY[Math.max(input.wrongIndex, 0)]],
        tint: input.wrongTint,
    });

    return { features: pad(features, style), items };
}

// ---------------------------------------------------------------------------

/** Real copy from src/pages/SelectDifficulty.tsx. */
export const DIFFICULTIES = [
    { id: 'easy', label: 'Easy', blurb: 'You know who Loreen is' },
    { id: 'medium', label: 'Medium', blurb: 'You know the year Alexander Rybak won ESC' },
    { id: 'hard', label: 'Hard', blurb: 'You know where ESC was held when Dana International won' },
] as const;

export interface DifficultyScreenInput {
    style: ScreenStyle;
    states: OptionState[];
    onSelect: (i: number) => void;
    onHover: (i: number, on: boolean) => void;
    onPress: (i: number, on: boolean) => void;
}

export function buildDifficultyScreen(input: DifficultyScreenInput): ScreenBuild {
    const { style } = input;
    const features: FabricFeature[] = [];
    const items: OverlayItem[] = [];

    features.push(panel(style, 1.42, [1.54, 0.3], LAYOUT.questionCard.radius, 0.75));
    items.push({ key: 'title', slot: 0, text: 'Choose your difficulty', interactive: false, scale: 'lead' });

    // Taller rows than the quiz, since each carries a label and a blurb.
    const rowY = [0.62, 0.0, -0.62];
    DIFFICULTIES.forEach((d, i) => {
        const slot = features.length;
        features.push(control(style, rowY[i], input.states[i], {
            halfSize: [style.shapeWidth, 0.27],
        }));
        items.push({
            key: `difficulty-${d.id}`,
            slot,
            text: d.label,
            sub: d.blurb,
            interactive: true,
            selected: input.states[i] === 'selected',
            onSelect: () => input.onSelect(i),
            onHover: (on) => input.onHover(i, on),
            onPress: (on) => input.onPress(i, on),
        });
    });

    return { features: pad(features, style), items };
}

// ---------------------------------------------------------------------------

export interface ResultsScreenInput {
    style: ScreenStyle;
    score: number;
    total: number;
    rows: Array<{ name: string; score: number }>;
    againState: OptionState;
    onAgain: () => void;
    onHoverAgain: (on: boolean) => void;
    onPressAgain: (on: boolean) => void;
}

/**
 * Ranked list.
 *
 * Rank is carried by elevation as well as by order, which is something a flat
 * list cannot do: first place literally stands highest out of the sheet. It is
 * also the clearest argument for the whole idea, since the ranking is readable
 * before you have read a single number.
 */
export function buildResultsScreen(input: ResultsScreenInput): ScreenBuild {
    const { style } = input;
    const features: FabricFeature[] = [];
    const items: OverlayItem[] = [];

    features.push(panel(style, 1.42, [1.54, 0.3], LAYOUT.questionCard.radius, 0.75));
    items.push({
        key: 'title',
        slot: 0,
        text: `You scored ${input.score} of ${input.total}`,
        interactive: false,
        scale: 'lead',
    });

    const rows = input.rows.slice(0, 4);
    const rowY = [0.66, 0.22, -0.22, -0.66];
    rows.forEach((row, i) => {
        const slot = features.length;
        // Elevation falls with rank, from well proud of the sheet down to
        // almost flush with it.
        const rankRatio = 1.5 - i * 0.38;
        features.push({
            ...blank(style),
            active: true,
            center: [COLUMN_X, rowY[i]],
            elevation: style.elevation * rankRatio,
        });
        items.push({
            key: `rank-${row.name}`,
            slot,
            text: `${i + 1}.  ${row.name}`,
            sub: `${row.score}`,
            interactive: false,
            level: i === 0 ? 'high' : i === rows.length - 1 ? 'low' : 'rest',
        });
    });

    const againSlot = features.length;
    features.push(control(style, LAYOUT.submit.center[1], input.againState, {
        halfSize: [...LAYOUT.submit.halfSize],
        cornerRadius: LAYOUT.submit.radius,
    }));
    items.push({
        key: 'again',
        slot: againSlot,
        text: 'Play again',
        interactive: true,
        onSelect: input.onAgain,
        onHover: input.onHoverAgain,
        onPress: input.onPressAgain,
    });

    return { features: pad(features, style), items };
}
