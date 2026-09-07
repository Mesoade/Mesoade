'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Fades a section up as it scrolls into view, once.
 *
 * Deliberately restrained: 14px of travel, no scale, no stagger longer than
 * 60ms between siblings. Scroll-triggered motion is decoration, so it must
 * never gate reading -- the element is fully visible before it finishes
 * moving, and anyone who scrolls fast enough to outrun the observer still
 * sees the content, because the fallback below is "visible".
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className,
  bare = false,
  ...rest
}: {
  children: React.ReactNode
  delay?: number
  as?: 'div' | 'section' | 'li' | 'p'
  className?: string
  /**
   * Skip the generic `.reveal` class and only stamp `data-visible`, so the
   * target can define its own hidden/visible states. Needed wherever the
   * element already animates something else -- `.reveal`'s transform would
   * otherwise sit at equal specificity with a hover lift and cancel it.
   */
  bare?: boolean
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // No IntersectionObserver, or motion is unwelcome: show it and stop.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={bare ? className : className ? `reveal ${className}` : 'reveal'}
      data-visible={visible}
      style={{ transitionDelay: visible && delay ? `${delay}ms` : undefined }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
