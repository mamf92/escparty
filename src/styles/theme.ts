import { DefaultTheme } from "styled-components";

/*
 * LEGACY. Colours and fonts are decided in src/design/tokens.css and read as
 * CSS variables (docs/design/design-system.md). These named colours remain
 * only for the screens not yet moved onto the design system; don't use them
 * in new code. The fonts already point at the tokens.
 */
export const theme: DefaultTheme = {
    colors: {
        magnolia: "#EEE8F0", // Lightest color
        night: "#141516", // Darkest color
        gray: "#59595D", // Medium gray
        amethyst: "#A56DC6", // Purple
        pinkLavender: "#D5B8E6", // Light pinkish-purple
        correctGreen: "#28a745",  // Green for correct answers
        incorrectRed: "#dc3545",    // Red for incorrect answers
        white: "#FFFFFF", // White
        black: "#000000", // Black
        darkpurple: "#73168C", // Dark purple
        purple: "#9F2CBF", // Light purple 
        brightpurple: "#C04BF2", // Bright purple
        deepblue: "#281259", // Deep blue
        nightblue: "#070926", // Night blue 
        accentmint: "#7AF5BF", // Mint accent
        accentgreen: "#007542", // Green accent
        accentorange: "#FF9F1D", // Orange accent

    },
    fonts: {
        body: "var(--esc-font-body)",
        heading: "var(--esc-font-display)",
    },
};
