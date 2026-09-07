'use client'

import { useId, useState } from 'react'

/**
 * The FAQ accordion.
 *
 * This replaces a bare <details>, which snaps open with no transition at all --
 * the single most jarring interaction on the page, and one that lands at
 * exactly the moment a visitor is deciding whether to spend money.
 *
 * The panel animates `grid-template-rows` from 0fr to 1fr, which resolves to
 * the content's natural height without measuring anything in JS. It is a layout
 * animation rather than a compositor one, but the subtree is a single
 * paragraph, and the alternative -- a keyframe on a hardcoded height -- is both
 * wrong at every viewport width and restarts from zero when interrupted. A
 * transition retargets from wherever it currently is, so double-tapping a
 * question reverses smoothly instead of jumping.
 *
 * Answers stay mounted when closed so the height transition has something to
 * resolve to, so `inert` keeps the clipped content out of the tab order and
 * away from screen readers.
 */

export function Faq({ children }: { children: React.ReactNode }) {
  return <div className="faq">{children}</div>
}

export function FaqItem({
  q,
  children,
}: {
  q: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div className="faq-item" data-open={open}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          className="faq-trigger"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{q}</span>
          <span className="faq-icon" aria-hidden="true" />
        </button>
      </h3>
      <div className="faq-panel" id={id} role="region" aria-labelledby={`${id}-trigger`}>
        <div className="faq-panel-inner" inert={!open}>
          <div className="faq-answer">{children}</div>
        </div>
      </div>
    </div>
  )
}
