"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Props {
  loggedInHref: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function OrderLink({ loggedInHref, className, style, children }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
  }, []);

  return (
    <Link href={loggedIn ? loggedInHref : "/signup"} className={className} style={style}>
      {children}
    </Link>
  );
}
