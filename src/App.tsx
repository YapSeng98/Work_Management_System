import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import "./styles/global.css";

import { supabase } from "./lib/supabase";
import { clearLegacyStorage } from "./lib/storage";
import { LoginView, SetupNotice } from "./components/LoginView";
import { Workspace } from "./Workspace";

clearLegacyStorage();

/** Auth gate: nothing is loaded from Supabase until the user has signed in. */
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <SetupNotice />;
  if (session === undefined) return null; // restoring a saved session
  if (!session) return <LoginView />;
  return <Workspace key={session.user.id} email={session.user.email ?? ""} onSignOut={() => supabase?.auth.signOut()} />;
}
