import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Leva } from 'leva';
import styled, { css } from 'styled-components';
import * as THREE from 'three';
import { Link } from 'react-router-dom';
import { loadQuizData, type QuizQuestion } from '../utils/QuizDataProvider';
import CameraRig from './CameraRig';
import FabricSurface from './FabricSurface';
import { OPTION_COUNT } from './constants';
import { createOverlayBridge } from './overlayBridge';
import {
    DIFFICULTIES,
    buildDifficultyScreen,
    buildQuizScreen,
    buildResultsScreen,
    type OverlayItem,
    type ScreenId,
    type ScreenStyle,
} from './screens';
import type { OptionState } from './types';
import { useFabricControls } from './useFabricControls';
import { useParallax } from './useParallax';

const colorScratch = new THREE.Color();

/** Hex to the linear working space the shader lights in. */
function toLinear(hex: string): [number, number, number] {
    colorScratch.set(hex);
    return [colorScratch.r, colorScratch.g, colorScratch.b];
}

const SCREENS: ScreenId[] = ['difficulty', 'quiz', 'results'];

/** Stand in leaderboard, in the shape src/pages/QuizResults.tsx renders. */
const LEADERBOARD = [
    { name: 'Martin', score: 4 },
    { name: 'Ingrid', score: 3 },
    { name: 'Johan', score: 2 },
    { name: 'Elin', score: 1 },
];

