"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase, hasBrowserSupabase } from "./supabase-browser";

const NAME_KEY = "coderacer:name";
const AVATAR_KEY = "coderacer:avatar";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
}

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const m = (u.user_metadata || {}) as Record<string, string>;
  const name = (m.full_name || m.name || u.email?.split("@")[0] || "player").slice(0, 20);
  return { id: u.id, name, email: u.email ?? null, avatar: m.avatar_url || m.picture || null };
}

// Mirror the signed-in identity into localStorage so the rest of the game
// (nick prefill, presence avatar) picks it up without prop drilling.
function persist(u: AuthUser | null) {
  try {
    if (u) {
      localStorage.setItem(NAME_KEY, u.name);
      if (u.avatar) localStorage.setItem(AVATAR_KEY, u.avatar);
      else localStorage.removeItem(AVATAR_KEY);
    }
  } catch {}
}

export function useAuth() {
  const available = hasBrowserSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(available);

  useEffect(() => {
    if (!available) return;
    const supabase = getBrowserSupabase();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const au = toUser(data.session);
      setUser(au);
      persist(au);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const au = toUser(session);
      setUser(au);
      persist(au);
      setLoading(false);
      // Strip the ?code=... left by the OAuth redirect.
      if (event === "SIGNED_IN" && typeof window !== "undefined" && window.location.search.includes("code=")) {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [available]);

  const signInWithGoogle = useCallback(async () => {
    if (!available) return;
    const supabase = getBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  }, [available]);

  const signOut = useCallback(async () => {
    if (!available) return;
    await getBrowserSupabase().auth.signOut();
    try {
      localStorage.removeItem(AVATAR_KEY);
    } catch {}
    setUser(null);
  }, [available]);

  return { user, loading, available, signInWithGoogle, signOut };
}
