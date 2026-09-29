import type { ReactNode } from "react";
import styled from "styled-components";
import "../fabric-ui/lycra-surface.css";
import "../fabric-ui/calm.css";
import "../styles/calm-page.css";

/**
 * Page chrome for a screen on the Calm surface (see
 * `.claude/skills/escparty-calm/` and `docs/agent/theming.md`).
 *
 * Only the content goes on the surface: put controls in
 * `<div className="calm-ground"><div className="lycra-pane">...` as direct
 * children of the pane (the neighbour tug needs it). Titles, notes and
 * the back link stay outside it, as here.
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
      <Title>{title}</Title>
      {subtitle && <Subtitle>{subtitle}</Subtitle>}
    </Header>
    {children}
    {footer && <Footer>{footer}</Footer>}
  </Page>
);

/** The quiet underlined link Calm pages use for "back" and secondary moves. */
export const CalmLink = styled.button`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.85rem;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.pinkLavender};
`;

/** A note under or between panes: status, errors, hints. */
export const CalmNote = styled.p`
  margin: 0.5rem 0 0;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: center;
  color: ${({ theme }) => theme.colors.magnolia};
  opacity: 0.8;
`;

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
  width: 100%;
  padding: 0.5rem 0 1.5rem;
  color: ${({ theme }) => theme.colors.magnolia};
  font-family: ${({ theme }) => theme.fonts.body};
`;

const Header = styled.header`
  text-align: center;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.pinkLavender};
  margin: 0;
`;

const Subtitle = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.magnolia};
  opacity: 0.75;
`;

const Footer = styled.footer`
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
`;
