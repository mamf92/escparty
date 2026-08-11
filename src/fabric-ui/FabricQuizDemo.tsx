import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Leva } from 'leva';
import styled from 'styled-components';
import * as THREE from 'three';
import { Link } from 'react-router-dom';
import { loadQuizData, type QuizQuestion } from '../utils/QuizDataProvider';
import CameraRig from './CameraRig';
import FabricSurface, { type PointerState } from './FabricSurface';
import {
    CARD_ELEVATION_RATIO,
    COLUMN_X,
    DESIGN_HALF_WIDTH,
    LAYOUT,
    MARKER,
    MAX_FEATURES,
    OPTION_COUNT,
    POINTER_DIMPLE_RADIUS,
    POINTER_DIMPLE_RATIO,
    SLOT,
    STATE_ELEVATION,
    TRAY_ELEVATION_RATIO,
} from './constants';
import { createOverlayBridge } from './overlayBridge';
import type { FabricFeature, OptionState } from './types';
import { useFabricControls } from './useFabricControls';

const colorScratch = new THREE.Color();

/** Hex to the linear working space the shader lights in. */
function toLinear(hex: string): [number, number, number] {
    colorScratch.set(hex);
    return [colorScratch.r, colorScratch.g, colorScratch.b];
}

const NO_TINT: [number, number, number] = [0, 0, 0];

