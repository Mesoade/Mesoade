import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { BRAND_NAME } from '@/lib/env'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL.effectiveDate}>
      <p>
        {BRAND_NAME} is run by {LEGAL.entityName}. This policy explains what we
        collect and what we do with it. The short version: we collect very
        little, because there are no accounts here, and we never sell any of it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your email address</strong>, captured at checkout. Used for your
          receipt, the link to your square, upload reminders, and — if you chose
          to leave one — your time-capsule note.
        </li>
        <li>
          <strong>The image you upload</strong>, plus any optional caption,
          category, and link. All of this is public by design and permanent.
        </li>
        <li>
          <strong>Your optional time-capsule note</strong>, stored until it has
          been sent back to you.
        </li>
        <li>
          <strong>Payment information</strong> is collected and processed by
          Stripe, not by us. We receive a confirmation, the amount, and a card
          fingerprint used solely to detect attempts to buy more than one square.
          We never see or store your card number.
        </li>
        <li>
          <strong>Abuse reports</strong>, including a one-way hash of the
          reporter&apos;s IP address. We store the hash, not the address itself,
          and use it only to detect repeated bogus reporting.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell, rent, or trade your personal information. Ever.</li>
        <li>We do not create accounts, passwords, or profiles.</li>
        <li>We do not run advertising trackers or third-party analytics pixels on the Site.</li>
        <li>We do not email you marketing you did not ask for.</li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        Only the service providers needed to run the Site: our payment processor
        (Stripe), our email provider, our database host, and our image storage
        provider. Each receives only what it needs to do its job. We may also
        disclose information where legally required, or as required by 18 U.S.C.
        § 2258A in the case of child sexual abuse material.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your square, its image, and its claim date are kept indefinitely — that
        permanence is the product. Your email address is kept for as long as the
        square exists, because it is the only way to reach you about it. Time
        capsule notes are deleted after their final scheduled delivery.
      </p>

      <h2>Your choices</h2>
      <p>
        You may ask us to stop sending you email at any time. Note that we cannot
        delete or alter a square&apos;s public content once uploaded — that is a
        deliberate, disclosed feature of the product, agreed to at purchase, and
        it is technically the same operation as the edit capability that does not
        exist. You may ask us to remove your email address from our records once
        your upload window has closed; we will confirm what that means for
        reaching you afterwards.
      </p>
      <p>
        Depending on where you live you may have additional rights over your
        personal data. Write to us and we will do our best to help.
      </p>

      <h2>Children</h2>
      <p>
        The Site is not intended for anyone under 18 and we do not knowingly
        collect information from children.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        <br />
        {LEGAL.entityName}, {LEGAL.mailingAddress}
      </p>
    </LegalPage>
  )
}
