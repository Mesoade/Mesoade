import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <LegalPage title="Contact" updated={LEGAL.effectiveDate}>
      <h2>Report a square</h2>
      <p>
        The fastest route is the &quot;Report this square&quot; button on the
        square&apos;s own page — it goes straight to the moderation queue and
        needs no account. Otherwise, write to{' '}
        <a href={`mailto:${LEGAL.abuseEmail}`}>{LEGAL.abuseEmail}</a>.
      </p>

      <h2>Copyright</h2>
      <p>
        Takedown notices go to our designated agent — see the{' '}
        <a href="/dmca">copyright and DMCA page</a> for what a notice needs to
        contain.
      </p>

      <h2>Anything else</h2>
      <p>
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>
      <p>
        Two things we cannot help with, so that you do not have to write in to
        find out: we cannot change or remove a photo once it has been uploaded,
        and we cannot issue refunds. Both are disclosed before purchase and are
        deliberate parts of how this works.
      </p>

      <h2>Postal</h2>
      <p>
        {LEGAL.entityName}
        <br />
        {LEGAL.mailingAddress}
      </p>
    </LegalPage>
  )
}
