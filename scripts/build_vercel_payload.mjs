import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const include = ["package.json", "pnpm-lock.yaml", "index.html", "postcss.config.js", "tailwind.config.js", "src/EventVerse.jsx", "src/main.jsx", "src/styles.css"];
const files = include.map((relative) => ({
  file: relative,
  data: fs.readFileSync(path.join(root, relative), "utf8"),
  encoding: "utf-8",
}));
fs.writeFileSync("/tmp/eventverse-vercel-payload.json", JSON.stringify({
  name: "eventverse",
  target: "production",
  teamId: "team_sXMTjmKeCJWpAVwPERfsxu8Q",
  projectSettings: {
    framework: "vite",
    installCommand: "pnpm install --frozen-lockfile",
    buildCommand: "pnpm build",
    outputDirectory: "dist",
  },
  files,
}));
