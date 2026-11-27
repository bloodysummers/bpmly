import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:3000";
// usa el canal msedge; con BROWSER=chromium se usa el Chromium de Playwright
const CHANNEL = process.env.BROWSER ?? "msedge";

const problems = [];

async function main() {
  const browser = await chromium.launch({
    channel: CHANNEL,
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
  checks.trackListPanel = await page.locator('[data-testid="track"]').count();

  // 2. Iniciar el metrónomo y observar qué beats se activan
  await page.locator('button:has-text("Iniciar")').click();

  // Solo un recuadro debe estar iluminado, y la animación de flasheo debe correr
  // únicamente en el recuadro activo (no en el anterior al dejar de estarlo)
  const probe = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 70; i++) {
      const boxes = [...document.querySelectorAll('button[title^="Beat"]')];
      const lit = boxes.map((b, k) => (b.className.includes("text-ink") ? k : -1)).filter((k) => k >= 0);
      const flashing = boxes
        .map((b, k) =>
          b.getAnimations().some((a) => a.animationName === "beat-flash" && a.playState === "running" && (a.currentTime ?? 0) < 260) ? k : -1,
        )
        .filter((k) => k >= 0);
      out.push({ lit, flashing });
      await new Promise((r) => setTimeout(r, 30));
    }
    return out;
  });
  const litSeq = probe.map((p) => p.lit.join("+")).filter((s) => s !== "");
  checks.beatSequence = litSeq.join(",");
  checks.cycles = Math.floor(litSeq.length / 4);
  checks.maxLitBoxes = Math.max(...probe.map((p) => p.lit.length));
  checks.oneBoxAtATime = checks.maxLitBoxes === 1;
  checks.flashOnlyOnActive = probe.every((p) => p.flashing.every((k) => p.lit.includes(k)));

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
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const beatsSlow = await sampleBeats(2600);
  checks.avgBeatMsAt90 = Math.round(avg(beatsSlow));

  await page.locator('button:has-text("200")').first().click();
  await page.waitForTimeout(120);
  const beatsFast = await sampleBeats(2600);
  checks.avgBeatMsAt200 = Math.round(avg(beatsFast));
  checks.liveTempo = checks.avgBeatMsAt200 > 0 && checks.avgBeatMsAt200 < checks.avgBeatMsAt90 * 0.75;

  // 3c. El denominador NO cambia la velocidad del pulso: es notación
  await page.locator('button:has-text("120")').first().click();
  await page.waitForTimeout(120);
  const beats44 = await sampleBeats(2600);
  await page.locator('select[data-testid="Denominador"]').first().selectOption("8");
  await page.waitForTimeout(120);
  const beats48 = await sampleBeats(2600);
  checks.avgBeatMs44 = Math.round(avg(beats44));
  checks.avgBeatMs48 = Math.round(avg(beats48));
  checks.denominatorKeepsPulse = Math.abs(checks.avgBeatMs48 - checks.avgBeatMs44) < checks.avgBeatMs44 * 0.15;
  await page.locator('select[data-testid="Denominador"]').first().selectOption("4");

  // 3d. La subdivisión sí cambia lo que se oye: clics extra entre pulsos.
  // Se instrumenta el AudioContext para registrar el instante de cada clic real.
  await page.evaluate(() => {
    window.__clicks = [];
    const orig = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = orig.call(this);
      const origStart = node.start.bind(node);
      node.start = (when = 0) => {
        window.__clicks.push(when);
        return origStart(when);
      };
      return node;
    };
  });

  const subSel = page.locator('select[data-testid="Subdivisión"]').first();
  const sampleClicks = async (value) => {
    await subSel.selectOption(value);
    await page.evaluate(() => (window.__clicks.length = 0));
    await page.waitForTimeout(2000);
    const xs = await page.evaluate(() => window.__clicks);
    return xs.slice(1).map((t, i) => (t - xs[i]) * 1000);
  };
  const d1 = await sampleClicks("1");
  const d4 = await sampleClicks("4");
  checks.clickMs1 = Math.round(mean(d1));
  checks.clickMs4 = Math.round(mean(d4));
  checks.subdivisionAddsClicks = d1.length > 2 && d4.length > 2 && mean(d4) < mean(d1) * 0.35;
  const beatsSub4 = await sampleBeats(2600);
  checks.pulseKeepsWithSubdivision = Math.abs(avg(beatsSub4) - checks.avgBeatMs44) < checks.avgBeatMs44 * 0.15;
  await subSel.selectOption("1");

  // 3e. Numerador como dropdown: cambiarlo cambia las cajas de beat
  const numSel = page.locator('select[data-testid="Numerador"]').first();
  const numBefore = await numSel.inputValue();
  await numSel.selectOption("6");
  const numAfter = await numSel.inputValue();
  await page.waitForTimeout(150);
  const boxesAfter = await page.locator('button[title^="Beat"]').count();
  checks.numeratorDropdown = `${numBefore}->${numAfter}`;
  checks.numeratorDropdownWorks = numAfter === "6" && boxesAfter === 6;
  await numSel.selectOption("4");
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

  // 8. Seleccionar un bloque y editar repeticiones (valida al perder el foco)
  const lastBlock = page.locator('[data-testid="block"]').last();
  await lastBlock.click();
  const repeatsInput = page.locator('[data-testid="Repeticiones"]');
  const hasRepeatsField = (await repeatsInput.count()) > 0;
  checks.inspectorVisible = hasRepeatsField;
  if (hasRepeatsField) {
    await repeatsInput.fill("6");
    await repeatsInput.blur();
    checks.repeatsUpdated = (await lastBlock.innerText()).includes("×6");
  }

  // 8b. Tempo: escribir «120» dígito a dígito no debe recortarse a 20 en cada tecla
  const tempoField = page.locator('[data-testid="Tempo"]');
  await tempoField.click();
  await tempoField.fill("");
  await tempoField.pressSequentially("1", { delay: 40 });
  const afterOne = await tempoField.inputValue();
  await tempoField.pressSequentially("20", { delay: 40 });
  const afterFull = await tempoField.inputValue();
  await tempoField.press("Enter");
  checks.tempoTypingKeepsText = afterOne === "1" && afterFull === "120";
  checks.tempoAppliedOnCommit = (await lastBlock.innerText()).includes("120");

  // 8c. Numerador y denominador del inspector son desplegables, no campos abiertos
  const inspector = page.locator('[data-testid="inspector"]');
  checks.inspectorSelects =
    (await inspector.locator('select[data-testid="Numerador"]').count()) === 1 &&
    (await inspector.locator('select[data-testid="Denominador"]').count()) === 1 &&
    (await inspector.locator('select[data-testid="Subdivisión"]').count()) === 1;
  await inspector.locator('select[data-testid="Numerador"]').selectOption("6");
  checks.numeratorApplied = (await lastBlock.innerText()).includes("6/");

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
  // (con zoom 0.25 todos los bloques caben en la vista: el arrastre es estable)
  await page.locator('[data-testid="zoom"]').evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "0.25");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator('[data-testid="timeline"]').evaluate((el) => (el.scrollLeft = 0));
  const namesBefore = await page.locator('[data-testid="block"] span.truncate').allTextContents();
  await page.locator('[data-testid="block"]').nth(0).dragTo(page.locator('[data-testid="block"]').nth(3));
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

  // 14. Crear preset: aparece en la lista al instante, sin pasar por «Guardar»
  const presetsBefore = await page.locator("li[draggable]").count();
  await page.locator('[data-testid="Nombre del preset"]').fill("Prueba 120");
  await page.locator('button:has-text("Crear preset")').click();
  const presetsAfter = await page.locator("li[draggable]").count();
  checks.presetCreated = presetsAfter === presetsBefore + 1;
  checks.newPresetInList = (await page.locator("li[draggable]", { hasText: "Prueba 120" }).count()) === 1;

  // 14b. «Actualizar preset» sobrescribe el preset seleccionado
  await page.locator('button:has-text("160")').first().click();
  await page.locator('button:has-text("Actualizar preset")').click();
  const rowText = await page.locator("li[draggable]", { hasText: "Prueba 120" }).innerText();
  checks.presetUpdated = rowText.includes("160");
  checks.savedLabel = (await page.locator('button:has-text("Actualizar preset")').count()) === 1;

  // 15. Panel de tracks: seleccionar, reproducir desde la lista, eliminar
  const trackRows = page.locator('[data-testid="track"]');
  checks.trackRows = await trackRows.count();
  await trackRows.first().locator("button").first().click();
  checks.trackSelected = (await page.locator('[data-testid="Nombre del track"]').inputValue()).includes("Demo");
  await trackRows.first().locator('button[title="Reproducir este track"]').click();
  const playheadFromList = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const el = document.querySelector('[data-testid="timeline"] > div > div.bg-playhead');
      out.push(el ? parseFloat(el.style.left) : 0);
      await new Promise((r) => setTimeout(r, 60));
    }
    return out;
  });
  checks.trackPlaysFromList = Math.max(...playheadFromList) > 20;
  await page.locator('button:has-text("■ Detener")').nth(1).click();

  // 16. Guardar track y persistencia tras recargar
  await page.locator('button:has-text("Guardar track")').click();
  checks.trackSaved = (await page.locator('[data-testid="track"]', { hasText: "Demo" }).count()) > 0;
  await page.reload({ waitUntil: "networkidle" });
  checks.presetsAfterReload = await page.locator("li[draggable]").count();
  checks.blocksAfterReload = await page.locator('[data-testid="block"]').count();
  checks.trackRowsAfterReload = await page.locator('[data-testid="track"]').count();

  // 17. Responsive: en móvil nada debe desbordar la pantalla
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  checks.mobileInnerWidth = await page.evaluate(() => innerWidth);
  checks.mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  checks.mobileNoOverflow = checks.mobileScrollWidth <= checks.mobileInnerWidth + 1;
  checks.mobileTimelineScrollable = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="timeline"]');
    return !!el && el.scrollWidth > el.clientWidth && el.clientWidth <= innerWidth;
  });
  await page.screenshot({ path: "shot-mobile.png", fullPage: true });

  // 17b. A 1024 px el panel de metrónomo es estrecho: los desplegables no deben
  // encimarse sobre el control de tempo (el slider, su número y los botones rápidos)
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(300);
  const tempoBox = await page.locator('input[type="range"]').first().boundingBox();
  const fieldBoxes = [];
  for (const t of ["Numerador", "Denominador", "Subdivisión"]) {
    const sel = await page.locator(`select[data-testid="${t}"]`).first().boundingBox();
    const lab = await page.locator(`span:text-is("${t}")`).first().boundingBox();
    if (sel) fieldBoxes.push(sel);
    if (lab) fieldBoxes.push(lab);
  }
  checks.dropdownsOverlapTempo = fieldBoxes.some(
    (b) =>
      b.left < tempoBox.x + tempoBox.width &&
      b.x + b.width > tempoBox.x &&
      b.y < tempoBox.y + tempoBox.height &&
      b.y + b.height > tempoBox.y,
  );
  checks.tempoRowWidth = Math.round(tempoBox.width);
  await page.screenshot({ path: "shot-1024.png", fullPage: true });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(200);
  checks.desktopNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  console.log(JSON.stringify(checks, null, 2));
  console.log("\nProblemas de consola:", problems.length ? problems : "ninguno");
  await browser.close();
}

main().catch((e) => {
  console.error("E2E falló:", e);
  process.exit(1);
});