export default function FabricQuizDemo() {
    const { values: controls, setSparkle } = useFabricControls();
    const { offset: parallax, needsPermission, requestMotion } = useParallax(
        controls.parallax,
        controls.parallaxStrength,
    );

    const [screen, setScreen] = useState<ScreenId>('quiz');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [difficulty, setDifficulty] = useState<number | null>(null);

    // Pointer and keyboard state, shared by every screen's controls.
    const [hovered, setHovered] = useState<string | null>(null);
    const [pressed, setPressed] = useState<string | null>(null);

    const bridge = useMemo(() => createOverlayBridge(), []);
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

    const style: ScreenStyle = useMemo(
        () => ({
            elevation: controls.elevation,
            shapeWidth: controls.shapeWidth,
            shapeHeight: controls.shapeHeight,
            cornerRadius: controls.cornerRadius,
            falloff: controls.falloff,
            tension: controls.tension,
            topShade: controls.topShade,
        }),
        [controls],
    );

    /** Shared state resolver, so every control on every screen behaves alike. */
    const controlState = useCallback(
        (key: string, isSelected: boolean): OptionState => {
            if (pressed === key) return 'pressed';
            if (isSelected) return 'selected';
            if (hovered === key) return 'hover';
            return 'idle';
        },
        [pressed, hovered],
    );

    const markerTints = useMemo(
        () => ({
            correct: toLinear(controls.accentColor),
            wrong: toLinear(controls.wrongColor),
        }),
        [controls.accentColor, controls.wrongColor],
    );

    const build = useMemo(() => {
        if (screen === 'difficulty') {
            return buildDifficultyScreen({
                style,
                states: DIFFICULTIES.map((d, i) => controlState(`difficulty-${d.id}`, difficulty === i)),
                onSelect: (i) => {
                    setDifficulty(i);
                    setScreen('quiz');
                },
                onHover: (i, on) => setHovered(on ? `difficulty-${DIFFICULTIES[i].id}` : null),
                onPress: (i, on) => setPressed(on ? `difficulty-${DIFFICULTIES[i].id}` : null),
            });
        }

        if (screen === 'results') {
            return buildResultsScreen({
                style,
                score,
                total: questions.length || 10,
                rows: LEADERBOARD,
                againState: controlState('again', false),
                onAgain: () => {
                    setScore(0);
                    setIndex(0);
                    setSelected(null);
                    setSubmitted(false);
                    setScreen('difficulty');
                },
                onHoverAgain: (on) => setHovered(on ? 'again' : null),
                onPressAgain: (on) => setPressed(on ? 'again' : null),
            });
        }

        const optionStates: OptionState[] = Array.from({ length: OPTION_COUNT }, (_, i) => {
            const option = options[i];
            if (option === undefined) return 'idle';
            if (submitted) {
                if (option === question?.correctAnswer) return 'correct';
                if (option === selected) return 'incorrect';
                return 'idle';
            }
            return controlState(`option-${option}`, selected === option);
        });

        return buildQuizScreen({
            style,
            question: question?.question ?? 'Loading quiz...',
            options,
            optionStates,
            submitState: controlState('submit', false),
            submitLabel: submitted ? 'Next question' : 'Submit answer',
            submitDisabled: !submitted && !selected,
            correctIndex: options.findIndex((o) => o === question?.correctAnswer),
            wrongIndex: options.findIndex((o) => o === selected && o !== question?.correctAnswer),
            submitted,
            correctTint: markerTints.correct,
            wrongTint: markerTints.wrong,
            onSelectOption: (i) => {
                if (!submitted) setSelected(options[i]);
            },
            onHoverOption: (i, on) => setHovered(on ? `option-${options[i]}` : null),
            onPressOption: (i, on) => setPressed(on ? `option-${options[i]}` : null),
            onSubmit: () => {
                if (submitted) {
                    setSubmitted(false);
                    setSelected(null);
                    if (index + 1 >= questions.length) {
                        setScreen('results');
                    } else {
                        setIndex(index + 1);
                    }
                    return;
                }
                if (!selected) return;
                if (selected === question?.correctAnswer) setScore((prev) => prev + 1);
                setSubmitted(true);
            },
            onHoverSubmit: (on) => setHovered(on ? 'submit' : null),
            onPressSubmit: (on) => setPressed(on ? 'submit' : null),
        });
    }, [
        screen, style, controlState, difficulty, score, questions.length,
        options, submitted, question, selected, markerTints, index,
    ]);

    const registerElement = useCallback(
        (slot: number) => (el: HTMLElement | null) => {
            bridge.elements[slot] = el;
        },
        [bridge],
    );

    // Slots not used by the current screen must not keep a stale element, or the
    // surface would go on writing transforms onto something that has unmounted.
    useEffect(() => {
        const used = new Set(build.items.map((item) => item.slot));
        bridge.elements.forEach((_, i) => {
            if (!used.has(i)) bridge.elements[i] = null;
        });
    }, [build, bridge]);

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
            <Leva titleBar={{ title: 'Fabric UI' }} collapsed />

            <Header>
                <Title>Fabric UI</Title>
                <Subtitle>
                    Three ESCParty screens rebuilt as shapes pushing through a stretched
                    membrane. Elevation is the affordance: raised with a darker plate is a
                    control, raised and plain is information, pressed in is chosen.
                </Subtitle>
            </Header>

            <Toolbar>
                <ScreenTabs role="tablist" aria-label="Demo screen">
                    {SCREENS.map((id) => (
                        <Tab
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={screen === id}
                            $active={screen === id}
                            onClick={() => setScreen(id)}
                        >
                            {id}
                        </Tab>
                    ))}
                </ScreenTabs>

                <SparkleToggle
                    type="button"
                    role="switch"
                    aria-checked={controls.sparkle}
                    $on={controls.sparkle}
                    onClick={() => setSparkle(!controls.sparkle)}
                >
                    {controls.sparkle ? 'Calm it down' : 'Make it sparkle'}
                </SparkleToggle>
            </Toolbar>

            <Stage ref={stageRef}>
                <Canvas
                    orthographic
                    dpr={[1, 1.75]}
                    gl={{ antialias: true }}
                    camera={{ position: [0, 3, 7], zoom: 140, near: 0.1, far: 40 }}
                >
                    <CameraRig
                        tilt={controls.cameraTilt}
                        yaw={controls.cameraYaw}
                        parallax={parallax}
                    />
                    <FabricSurface features={build.features} controls={controls} bridge={bridge} />
                </Canvas>

                <Overlay>
                    {build.items.map((item) => (
                        <OverlayElement
                            key={item.key}
                            item={item}
                            register={registerElement(item.slot)}
                        />
                    ))}
                </Overlay>
            </Stage>

            <Footer>
                {needsPermission && controls.parallax && (
                    <MotionButton type="button" onClick={requestMotion}>
                        Enable motion parallax
                    </MotionButton>
                )}
                <BackLink to="/">Back to ESCParty</BackLink>
            </Footer>
        </Page>
    );
}

