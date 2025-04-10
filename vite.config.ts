import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/trippy-vids/", // use your repo name here, with leading and trailing slash
  plugins: [react()],
});
