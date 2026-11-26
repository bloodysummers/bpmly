import { chromium } from "playwright";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.URL ?? "http://localhost:3001";

const problems = [];

async function main() {
  const browser = await chromium.launch({
    executablePath: EDGE,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") problems.push(`[console:${t}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`[pageerror] ${err.message}`));

  await page.goto(URL, { waitUntil: "networkidle" });
  // estado inicial determinista
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // 1. Render básico
  const checks = {};
  checks.title = await page.title();
  checks.presets = await page.locator("li[draggable]").count();
  checks.beatBoxes = await page.locator('button[title^="Beat"]').count();
  checks.pendulum = await page.locator("svg").count();
  checks.timeline = await page.locator('[data-testid="timeline"]').count();

  // 2. Iniciar el metrónomo y observar qué beats se activan
  await page.locator('button:has-text("Iniciar")').click();
  const seq = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 90; i++) {
      // re-consultar: React remonta el box activo cuando cambia su key
      const boxes = [...document.querySelectorAll('button[title^="Beat"]')];
      const idx = boxes.findIndex((b) => b.className.includes("text-ink"));
      out.push(idx);
      await new Promise((r) => setTimeout(r, 40));
    }
    return out;
  });
  const active = seq.filter((i) => i >= 0);
  checks.beatSequence = active.join(",");
  checks.cycles = Math.floor(active.length / 4);

  // 3. Pendulum: la aguja debe moverse
  const angles = await page.evaluate(async () => {
    const g = document.querySelector('svg g[transform^="rotate"]');
    const out = [];
    for (let i = 0; i < 20; i++) {
      const m = /rotate\(([-\d.]+)/.exec(g?.getAttribute("transform") ?? "");
      out.push(m ? Number(m[1]) : 0);
      await new Promise((r) => setTimeout(r, 40));
    }
    return out;
  });
  checks.pendulumAngles = angles.slice(0, 8).map((a) => a.toFixed(1)).join(" ");
  checks.pendulumMoves = new Set(angles.map((a) => Math.round(a))).size > 3;

  // 3b. Cambiar tempo durante la reproducción: debe surtir efecto al instante
  const sampleBeats = (ms) =>
    page.evaluate(async (ms) => {
      const t0 = performance.now();
      const out = [];
      let last = -1;
      while (performance.now() - t0 < ms) {
        const boxes = [...document.querySelectorAll('button[title^="Beat"]')];
        const idx = boxes.findIndex((b) => b.className.includes("text-ink"));
        if (idx !== last) {
          out.push(performance.now() - t0);
          last = idx;
        }
        await new Promise((r) => setTimeout(r, 15));
      }
      return out;
    }, ms);

  const avg = (ts) => (ts.length > 1 ? (ts[ts.length - 1] - ts[0]) / (ts.length - 1) : 0);
  const beatsSlow = await sampleBeats(2600);
  checks.avgBeatMsAt90 = Math.round(avg(beatsSlow));

  await page.locator('button:has-text("200")').first().click();
  await page.waitForTimeout(120);
  const beatsFast = await sampleBeats(2600);
  checks.avgBeatMsAt200 = Math.round(avg(beatsFast));
  checks.liveTempo = checks.avgBeatMsAt200 > 0 && checks.avgBeatMsAt200 < checks.avgBeatMsAt90 * 0.75;


  await page.screenshot({ path: "shot-metronome.png", fullPage: true });

  // 4. Detener
  await page.locator('button:has-text("■ Detener")').first().click();
  checks.stopped = await page.locator('button:has-text("Iniciar")').isVisible();

  // 5. Editar el patrón de acentos haciendo clic en un beat (modo preset)
  const box3 = page.locator('button[title="Beat 3: clic para alternar acento"]');
  const wasAccent = (await box3.getAttribute("class")).includes("bg-accent/15");
  await box3.click();
  const nowAccent = (await box3.getAttribute("class")).includes("bg-accent/15");
  checks.accentBefore = wasAccent;
  checks.accentAfter = nowAccent;
  checks.accentToggled = wasAccent !== nowAccent;

  // 6. Añadir bloque al vuelo
  const blocksBefore = await page.locator('[data-testid="block"]').count();
  await page.locator('button:has-text("Bloque al vuelo")').click();
  const blocksAfter = await page.locator('[data-testid="block"]').count();
  checks.blockAdded = blocksAfter === blocksBefore + 1;

  // 7. Drag & drop de un preset a la línea de tiempo
  const demoBlocks = await page.locator('[data-testid="block"]').count();
  const firstPreset = page.locator("li[draggable]").first();
  await firstPreset.dragTo(page.locator('[data-testid="timeline"]'));
  const afterDrop = await page.locator('[data-testid="block"]').count();
  checks.presetDropped = afterDrop === demoBlocks + 1;

  // 8. Seleccionar un bloque y editar repeticiones
  const lastBlock = page.locator('[data-testid="block"]').last();
  await lastBlock.click();
  const repeatsInput = page.locator('[data-testid="Repeticiones"]');
  const hasRepeatsField = (await repeatsInput.count()) > 0;
  checks.inspectorVisible = hasRepeatsField;
  if (hasRepeatsField) {
    await repeatsInput.fill("6");
    checks.repeatsUpdated = (await repeatsInput.inputValue()) === "6";
  }

  // 9. Reproducir el track y ver avanzar el playhead
  await page.locator('button:has-text("Reproducir track")').click();
  const playhead = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 25; i++) {
      const el = document.querySelector('[data-testid="timeline"] > div > div.bg-playhead');
      out.push(el ? parseFloat(el.style.left) : 0);
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  checks.playheadMoves = playhead[playhead.length - 1] > playhead[0] && Math.max(...playhead) > 20;

  // detener antes de manipular el track
  await page.locator('button:has-text("■ Detener")').nth(1).click();

  await page.screenshot({ path: "shot-track.png", fullPage: true });

  // 10. Reordenar bloques arrastrando uno sobre otro
  const namesBefore = await page.locator('[data-testid="block"] span.truncate').allTextContents();
  await page.locator('[data-testid="block"]').nth(0).dragTo(page.locator('[data-testid="block"]').nth(2));
  const namesAfter = await page.locator('[data-testid="block"] span.truncate').allTextContents();
  checks.namesBefore = namesBefore;
  checks.namesAfter = namesAfter;
  const sorted = (a) => [...a].sort();
  checks.blockReordered =
    namesBefore.length === namesAfter.length &&
    JSON.stringify(sorted(namesBefore)) === JSON.stringify(sorted(namesAfter)) &&
    JSON.stringify(namesBefore) !== JSON.stringify(namesAfter);

  // 11. Redimensionar un bloque arrastrando su borde derecho
  const blockIdx = 1;
  await page.locator('[data-testid="block"]').nth(blockIdx).click();
  const repeatsBefore = Number(await page.locator('[data-testid="Repeticiones"]').inputValue());
  const handle = await page.locator('[data-testid="resize"]').nth(blockIdx).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(handle.x + (handle.width / 2) + i * 25, handle.y + handle.height / 2);
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  const repeatsAfter = Number(await page.locator('[data-testid="Repeticiones"]').inputValue());
  checks.resizeBefore = repeatsBefore;
  checks.resizeAfter = repeatsAfter;
  checks.resized = repeatsAfter > repeatsBefore;

  // 12. Reproducir «desde el bloque»: el playhead debe arrancar en ese bloque
  await page.locator('[data-testid="block"]').nth(2).click();
  await page.locator('button:has-text("Desde el bloque")').click();
  const fromBlock = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const el = document.querySelector('[data-testid="timeline"] > div > div.bg-playhead');
      out.push(el ? parseFloat(el.style.left) : -1);
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  checks.playheadFromBlock = Math.round(Math.max(...fromBlock));
  checks.playheadStartsAtBlock = Math.max(...fromBlock) > 100;
  await page.locator('button:has-text("■ Detener")').nth(1).click();

  // 13. Auto-scroll: el scroll del usuario no se pisa mientras el playhead es visible
  await page.locator('[data-testid="zoom"]').evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "4");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  checks.zoomLabel = await page.locator("text=4.00×").count();
  await page.locator('button:has-text("Reproducir track")').click();
  const scrollStable = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="timeline"]');
    el.scrollLeft = 0;
    const out = [];
    for (let i = 0; i < 25; i++) {
      out.push(Math.round(el.scrollLeft));
      await new Promise((r) => setTimeout(r, 40));
    }
    return out;
  });
  checks.scrollStable = scrollStable;
  checks.scrollNotPisted = scrollStable.every((v) => v === 0);

  // el playhead ya está fuera de la vista: debe recuperarse
  await page.waitForTimeout(9000);
  const scrollRecover = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="timeline"]');
    el.scrollLeft = 0;
    const out = [];
    for (let i = 0; i < 10; i++) {
      out.push(Math.round(el.scrollLeft));
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  checks.scrollRecover = scrollRecover;
  checks.scrollRecovers = scrollRecover[scrollRecover.length - 1] > 200;

  // con el seguimiento pausado, el scroll queda libre
  await page.locator('button:has-text("Siguiendo")').click();
  const scrollFree = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="timeline"]');
    el.scrollLeft = 0;
    const out = [];
    for (let i = 0; i < 10; i++) {
      out.push(Math.round(el.scrollLeft));
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  checks.scrollFreeWhenPaused = scrollFree.every((v) => v === 0);
  await page.locator('button:has-text("Seguimiento pausado")').click();
  await page.locator('button:has-text("■ Detener")').nth(1).click();

  // 14. Guardar preset y track
  const presetsBefore = await page.locator("li[draggable]").count();
  await page.locator('button:has-text("Guardar")').first().click();
  checks.presetSaved = (await page.locator("li[draggable]").count()) >= presetsBefore;
  await page.locator('button:has-text("Guardar track")').click();
  checks.trackSaved = (await page.locator("button:has-text('Demo')").count()) > 0;

  // 15. Persistencia: recargar y comprobar que sigue ahí
  await page.reload({ waitUntil: "networkidle" });
  checks.presetsAfterReload = await page.locator("li[draggable]").count();
  checks.blocksAfterReload = await page.locator('[data-testid="block"]').count();
  checks.trackChipsAfterReload = await page.locator('[data-testid="timeline"]').count();

  console.log(JSON.stringify(checks, null, 2));
  console.log("\nProblemas de consola:", problems.length ? problems : "ninguno");
  await browser.close();
}

main().catch((e) => {
  console.error("E2E falló:", e);
  process.exit(1);
});