interface OverlayElementProps {
    item: OverlayItem;
    register: (el: HTMLElement | null) => void;
}

function OverlayElement({ item, register }: OverlayElementProps) {
    if (!item.interactive) {
        return (
            <PlateauLabel ref={register} $lead={item.scale === 'lead'}>
                <span>{item.text}</span>
                {item.sub && <Sub>{item.sub}</Sub>}
            </PlateauLabel>
        );
    }
    return (
        <PlateauButton
            ref={register}
            type="button"
            disabled={item.disabled}
            aria-pressed={item.selected}
            onClick={item.onSelect}
            onPointerEnter={() => item.onHover?.(true)}
            onPointerLeave={() => {
                item.onHover?.(false);
                item.onPress?.(false);
            }}
            onPointerDown={() => item.onPress?.(true)}
            onPointerUp={() => item.onPress?.(false)}
            onPointerCancel={() => item.onPress?.(false)}
            onFocus={() => item.onHover?.(true)}
            onBlur={() => item.onHover?.(false)}
            onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') item.onPress?.(true);
            }}
            onKeyUp={() => item.onPress?.(false)}
        >
            <span>{item.text}</span>
            {item.sub && <Sub>{item.sub}</Sub>}
        </PlateauButton>
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
  max-width: 38rem;
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

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
`;

const ScreenTabs = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgba(213, 184, 230, 0.12);
`;

const Tab = styled.button<{ $active: boolean }>`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.35rem 0.85rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  background: ${({ $active, theme }) => ($active ? theme.colors.amethyst : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.nightblue : theme.colors.pinkLavender)};
`;

const SparkleToggle = styled.button<{ $on: boolean }>`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  border: 0.0625rem solid ${({ theme }) => theme.colors.accentorange}; /* 1px */
  background: ${({ $on, theme }) => ($on ? theme.colors.accentorange : 'transparent')};
  color: ${({ $on, theme }) => ($on ? theme.colors.nightblue : theme.colors.accentorange)};
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
 * Every overlay element is placed by the surface each frame with a full affine
 * matrix, so it starts at the stage origin with its own top left as the
 * transform origin and is moved entirely by that matrix.
 */
const plateau = css`
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  text-align: center;
  padding: 0 0.9rem;
  transform-origin: 0 0;
  will-change: transform;
  color: ${({ theme }) => theme.colors.white};
  text-shadow: 0 0.0625rem 0.1875rem rgba(7, 9, 38, 0.65); /* 1px 3px */
`;

const PlateauLabel = styled.div<{ $lead: boolean }>`
  ${plateau}
  font-family: ${({ theme, $lead }) => ($lead ? theme.fonts.heading : theme.fonts.body)};
  font-size: ${({ $lead }) => ($lead ? '0.95rem' : '0.85rem')};
  font-weight: 700;
  line-height: 1.25;
`;

const PlateauButton = styled.button`
  ${plateau}
  pointer-events: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.2;

  &:disabled {
    cursor: default;
  }

  &:focus-visible {
    outline: 0.1875rem solid ${({ theme }) => theme.colors.accentmint}; /* 3px */
    outline-offset: 0.25rem;
    border-radius: 0.5rem;
  }
`;

const Sub = styled.span`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.8;
`;

const Footer = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const MotionButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 0.0625rem solid ${({ theme }) => theme.colors.amethyst}; /* 1px */
  background: transparent;
  color: ${({ theme }) => theme.colors.pinkLavender};
  cursor: pointer;
`;

const BackLink = styled(Link)`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.pinkLavender};
`;
