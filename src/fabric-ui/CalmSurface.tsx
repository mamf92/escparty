import './lycra-surface.css';
import './calm.css';
import { MARKER_COLOR } from './presets';
import type { OverlayItem } from './screens';

/**
 * The calm renderer.
 *
 * Same content model as the membrane, drawn with stacked box shadows instead of
 * a displaced height field. Every `OverlayItem` the screen builders already
 * produce is rendered here too, so the two modes cannot drift apart in what
 * they say, only in how they say it.
 *
 * Nothing here runs on the GPU, nothing tracks the viewport, and the vendored
 * stylesheet handles prefers-reduced-motion itself. That is the whole point of
 * this being the landing state.
 */

/** Same round capped glyphs the membrane extrudes, as flat SVG. */
function Glyph({ kind }: { kind: 'correct' | 'wrong' }) {
    const color = kind === 'correct' ? MARKER_COLOR.correct : MARKER_COLOR.wrong;
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {kind === 'correct' ? (
                <path d="M5 12.5 L10 17.5 L19 7" />
            ) : (
                <>
                    <path d="M6.5 6.5 L17.5 17.5" />
                    <path d="M17.5 6.5 L6.5 17.5" />
                </>
            )}
        </svg>
    );
}

function classes(item: OverlayItem): string {
    const out = ['lycra', 'is-block'];
    if (!item.interactive) out.push('is-static');
    if (item.selected) out.push('is-chosen');
    if (item.level === 'high') out.push('is-selected');
    if (item.level === 'high') out.push('is-high');
    if (item.level === 'low') out.push('is-low');
    if (item.marker) out.push('is-marked');
    return out.join(' ');
}

function Body({ item }: { item: OverlayItem }) {
    return (
        <>
            {item.marker && (
                <span className="calm-marker">
                    <Glyph kind={item.marker} />
                </span>
            )}
            <span>{item.text}</span>
            {item.sub && <span className="calm-sub">{item.sub}</span>}
        </>
    );
}

export default function CalmSurface({ items }: { items: OverlayItem[] }) {
    return (
        <div className="calm-ground">
            <div className="lycra-pane">
                {items.map((item) =>
                    item.interactive ? (
                        <button
                            key={item.key}
                            type="button"
                            className={classes(item)}
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
                            onFocus={() => item.onHover?.(true)}
                            onBlur={() => item.onHover?.(false)}
                        >
                            <Body item={item} />
                        </button>
                    ) : (
                        <div key={item.key} className={classes(item)}>
                            <Body item={item} />
                        </div>
                    ),
                )}
            </div>
        </div>
    );
}
