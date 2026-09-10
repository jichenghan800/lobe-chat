import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from the repository root with the authenticated model picker open in Chrome.
const packages = await readdir('node_modules/.pnpm');
const installed = packages.find((name) => name.startsWith('playwright-core@'));
assert(installed, 'Install repository dependencies first');
const { chromium } = await import(pathToFileURL(resolve('node_modules/.pnpm', installed, 'node_modules/playwright-core/index.mjs')));
const browser = await chromium.connectOverCDP(process.env.COTTI_TEST_CDP_URL || 'http://127.0.0.1:9222');
try {
  const page = browser.contexts()[0].pages().filter((p) => p.url() === 'https://chatdev.cotticoffee.com/').at(-1);
  assert(page, 'Open an authenticated chatdev homepage');
  const trigger = page.getByRole('button', { name: 'COTTI-专业', exact: true });
  await trigger.waitFor({ state: 'visible', timeout: 30000 });
  await trigger.click();
  const menu = page.getByRole('menu').filter({ has: page.locator('input') });
  await menu.waitFor({ state: 'visible' });
  await menu.hover();
  await page.waitForTimeout(1000);
  const geometry = await menu.evaluate((element) => {
    const items = [...element.querySelectorAll('[role="menuitem"]')];
    const bounds = element.getBoundingClientRect();
    const last = items.at(-1)?.getBoundingClientRect();
    return { count: items.length, height: bounds.height, bottomBlank: last ? bounds.bottom - last.bottom : null };
  });
  console.log(JSON.stringify(geometry));
  assert(geometry.height > 0, 'Measure a visible picker');
  assert(geometry.count > 0 && geometry.count <= 4, 'Use the four-model Chat picker for this regression');
  assert(geometry.bottomBlank !== null && geometry.bottomBlank < 20, 'Short model list must not leave a fixed-height blank area');
  const search = menu.locator('input');
  await page.screenshot({ path: '.records/native-v2216/model-panel-after.png' });
  try {
    await search.fill('Terra');
    await page.waitForTimeout(300);
    assert.equal(await menu.getByRole('menuitem').count(), 1);
    const filtered = await menu.boundingBox();
    assert(filtered && filtered.height < geometry.height, 'Filtering to one model must shrink the picker');
    await page.screenshot({ path: '.records/native-v2216/model-panel-search.png' });
    await search.fill('COTTI-NO-SUCH-MODEL-TEST');
    await page.waitForTimeout(300);
    assert.equal(await menu.getByRole('menuitem').count(), 0);
    const empty = await menu.boundingBox();
    assert(empty && empty.height < geometry.height, 'Empty search must not reserve the full list height');
    console.log(JSON.stringify({ filteredHeight: filtered.height, emptyHeight: empty.height }));
  } finally {
    await search.fill('');
  }

} finally {
  await browser.close();
}
