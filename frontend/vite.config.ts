import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" }, // amazon-cognito-identity-js espera `global`
  server: { port: 5173, host: true },
});
