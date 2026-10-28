import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Content Policy' }

export default function ContentPolicyPage() {
  return (
    <LegalPage title="Content Policy" updated={LEGAL.effectiveDate}>
      <p>
        One rule underneath all of these: the baseline you would expect on any
        mainstream platform. Nothing here is exotic, and nothing here is more
        permissive than the norm.
      </p>

      <h2>What you may not upload</h2>
      <ul>
        <li>
          <strong>Sexually explicit content.</strong> Nudity or sexual activity
          intended to titillate, and pornography of any kind.
        </li>
        <li>
          <strong>Illegal content.</strong> Anything unlawful, or that promotes
          or facilitates unlawful activity. Child sexual abuse material is
          removed automatically, reported to the National Center for Missing
          &amp; Exploited Children as required by law, and referred to law
          enforcement.
        </li>
        <li>
          <strong>Hate speech or harassment.</strong> Content attacking or
          demeaning people on the basis of race, ethnicity, national origin,
          religion, disability, sex, gender identity, sexual orientation, or
          age, and content targeting, threatening, or bullying any individual.
        </li>
        <li>
          <strong>Scams and fraudulent claims.</strong> Deceptive offers, phishing,
          fake giveaways, financial scams, or misleading claims about products,
          services, or affiliations.
        </li>
        <li>
          <strong>Doxxing and private information.</strong> Other people’s
          addresses, phone numbers, identification documents, financial details,
          or any private information published without consent.
        </li>
        <li>
          <strong>Infringing content.</strong> Images, logos, or marks you do not
          have the right to publish. See our{' '}
          <a href="/dmca">copyright and DMCA page</a>.
        </li>
        <li>
          <strong>Impersonation.</strong> Presenting yourself as another person
          or organisation in a way intended to deceive.
        </li>
      </ul>

      <h2>How this is enforced</h2>
      <p>
        Content appears immediately and is reviewed by a human moderator
        afterwards. Anyone can report a square using the “Report this
        square” button on its page, no account needed, and reports are how
        we find most problems.
      </p>
      <p>
        Child sexual abuse material is the one exception to after the fact
        review: every upload is scanned automatically for it before it can sit
        publicly for any length of time.
      </p>

      <h2>What happens if content is removed</h2>
      <p>
        The square stays permanently owned by the person who bought it. It shows
        the same neutral placeholder as a square that was never filled in. It
        cannot be uploaded to again, it is never resold or given to anyone else,
        and there is no refund. This is exactly the same outcome as never
        uploading anything.
      </p>

      <h2>Reporting something</h2>
      <p>
        Use the report button on any square, or write to{' '}
        <a href={`mailto:${LEGAL.abuseEmail}`}>{LEGAL.abuseEmail}</a>.
      </p>
    </LegalPage>
  )
}
