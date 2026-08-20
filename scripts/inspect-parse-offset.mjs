import fs from "node:fs";
const file = fs.readFileSync(new URL("../src/EventVerse.jsx", import.meta.url), "utf8");
const offset = 118490;
console.log(file.slice(Math.max(0, offset - 300), offset + 300));
