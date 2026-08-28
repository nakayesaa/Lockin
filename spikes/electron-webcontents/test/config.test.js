const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");

test("remote content uses secure WebContentsView defaults", () => {
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /new WebContentsView/);
});

test("the spike contains all reference sites and one active view variable", () => {
  assert.match(source, /https:\/\/leetcode\.com/);
  assert.match(source, /https:\/\/chatgpt\.com/);
  assert.match(source, /https:\/\/www\.canva\.com/);
  assert.equal((source.match(/let siteView;/g) || []).length, 1);
});
