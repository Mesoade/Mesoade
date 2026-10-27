import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { BRAND_NAME } from '@/lib/env'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Copyright & DMCA' }

export default function DmcaPage() {
  return (
    <LegalPage title="Copyright & DMCA" updated={LEGAL.effectiveDate}>
      <p>
        {BRAND_NAME} hosts images uploaded by its users. If you believe something
        here infringes your copyright, tell us and we will act on it.
      </p>

      <h2>Designated agent</h2>
      <p>
        {LEGAL.dmcaAgentName}
        <br />
        {LEGAL.entityName}
        <br />
        {LEGAL.mailingAddress}
        <br />
        <a href={`mailto:${LEGAL.dmcaEmail}`}>{LEGAL.dmcaEmail}</a>
      </p>

      <h2>Sending a takedown notice</h2>
      <p>
        To be effective under 17 U.S.C. § 512(c)(3), your notice must include all
        of the following:
      </p>
      <ol>
        <li>
          A physical or electronic signature of the copyright owner, or someone
          authorised to act on their behalf.
        </li>
        <li>Identification of the copyrighted work you say has been infringed.</li>
        <li>
          Identification of the material you say is infringing, with enough detail
          for us to locate it — the square&apos;s URL (for example{' '}
          <code>/s/482910</code>) is ideal.
        </li>
        <li>Your name, address, telephone number, and email address.</li>
        <li>
          A statement that you have a good-faith belief that the use is not
          authorised by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement, under penalty of perjury, that the information in your
          notice is accurate and that you are the copyright owner or authorised
          to act on their behalf.
        </li>
      </ol>

      <h2>What we do with it</h2>
      <p>
        We remove or disable access to material that is the subject of a valid
        notice. The square itself remains permanently owned by its buyer and
        displays the neutral placeholder; it is not resold, and no refund is
        given. We will notify the buyer and pass on your notice.
      </p>

      <h2>Counter-notices</h2>
      <p>
        If your content was removed and you believe that was a mistake or
        misidentification, you may send a counter-notice under 17 U.S.C. §
        512(g)(3) to the agent above. Note that restoring a square&apos;s content
        is subject to the same permanence rules as everything else on the Site,
        and we will explain what is and is not possible when we respond.
      </p>

      <h2>Repeat infringers</h2>
      <p>
        Because each person may only ever hold one square, our repeat-infringer
        policy is straightforward: we will not sell another square to someone
        whose content has been removed for infringement, and we will remove
        infringing content wherever we find it.
      </p>
    </LegalPage>
  )
}
