#!/usr/bin/env node
// scripts/patch-netlify-handler-paths.mjs
//
// Workaround for a @netlify/plugin-nextjs bug on Windows: when `netlify build`
// runs on Windows, the generated `___netlify-server-handler.mjs` contains
// Windows backslash paths (`\var\task\apps\portal\...`). On the Linux Lambda
// runtime these `\v`, `\t` etc. get interpreted as JS escape characters,
// producing import paths like `ar\taskappsportal` — and every server
// route returns 502: `Cannot find package 'ar\taskappsportal'`.
//
// This script rewrites the generated handler to use POSIX `/var/task/...`
// paths and also deletes the stale function .zip so the next deploy re-zips
// with the patched .mjs (otherwise `netlify deploy` reuses its functions
// cache and ships the broken bundle).
//
// Recommended deploy recipe on Windows:
//   1. npm --workspace apps/portal run build   (or `netlify build --filter @gio4x/portal`)
//   2. node scripts/patch-netlify-handler-paths.mjs apps/portal
//   3. netlify deploy --prod --filter @gio4x/portal --no-build --skip-functions-cache
//
// Each Netlify-deployed app can pass its own apps/<name> path as the first arg.

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const appRel = process.argv[2] ?? 'apps/portal'
const root = process.cwd()
const handler = join(
  root,
  appRel,
  '.netlify',
  'functions-internal',
  '___netlify-server-handler',
  '___netlify-server-handler.mjs',
)
const zip = join(root, appRel, '.netlify', 'functions', '___netlify-server-handler.zip')

if (!existsSync(handler)) {
  console.error(`patch-netlify-handler-paths: handler not found at ${handler}`)
  console.error('Run `netlify build` (or your build step) first.')
  process.exit(1)
}

let src = readFileSync(handler, 'utf8')
const original = src

// Replace the long form first (with backslash-separated suffix) so the short
// form's replacement doesn't half-rewrite it.
src = src.replaceAll(
  '\\var\\task\\apps\\portal\\.netlify\\dist\\run\\handlers\\server.js',
  '/var/task/apps/portal/.netlify/dist/run/handlers/server.js',
)
src = src.replaceAll('\\var\\task\\apps\\portal', '/var/task/apps/portal')

// Belt-and-braces: if any other plain backslash POSIX prefix slipped through,
// replace it too. This regex is narrow enough not to touch unrelated strings.
src = src.replaceAll(/'\\var\\task\\[^']+'/g, (m) =>
  m.replaceAll('\\', '/'),
)

if (src === original) {
  console.log('patch-netlify-handler-paths: no Windows paths found — nothing to patch.')
} else {
  writeFileSync(handler, src, 'utf8')
  console.log(`patch-netlify-handler-paths: patched ${handler}`)
}

if (existsSync(zip)) {
  rmSync(zip)
  console.log(`patch-netlify-handler-paths: removed stale ${zip}`)
  console.log('Deploy with: netlify deploy --prod --no-build --skip-functions-cache')
}
