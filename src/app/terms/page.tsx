import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { BRAND_NAME, SQUARE_PRICE_DISPLAY, UPLOAD_WINDOW_DAYS } from '@/lib/env'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL.effectiveDate}>
      <p>
        These terms govern your purchase and use of a square on {BRAND_NAME} (the
        &quot;Site&quot;), operated by {LEGAL.entityName} (&quot;we&quot;,
        &quot;us&quot;). By buying a square or uploading content you agree to
        them. Please read the first four sections carefully — they describe
        things that cannot be undone.
      </p>

      <h2>1. You must be 18 or over</h2>
      <p>
        You may only purchase a square if you are at least 18 years old. By
        completing a purchase you confirm that you are.
      </p>

      <h2>2. One square per person</h2>
      <p>
        Each person may purchase exactly one square. We do not sell squares in
        bulk, do not offer squares as gifts, and provide no way to purchase more
        than one. We enforce this using the email address given at checkout and
        payment signals from our payment processor. This enforcement is
        reasonable-effort rather than absolute; we may cancel, withhold, or
        refuse to assign a square where we believe this limit is being
        circumvented, and we may remove content associated with such attempts.
      </p>

      <h2>3. No refunds, ever</h2>
      <p>
        <strong>
          All sales are final. We do not provide refunds under any circumstances,
          for any reason.
        </strong>{' '}
        This includes, without limitation: changing your mind; never uploading
        an image; missing the {UPLOAD_WINDOW_DAYS}-day upload window; having your
        content removed for violating the content policy; disliking the position
        you were assigned; or the Site later ceasing to operate.
      </p>

      <h2>4. Your square is permanent, and so is your content</h2>
      <ul>
        <li>
          <strong>The square is yours from the moment you pay.</strong> It is
          assigned to you automatically and is never resold, released, reassigned,
          or returned to the pool, regardless of what you do or do not do with it.
        </li>
        <li>
          <strong>Content is locked once uploaded.</strong> After you upload an
          image (and any optional caption, category, or link) it cannot be
          edited, replaced, or taken down by you. There is no mechanism anywhere
          in the Site to change it, and we will not make changes on request.
        </li>
        <li>
          <strong>You have {UPLOAD_WINDOW_DAYS} days to upload.</strong> If the
          window closes with nothing uploaded, you keep the square permanently;
          it simply displays a neutral placeholder. No refund is given, and the
          square is not offered to anyone else.
        </li>
        <li>
          <strong>Removed content follows the same rule.</strong> If a moderator
          removes your content under the content policy, the square remains
          permanently yours, displays the same neutral placeholder, cannot be
          uploaded to again, and is not refunded.
        </li>
      </ul>

      <h2>5. Price and payment</h2>
      <p>
        A square costs {SQUARE_PRICE_DISPLAY} USD, charged once. There is no
        subscription, renewal, or recurring charge of any kind. Payments are
        processed by Stripe; we never receive or store your full card details.
      </p>

      <h2>6. Placement</h2>
      <p>
        Squares are assigned automatically, working outward from the centre of
        the grid. You cannot choose your position, request a specific square, or
        ask to be placed next to another square. The position you are assigned
        is final.
      </p>

      <h2>7. Content you upload</h2>
      <p>
        You keep ownership of the image you upload. You grant us a worldwide,
        non-exclusive, royalty-free, perpetual, irrevocable licence to host,
        store, reproduce, and publicly display it on the Site and in materials
        promoting the Site (including automatically generated share images). This
        licence is perpetual because the display itself is permanent — it is what
        you are buying.
      </p>
      <p>You confirm that:</p>
      <ul>
        <li>you own the image or otherwise have the right to publish it;</li>
        <li>
          publishing it does not infringe anyone&apos;s copyright, trademark,
          privacy, or other rights;
        </li>
        <li>
          it complies with our <a href="/content-policy">content policy</a>, which
          forms part of these terms.
        </li>
      </ul>

      <h2>8. Moderation</h2>
      <p>
        Content appears immediately and is reviewed afterwards. We may remove any
        content that violates the content policy, at our discretion and without
        notice. Automated scanning is used to detect child sexual abuse material;
        such material is removed and reported to the National Center for Missing
        &amp; Exploited Children as required by 18 U.S.C. § 2258A, and we will
        cooperate with law enforcement.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        Squares may include a link supplied by their owner. We do not endorse,
        verify, or take responsibility for linked destinations. Follow them at
        your own risk.
      </p>

      <h2>10. Availability, and no guarantee of perpetuity</h2>
      <p>
        We intend the Site and your square to remain online indefinitely and will
        make reasonable efforts to keep it that way. We cannot, however,
        guarantee that any website will exist forever, and we do not promise
        uninterrupted availability. &quot;Permanent&quot; describes our
        commitment not to remove, resell, or alter your square — not a warranty
        against every possible future event.
      </p>
      <p>
        The optional time-capsule message is a best-effort courtesy, not a
        guaranteed service. Email addresses change and providers disappear; we
        will try to deliver it, and cannot promise we will succeed.
      </p>

      <h2>11. Disclaimers and limitation of liability</h2>
      <p>
        The Site is provided &quot;as is&quot; and &quot;as available&quot;,
        without warranties of any kind, express or implied, to the fullest extent
        permitted by law. To the fullest extent permitted by law, our total
        liability to you for any claim relating to the Site or your square is
        limited to the amount you actually paid us, being{' '}
        {SQUARE_PRICE_DISPLAY}.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We may update these terms. Changes will never be applied retroactively in
        a way that removes your square or lets us alter or delete your content
        for reasons that were not grounds for removal when you uploaded it.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These terms are governed by the laws of {LEGAL.governingLaw}, without
        regard to its conflict-of-law rules.
      </p>

      <h2>14. Contact</h2>
      <p>
        {LEGAL.entityName}
        <br />
        {LEGAL.mailingAddress}
        <br />
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>
    </LegalPage>
  )
}
