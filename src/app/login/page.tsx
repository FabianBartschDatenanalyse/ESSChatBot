"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthForm } from '@/components/auth-form';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-4">
        <Logo className="h-12 w-12 text-primary" />
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary">ESS Navigator</h1>
          <p className="text-muted-foreground">Your AI-powered guide to the European Social Survey</p>
        </div>
      </div>
      <AuthForm />
    </div>
  );
}
