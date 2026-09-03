/**
 * Placeholders for the real-world details the site cannot know.
 *
 * Fill these in before launch. They are collected here so there is one file to
 * edit rather than five documents to search through, and so the site can render
 * an obvious warning while any of them is still unset.
 *
 * See docs/pre-launch-checklist.md.
 */
export const LEGAL = {
  entityName: process.env.LEGAL_ENTITY_NAME || '[LEGAL_ENTITY_NAME]',
  contactEmail: process.env.LEGAL_CONTACT_EMAIL || '[CONTACT_EMAIL]',
  abuseEmail: process.env.LEGAL_ABUSE_EMAIL || '[ABUSE_EMAIL]',
  dmcaAgentName: process.env.LEGAL_DMCA_AGENT || '[DMCA_AGENT_NAME]',
  dmcaEmail: process.env.LEGAL_DMCA_EMAIL || '[DMCA_EMAIL]',
  mailingAddress: process.env.LEGAL_MAILING_ADDRESS || '[MAILING_ADDRESS]',
  governingLaw: process.env.LEGAL_GOVERNING_LAW || '[STATE / JURISDICTION]',
  effectiveDate: process.env.LEGAL_EFFECTIVE_DATE || '[EFFECTIVE_DATE]',
} as const

export function hasUnfilledPlaceholders(): boolean {
  return Object.values(LEGAL).some((v) => v.startsWith('['))
}
