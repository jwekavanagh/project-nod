#!/usr/bin/env node
/** Print absolute path to the Playwright-managed Chromium binary (for LHCI CHROME_PATH). */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
process.stdout.write(chromium.executablePath());
