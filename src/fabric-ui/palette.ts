/**
 * The /fabric-ui demo's own palette: the named colours the app used before
 * the design system (#166, retired in #179), kept here so the demo still
 * looks as it did. This module is a self-contained proof of concept; live
 * screens read colours from src/design/tokens.css instead, and nothing
 * outside src/fabric-ui may import this (src/test/designGuard.test.ts
 * fails on an import from anywhere else).
 */
export const palette = {
    magnolia: '#EEE8F0',
    amethyst: '#A56DC6',
    pinkLavender: '#D5B8E6',
    correctGreen: '#28a745',
    white: '#FFFFFF',
    brightpurple: '#C04BF2',
    nightblue: '#070926',
    accentmint: '#7AF5BF',
    accentorange: '#FF9F1D',
} as const;

/** The demo's fonts: the app's font tokens, which are set on :root. */
export const fonts = {
    body: 'var(--esc-font-body)',
    heading: 'var(--esc-font-display)',
} as const;
