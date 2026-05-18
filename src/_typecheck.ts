import { createClient } from "@supabase/supabase-js";

type SimpleDB = {
  public: {
    Tables: {
      orders: {
        Row: { id: string; status: string };
        Insert: { id?: string; status?: string };
        Update: { id?: string; status?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

const c = createClient<SimpleDB>("https://x.supabase.co", "key");

async function test() {
  const { data } = await c.from("orders").select("*").single();
  console.log(data?.status);
}
