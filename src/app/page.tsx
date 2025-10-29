import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to dashboard immediately
  redirect('/dashboard')
}
