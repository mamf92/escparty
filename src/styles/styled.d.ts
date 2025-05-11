import "styled-components";

declare module "styled-components" {
    export interface DefaultTheme {
        colors: {
            magnolia: string;
            night: string;
            gray: string;
            amethyst: string;
            pinkLavender: string;
            correctGreen: string;
            incorrectRed: string;
            white: string;
            black: string;
            darkpurple: string;
            purple: string;
            brightpurple: string;
            deepblue: string;
            nightblue: string;
            accentmint: string;
            accentgreen: string;
            accentorange: string;
        };
        fonts: {
            body: string;
            heading: string;
        };
    }
}
