import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const [rootArg = ".", mode = "modified"] = process.argv.slice(2);
const root = resolve(rootArg);
const read = path => readFileSync(join(root, path), "utf8");
const fail = message => {
  console.error(`${mode.toUpperCase()} FAIL: ${message}`);
  process.exit(1);
};
const assert = (condition, message) => { if (!condition) fail(message); };

const index = read("index.html");

if (mode === "baseline") {
  const worksIds = (index.match(/id=["']works["']/g) || []).length;
  assert(index.includes("个人作品集 - 独立设计师"), "missing original title");
  assert(index.includes("你好，欢迎来到我的网站"), "missing original hero copy");
  assert(worksIds === 2, `expected original duplicate works sections, received ${worksIds}`);
  assert(!index.includes('id="edit-open"'), "baseline unexpectedly includes editor");
  console.log("BASELINE PASS: original static portfolio rendered; duplicate works sections=2; web editor=absent");
  process.exit(0);
}

assert(existsSync(join(root, "data/content.json")), "missing content data");
assert(existsSync(join(root, "styles.css")), "missing stylesheet");
assert(existsSync(join(root, "app.js")), "missing application script");

const app = read("app.js");
const styles = read("styles.css");
const content = JSON.parse(read("data/content.json"));
const ids = [...index.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);

assert(new Set(ids).size === ids.length, "HTML IDs must be unique");
assert(index.includes('id="edit-open"'), "missing web editor entry point");
assert(index.includes('id="work-grid"'), "missing work grid");
assert(index.includes('id="about-file"'), "missing about image upload");
assert(app.includes("data-project-file"), "missing project image upload");
assert(app.includes('contentPath: "data/content.json"'), "wrong GitHub content branch");
assert(app.includes('assets/uploads/'), "missing GitHub image upload branch");
assert(app.includes('method: "PUT"'), "missing GitHub persistence request");
assert(app.includes('openEditorForProject'), "missing card-specific editor action");
assert(styles.includes(".work-card:focus-visible"), "missing keyboard focus state for cards");
assert(!/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(`${index}\n${app}\n${styles}\n${JSON.stringify(content)}`), "repository contains a GitHub token");
assert(Array.isArray(content.projects) && content.projects.length >= 3, "portfolio needs at least three projects");
assert(styles.includes("@media (max-width: 560px)"), "missing mobile layout");
assert(styles.includes("prefers-reduced-motion"), "missing reduced motion support");

console.log(`MODIFIED PASS: unique HTML ids=${ids.length}; projects=${content.projects.length}; text editor=present; image upload=present; GitHub persistence=data/content.json+assets/uploads; embedded token=absent`);
