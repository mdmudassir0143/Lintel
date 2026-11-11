import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser } from '@/lib/server/session';
import { env } from '@/lib/env';

export const metadata = { title: 'Log in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/app');
  return <Suspense><AuthForm mode="login" providers={{ google: !!(env.googleClientId && env.googleClientSecret), shopify: !!(env.shopifyApiKey && env.shopifyApiSecret) }} /></Suspense>;
}
