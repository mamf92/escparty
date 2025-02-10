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
        };
        fonts: {
            body: string;
            heading: string;
        };
    }
}
