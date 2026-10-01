import type { ComponentPropsWithRef, ReactNode } from "react";
import styled from "styled-components";

/**
 * Page chrome for every screen (docs/design/design-system.md, "Page
 * anatomy"). The design system's stylesheet is loaded once, in main.tsx,
 * and the theme (Calm or Sparkle) comes from `data-theme` on <html>.
 *
 * Only the content goes on the surface: put controls in
 * `<Ground><Pane>...` (src/design) as direct children of the pane (the
 * neighbour tug needs it). Titles, notes and the back link stay outside
 * it, as here.
 */
export const CalmPage = ({ title, subtitle, children, footer, className }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra classes, e.g. `calm-screen` for the big-screen sizes. */
  className?: string;
}) => (
  <Page className={className ? `calm-page ${className}` : "calm-page"}>
    <Header>
      <h1 className="esc-title"><span className="esc-title-text">{title}</span></h1>
      {subtitle && <p className="esc-subtitle">{subtitle}</p>}
    </Header>
    {children}
    {footer && <Footer>{footer}</Footer>}
  </Page>
);

/** The quiet underlined link pages use for "back" and secondary moves. */
export const CalmLink = ({ className, type = "button", ...props }: ComponentPropsWithRef<"button">) => (
  <button type={type} className={className ? `esc-link ${className}` : "esc-link"} {...props} />
);

/** A note under or between panes: status, errors, hints. */
export const CalmNote = ({ className, ...props }: ComponentPropsWithRef<"p">) => (
  <p className={className ? `esc-note ${className}` : "esc-note"} {...props} />
);

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--esc-space-4);
  width: 100%;
  padding: var(--esc-space-2) 0 var(--esc-space-6);
  color: var(--esc-ink);
  font-family: var(--esc-font-body);
`;

const Header = styled.header`
  text-align: center;
`;

const Footer = styled.footer`
  display: flex;
  justify-content: center;
  gap: var(--esc-space-4);
  flex-wrap: wrap;
`;
