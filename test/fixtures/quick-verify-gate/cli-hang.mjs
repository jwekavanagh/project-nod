#!/usr/bin/env node
/**
 * Intentionally never exits — used to test spawnSync timeout in quick-verify postbuild gate.
 */
setInterval(() => {}, 2 ** 30);
