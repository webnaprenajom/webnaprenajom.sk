import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl =
    env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "https://hcvxajdkmniwatdonseh.supabase.co";
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    env.VITE_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdnhhamRrbW5pd2F0ZG9uc2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzk3NzUsImV4cCI6MjA4ODY1NTc3NX0.TAo2anXqxmEl1F7jIha3tsjO2SyBUjDcxmQ_FCcp1rA";
  const supabaseProjectId =
    env.VITE_SUPABASE_PROJECT_ID ?? env.SUPABASE_PROJECT_ID ?? "hcvxajdkmniwatdonseh";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
