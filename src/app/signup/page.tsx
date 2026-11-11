import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser } from '@/lib/server/session';

export const metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await currentUser()) redirect('/app');
  return <Suspense><AuthForm mode="signup" /></Suspense>;
}
