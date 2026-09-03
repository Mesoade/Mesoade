import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import ClaimSuccess from '@/components/ClaimSuccess'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your square' }

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  return (
    <>
      <main className="wrap" style={{ maxWidth: 620, padding: '80px 20px' }}>
        <ClaimSuccess sessionId={sessionId ?? null} />
      </main>
      <Footer />
    </>
  )
}