export default function FabricQuizDemo() {
    const controls = useFabricControls();

    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [hovered, setHovered] = useState<number | null>(null);
    const [focused, setFocused] = useState<number | null>(null);
    const [pressed, setPressed] = useState<number | null>(null);
    const [submitPressed, setSubmitPressed] = useState(false);
    const [submitActive, setSubmitActive] = useState(false);
    const [score, setScore] = useState(0);

    const bridge = useMemo(() => createOverlayBridge(), []);
    const pointer = useRef<PointerState>({ inside: false, down: false, px: 0, py: 0 });
    const stageRef = useRef<HTMLDivElement>(null);

    // Real content, loaded through the app's own provider rather than copied.
    useEffect(() => {
        let cancelled = false;
        loadQuizData('easy')
            .then((data) => {
                if (cancelled) return;
                setQuestions(data.filter((q) => !q.disabled));
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setLoadError(error instanceof Error ? error.message : 'Unknown error');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const question = questions[index];
    const options = useMemo(
        () => (question?.options ?? []).slice(0, OPTION_COUNT),
        [question],
    );

    const optionStates = useMemo<OptionState[]>(() => {
        return Array.from({ length: OPTION_COUNT }, (_, i) => {
            const option = options[i];
            if (option === undefined) return 'idle';
            if (submitted) {
                if (option === question?.correctAnswer) return 'correct';
                if (option === selected) return 'incorrect';
                return 'idle';
            }
            if (pressed === i) return 'pressed';
            if (selected === option) return 'selected';
            if (hovered === i || focused === i) return 'hover';
            return 'idle';
        });
    }, [options, submitted, question, selected, pressed, hovered, focused]);

    const markerTints = useMemo(
        () => ({
            correct: toLinear(controls.accentColor),
            wrong: toLinear(controls.wrongColor),
        }),
        [controls.accentColor, controls.wrongColor],
    );

    const correctIndex = options.findIndex((o) => o === question?.correctAnswer);
    const wrongIndex = options.findIndex((o) => o === selected && o !== question?.correctAnswer);

    const features = useMemo<FabricFeature[]>(() => {
        const {
            elevation,
            shapeWidth,
            shapeHeight,
            cornerRadius,
            falloff,
            tension,
            showTray,
        } = controls;

        const shared = { falloff, tension, cornerRadius };
        const list: FabricFeature[] = new Array(MAX_FEATURES);

        list[SLOT.questionCard] = {
            ...shared,
            active: true,
            shape: 'rect',
            center: [...LAYOUT.questionCard.center],
            halfSize: [...LAYOUT.questionCard.halfSize],
            cornerRadius: LAYOUT.questionCard.radius,
            elevation: elevation * CARD_ELEVATION_RATIO,
            tint: NO_TINT,
            tintStrength: 0,
        };

        list[SLOT.tray] = {
            ...shared,
            active: showTray,
            shape: 'rect',
            center: [...LAYOUT.tray.center],
            halfSize: [...LAYOUT.tray.halfSize],
            cornerRadius: LAYOUT.tray.radius,
            elevation: elevation * TRAY_ELEVATION_RATIO,
            tint: NO_TINT,
            tintStrength: 0,
        };

        // No tint on an option, in any state. Whether it is raised or pressed is
        // the only thing its surface says, and a colour shift competes with
        // that: a lighter patch reads as nearer, which fights the press.
        for (let i = 0; i < OPTION_COUNT; i++) {
            list[SLOT.option + i] = {
                ...shared,
                active: i < options.length,
                shape: 'rect',
                center: [COLUMN_X, LAYOUT.optionRowY[i]],
                halfSize: [shapeWidth, shapeHeight],
                elevation: elevation * STATE_ELEVATION[optionStates[i]],
                tint: NO_TINT,
                tintStrength: 0,
            };
        }

        const submitState: OptionState = submitPressed
            ? 'pressed'
            : submitActive
                ? 'hover'
                : 'idle';

        list[SLOT.submit] = {
            ...shared,
            active: true,
            shape: 'rect',
            center: [...LAYOUT.submit.center],
            halfSize: [...LAYOUT.submit.halfSize],
            cornerRadius: LAYOUT.submit.radius,
            elevation: elevation * STATE_ELEVATION[submitState],
            tint: NO_TINT,
            tintStrength: 0,
        };

        list[SLOT.pointer] = {
            ...shared,
            active: true,
            shape: 'circle',
            additive: true,
            center: [0, 0],
            halfSize: [POINTER_DIMPLE_RADIUS, POINTER_DIMPLE_RADIUS],
            cornerRadius: 0,
            elevation: elevation * POINTER_DIMPLE_RATIO,
            falloff: falloff * 1.6,
            tint: NO_TINT,
            tintStrength: 0,
        };

        // Marker glyphs. Hard edged, untextured and standing proud of the
        // options, in the gutter the content column leaves free. Their x tracks
        // the option width so widening the options never collides with them.
        const markerX = Math.max(
            COLUMN_X - shapeWidth - MARKER.gap - MARKER.halfSize[0],
            -(DESIGN_HALF_WIDTH - MARKER.halfSize[0] - 0.04),
        );
        const marker = {
            ...shared,
            shape: 'arrow' as const,
            halfSize: [...MARKER.halfSize] as [number, number],
            // Rounded to match the rest of the UI, but never more than the glyph
            // can carry without its strokes closing up.
            cornerRadius: Math.min(cornerRadius, MARKER.halfSize[1] * 0.3),
            elevation: elevation * MARKER.elevationRatio,
            falloff: falloff * MARKER.falloffRatio,
            tension: 1,
            tintStrength: 1,
            matte: true,
        };

        list[SLOT.correctMarker] = {
            ...marker,
            active: submitted && correctIndex >= 0,
            center: [markerX, LAYOUT.optionRowY[Math.max(correctIndex, 0)]],
            tint: markerTints.correct,
        };

        list[SLOT.wrongMarker] = {
            ...marker,
            shape: 'cross',
            active: submitted && wrongIndex >= 0,
            center: [markerX, LAYOUT.optionRowY[Math.max(wrongIndex, 0)]],
            tint: markerTints.wrong,
        };

        return list;
    }, [
        controls,
        optionStates,
        options.length,
        submitPressed,
        submitActive,
        markerTints,
        submitted,
        correctIndex,
        wrongIndex,
    ]);

    const registerElement = useCallback(
        (slot: number) => (el: HTMLElement | null) => {
            bridge.elements[slot] = el;
        },
        [bridge],
    );

    const updatePointer = useCallback((event: React.PointerEvent) => {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        pointer.current.px = event.clientX - rect.left;
        pointer.current.py = event.clientY - rect.top;
        pointer.current.inside = true;
    }, []);

    const handleSelect = useCallback(
        (option: string) => {
            if (submitted) return;
            setSelected(option);
        },
        [submitted],
    );

    const handleSubmit = useCallback(() => {
        if (submitted) {
            setSubmitted(false);
            setSelected(null);
            setPressed(null);
            setIndex((prev) => (questions.length ? (prev + 1) % questions.length : 0));
            return;
        }
        if (!selected) return;
        if (selected === question?.correctAnswer) setScore((prev) => prev + 1);
        setSubmitted(true);
    }, [submitted, selected, question, questions.length]);

    const optionKeyDown = useCallback((i: number) => (event: React.KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') setPressed(i);
    }, []);

    if (loadError) {
        return (
            <Page>
                <Header>
                    <Title>Fabric UI</Title>
                    <Subtitle>Could not load the quiz data: {loadError}</Subtitle>
                </Header>
            </Page>
        );
    }

    return (
        <Page>
            <Leva titleBar={{ title: 'Fabric UI' }} collapsed={false} />

            <Header>
                <Title>Fabric UI</Title>
                <Subtitle>
                    The answer option list from the ESCParty quiz, rebuilt as shapes pushing
                    through a stretched membrane. Question {index + 1} of {questions.length || '...'},
                    score {score}.
                </Subtitle>
            </Header>

            <Stage
                ref={stageRef}
                onPointerMove={updatePointer}
                onPointerDown={(event) => {
                    updatePointer(event);
                    pointer.current.down = true;
                }}
                onPointerUp={() => {
                    pointer.current.down = false;
                }}
                onPointerLeave={() => {
                    pointer.current.inside = false;
                    pointer.current.down = false;
                    setHovered(null);
                }}
            >
                <Canvas
                    orthographic
                    dpr={[1, 1.75]}
                    gl={{ antialias: true }}
                    camera={{ position: [0, 3, 7], zoom: 140, near: 0.1, far: 40 }}
                >
                    <CameraRig tilt={controls.cameraTilt} yaw={controls.cameraYaw} />
                    <FabricSurface
                        features={features}
                        optionStates={optionStates}
                        controls={controls}
                        bridge={bridge}
                        pointer={pointer}
                    />
                </Canvas>

                <Overlay>
                    <QuestionLabel ref={registerElement(SLOT.questionCard)}>
                        {question?.question ?? 'Loading quiz...'}
                    </QuestionLabel>

                    <div role="group" aria-labelledby="fabric-question-text">
                        {options.map((option, i) => (
                            <OptionButton
                                key={option}
                                ref={registerElement(SLOT.option + i)}
                                type="button"
                                disabled={submitted}
                                aria-pressed={selected === option}
                                onClick={() => handleSelect(option)}
                                onPointerEnter={() => setHovered(i)}
                                onPointerLeave={() => {
                                    setHovered((prev) => (prev === i ? null : prev));
                                    setPressed((prev) => (prev === i ? null : prev));
                                }}
                                onPointerDown={() => setPressed(i)}
                                onPointerUp={() => setPressed(null)}
                                onPointerCancel={() => setPressed(null)}
                                onFocus={() => setFocused(i)}
                                onBlur={() => setFocused((prev) => (prev === i ? null : prev))}
                                onKeyDown={optionKeyDown(i)}
                                onKeyUp={() => setPressed(null)}
                            >
                                {option}
                            </OptionButton>
                        ))}
                    </div>

                    <SubmitButton
                        ref={registerElement(SLOT.submit)}
                        type="button"
                        disabled={!submitted && !selected}
                        onClick={handleSubmit}
                        onPointerEnter={() => setSubmitActive(true)}
                        onPointerLeave={() => {
                            setSubmitActive(false);
                            setSubmitPressed(false);
                        }}
                        onPointerDown={() => setSubmitPressed(true)}
                        onPointerUp={() => setSubmitPressed(false)}
                        onFocus={() => setSubmitActive(true)}
                        onBlur={() => setSubmitActive(false)}
                        onKeyDown={(event) => {
                            if (event.key === ' ' || event.key === 'Enter') setSubmitPressed(true);
                        }}
                        onKeyUp={() => setSubmitPressed(false)}
                    >
                        {submitted ? 'Next question' : 'Submit answer'}
                    </SubmitButton>
                </Overlay>
            </Stage>

            <Footer>
                <StateRow aria-live="polite">
                    {optionStates.slice(0, options.length).map((state, i) => (
                        <StateChip key={options[i]} $state={state}>
                            {state}
                        </StateChip>
                    ))}
                </StateRow>
                <BackLink to="/">Back to ESCParty</BackLink>
            </Footer>
        </Page>
    );
}

// Styled Components

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 1rem 2.5rem;
  background: ${({ theme }) => theme.colors.nightblue};
  color: ${({ theme }) => theme.colors.magnolia};
  font-family: ${({ theme }) => theme.fonts.body};
`;

const Header = styled.header`
  max-width: 36rem;
  text-align: center;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.pinkLavender};
`;

const Subtitle = styled.p`
  margin-top: 0.5rem;
  font-size: 0.85rem;
  line-height: 1.5;
  opacity: 0.75;
`;

const Stage = styled.div`
  position: relative;
  width: min(92vw, 35rem); /* 560px */
  aspect-ratio: 1 / 1;
  touch-action: none;

  canvas {
    display: block;
    border-radius: 1rem;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

/**
 * Every overlay element is placed by the surface each frame, so it starts at
 * the stage origin and is moved purely by transform.
 */
const Plateau = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 0.75rem;
  will-change: transform;
`;

const QuestionLabel = styled(Plateau).attrs({ id: 'fabric-question-text', role: 'heading', 'aria-level': 2 })`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.white};
  text-shadow: 0 1px 3px rgba(7, 9, 38, 0.55);
`;

const fabricButton = `
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 0.9rem;
  pointer-events: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  will-change: transform;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(7, 9, 38, 0.6);

  &:focus-visible {
    outline: 0.1875rem solid #7af5bf; /* 3px */
    outline-offset: 0.25rem;
    border-radius: 0.5rem;
  }
`;

const OptionButton = styled.button`
  ${fabricButton}
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.85rem;
  line-height: 1.2;

  &:disabled {
    cursor: default;
  }
`;

const SubmitButton = styled.button`
  ${fabricButton}
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 0.9rem;
  letter-spacing: 0.04em;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const Footer = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const StateRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
`;

const STATE_CHIP_COLOR: Record<OptionState, string> = {
    idle: '#59595D',
    hover: '#A56DC6',
    pressed: '#73168C',
    selected: '#D5B8E6',
    correct: '#7AF5BF',
    incorrect: '#dc3545',
};

const StateChip = styled.span<{ $state: OptionState }>`
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  color: ${({ theme }) => theme.colors.nightblue};
  background: ${({ $state }) => STATE_CHIP_COLOR[$state]};
`;

const BackLink = styled(Link)`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.pinkLavender};
`;
