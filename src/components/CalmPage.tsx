import type { ComponentPropsWithRef, ReactNode } from "react";
import styled from "styled-components";
import { cx } from "../design/cx";

/**
 * Page chrome for every screen (docs/design/design-system.md, "Page
 * anatomy"). The design system's stylesheet is loaded once, in main.tsx,
 * and the theme (Calm or Sparkle) comes from `data-theme` on <html>.
 *
 * Only the content goes on the surface: put controls in
 * `<Ground><Pane>...` (src/design) as direct children of the pane (the
 * neighbour tug needs it). Titles, notes and the back link stay outside
 * it, as here.
 *
 * `actions` is the screen's next-step area (the pane with the black
 * button). It sits at the bottom of the screen, where a thumb rests: when
 * the page is shorter than the screen it sticks to the bottom, and when
 * it's longer it simply follows the content. The footer comes right under.
 */
export const CalmPage = ({ title, subtitle, children, actions, footer, className }: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** The next-step area, pinned to the bottom of a short page. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Extra classes, e.g. `calm-screen` for the big-screen sizes. */
  className?: string;
}) => (
  <Page className={cx("calm-page", className)}>
    <Header>
      <h1 className="esc-title"><span className="esc-title-text">{title}</span></h1>
      {subtitle && <p className="esc-subtitle">{subtitle}</p>}
    </Header>
    {children}
    {actions && <Actions className="calm-actions">{actions}</Actions>}
    {footer && <Footer>{footer}</Footer>}
  </Page>
);

/** The quiet underlined link pages use for "back" and secondary moves. */
export const CalmLink = ({ className, type = "button", ...props }: ComponentPropsWithRef<"button">) => (
  <button type={type} className={cx("esc-link", className)} {...props} />
);

/** A note under or between panes: status, errors, hints. */
export const CalmNote = ({ className, ...props }: ComponentPropsWithRef<"p">) => (
  <p className={cx("esc-note", className)} {...props} />
);

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--esc-space-4);
  /* Fills the screen, so the actions can sit at its bottom. */
  flex: 1 0 auto;
  width: 100%;
  padding: var(--esc-space-2) 0 var(--esc-space-6);
  color: var(--esc-ink);
  font-family: var(--esc-font-body);
`;

// Not a <header>: the app bar is the page's one banner landmark.
const Header = styled.div`
  text-align: center;
`;

// Takes the free space above it, so a short page leaves its actions at the
// bottom of the scroller; a long page has none to give.
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--esc-space-4);
  margin-top: auto;
`;

const Footer = styled.footer`
  display: flex;
  justify-content: center;
  gap: var(--esc-space-4);
  flex-wrap: wrap;
`;
