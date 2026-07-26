'use client';

import { useState } from 'react';
import SplashScreen from './SplashScreen';

// Plays the intro splash once per app open (a hard load), on top of the app
// which loads underneath, then fades out to reveal it.
export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <>
      {children}
      {!done && <SplashScreen onDone={() => setDone(true)} />}
    </>
  );
}
