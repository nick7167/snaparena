"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Immersive mode.
 *
 * A match is not a route — it is state inside /ranked, /daily and /rooms/[code] — so the
 * shell cannot tell from the pathname whether the arena is on screen. This lets the
 * match announce itself so the navigation can get out of the way.
 *
 * Deliberately presentation-only: it carries a boolean and nothing else, and no game
 * logic reads it. Nothing here can affect a match.
 */

const ImmersiveContext = createContext<{
  immersive: boolean;
  setImmersive: (on: boolean) => void;
}>({ immersive: false, setImmersive: () => {} });

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  return (
    <ImmersiveContext.Provider value={{ immersive, setImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  );
}

export function useImmersiveState() {
  return useContext(ImmersiveContext).immersive;
}

/**
 * Called by whatever is currently rendering a match. Clears on unmount, so leaving a
 * match — by finishing, forfeiting or navigating — always restores the navigation.
 */
export function useImmersive(active = true) {
  const { setImmersive } = useContext(ImmersiveContext);

  useEffect(() => {
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
