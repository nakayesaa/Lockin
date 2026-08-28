const path = require("node:path");
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session
} = require("electron");

const TOP_BAR_HEIGHT = 84;
const VIEW_PARTITION = "persist:lockin-phase-1";
const LOAD_TIMEOUT_MS = 45_000;

const sites = Object.freeze([
  { id: "leetcode", name: "LeetCode", url: "https://leetcode.com" },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com" },
  { id: "canva", name: "Canva", url: "https://www.canva.com" }
]);

let mainWindow;
let siteView;
let activeSite;

function publicSites() {
  return sites.map(({ id, name, url }) => ({ id, name, url }));
}

function sendStatus(payload) {
  if (!process.argv.includes("--probe")) {
    process.stdout.write(`LOCKIN_PHASE_1_EVENT=${JSON.stringify(payload)}\n`);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("spike:status", payload);
  }
}

function resizeSiteView() {
  if (!mainWindow || mainWindow.isDestroyed() || !siteView) return;
  const [width, height] = mainWindow.getContentSize();
  siteView.setBounds({
    x: 0,
    y: TOP_BAR_HEIGHT,
    width: Math.max(1, width),
    height: Math.max(1, height - TOP_BAR_HEIGHT)
  });
}

function destroySiteView() {
  if (!siteView) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(siteView);
  }
  siteView.webContents.close();
  siteView = undefined;
  activeSite = undefined;
  sendStatus({ type: "closed" });
}

function createSiteView(partition = VIEW_PARTITION) {
  const view = new WebContentsView({
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    sendStatus({ type: "new-window", url });
    view.webContents.loadURL(url).catch((error) => {
      sendStatus({ type: "load-error", message: error.message, url });
    });
    return { action: "deny" };
  });

  view.webContents.on("did-start-loading", () => {
    sendStatus({ type: "loading", site: activeSite?.name });
  });

  view.webContents.on("did-finish-load", () => {
    sendStatus({
      type: "loaded",
      site: activeSite?.name,
      url: view.webContents.getURL(),
      title: view.webContents.getTitle()
    });
  });

  view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        sendStatus({
          type: "load-error",
          errorCode,
          message: errorDescription,
          url: validatedURL
        });
      }
    }
  );

  view.webContents.on("render-process-gone", (_event, details) => {
    sendStatus({ type: "renderer-gone", details });
  });

  return view;
}

async function openSite(siteId) {
  const requestedSite = sites.find((site) => site.id === siteId);
  if (!requestedSite) throw new Error(`Unknown site: ${siteId}`);

  destroySiteView();
  activeSite = requestedSite;
  siteView = createSiteView();
  mainWindow.contentView.addChildView(siteView);
  resizeSiteView();
  sendStatus({ type: "opening", site: requestedSite.name, url: requestedSite.url });

  await siteView.webContents.loadURL(requestedSite.url);
  return { site: requestedSite.name, url: siteView.webContents.getURL() };
}

async function checkCookiePersistence() {
  const persistentSession = session.fromPartition(VIEW_PARTITION);
  const existing = await persistentSession.cookies.get({
    url: "https://leetcode.com",
    name: "lockin_phase_1_probe"
  });
  const cookie = {
    url: "https://leetcode.com",
    name: "lockin_phase_1_probe",
    value: `probe-${Date.now()}`,
    expirationDate: Math.floor(Date.now() / 1000) + 3600
  };

  await persistentSession.cookies.set(cookie);
  destroySiteView();
  siteView = createSiteView();
  mainWindow.contentView.addChildView(siteView);
  resizeSiteView();

  const stored = await siteView.webContents.session.cookies.get({
    url: cookie.url,
    name: cookie.name
  });

  return {
    passed: stored.some((item) => item.value === cookie.value),
    cookieCount: stored.length,
    existedBeforeThisRun: existing.length > 0
  };
}

function processMetrics() {
  return app.getAppMetrics().map((metric) => ({
    pid: metric.pid,
    type: metric.type,
    workingSetKb: metric.memory?.workingSetSize ?? null,
    privateKb: metric.memory?.privateBytes ?? null
  }));
}

async function probeNewWindowReuse() {
  if (!siteView) return { passed: false, reason: "No active site view" };
  const destination = "https://example.com/?lockin-phase-1-popup";
  const loadResultPromise = waitForMainFrame(siteView);
  await siteView.webContents.executeJavaScript(
    `window.open(${JSON.stringify(destination)}, "_blank")`
  );
  const load = await loadResultPromise;
  return {
    passed:
      load.status === "loaded" &&
      siteView.webContents.getURL() === destination &&
      BrowserWindow.getAllWindows().length === 1,
    load,
    finalUrl: siteView.webContents.getURL(),
    browserWindowCount: BrowserWindow.getAllWindows().length
  };
}

async function probeOfflineFailure() {
  const offlinePartition = `lockin-phase-1-offline-${Date.now()}`;
  const offlineSession = session.fromPartition(offlinePartition);
  offlineSession.webRequest.onBeforeRequest((_details, callback) => {
    callback({ cancel: true });
  });
  try {
    destroySiteView();
    activeSite = {
      id: "offline-probe",
      name: "Offline probe",
      url: `https://www.iana.org/domains/reserved?probe=${Date.now()}`
    };
    siteView = createSiteView(offlinePartition);
    mainWindow.contentView.addChildView(siteView);
    resizeSiteView();
    const loadResultPromise = waitForMainFrame(siteView);
    siteView.webContents.loadURL(activeSite.url).catch(() => { });
    const load = await loadResultPromise;
    let page = {};
    try {
      page = await siteView.webContents.executeJavaScript(`({
        online: navigator.onLine,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 240) ?? ""
      })`);
    } catch (error) {
      page = { inspectionError: error.message };
    }
    return {
      passed: load.status === "failed" || page.online === false,
      load,
      page
    };
  } finally {
    destroySiteView();
  }
}

function waitForMainFrame(view) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      view.webContents.removeListener("did-finish-load", onLoaded);
      view.webContents.removeListener("did-fail-load", onFailed);
      resolve(result);
    };
    const onLoaded = () => finish({ status: "loaded" });
    const onFailed = (_event, code, description, url, isMainFrame) => {
      if (isMainFrame) finish({ status: "failed", code, description, url });
    };
    const timer = setTimeout(
      () => finish({ status: "timeout", url: view.webContents.getURL() }),
      LOAD_TIMEOUT_MS
    );
    view.webContents.once("did-finish-load", onLoaded);
    view.webContents.on("did-fail-load", onFailed);
  });
}

async function probeOneSite(site) {
  destroySiteView();
  activeSite = site;
  siteView = createSiteView();
  mainWindow.contentView.addChildView(siteView);
  resizeSiteView();

  const loadResultPromise = waitForMainFrame(siteView);
  const startedAt = Date.now();
  siteView.webContents.loadURL(site.url).catch(() => { });
  const load = await loadResultPromise;
  const durationMs = Date.now() - startedAt;

  let page = {};
  if (load.status === "loaded") {
    try {
      page = await siteView.webContents.executeJavaScript(`({
        title: document.title,
        href: location.href,
        bodyTextLength: document.body?.innerText?.length ?? 0,
        hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
        cookieEnabled: navigator.cookieEnabled
      })`);
    } catch (error) {
      page = { inspectionError: error.message };
    }
  }

  return {
    id: site.id,
    requestedUrl: site.url,
    durationMs,
    load,
    page,
    metrics: processMetrics()
  };
}

async function runAutomatedProbe() {
  const results = [];
  for (const site of sites) {
    results.push(await probeOneSite(site));
  }
  const newWindowReuse = await probeNewWindowReuse();
  const cookiePersistence = await checkCookiePersistence();
  const offlineFailure = await probeOfflineFailure();
  const report = {
    timestamp: new Date().toISOString(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    cookiePersistence,
    newWindowReuse,
    offlineFailure,
    sites: results
  };
  process.stdout.write(`LOCKIN_PHASE_1_RESULT=${JSON.stringify(report)}\n`);
  app.quit();
}

function registerIpc() {
  ipcMain.handle("spike:get-sites", () => publicSites());
  ipcMain.handle("spike:open-site", (_event, siteId) => openSite(siteId));
  ipcMain.handle("spike:close-site", () => {
    destroySiteView();
    return { closed: true };
  });
  ipcMain.handle("spike:cookie-check", () => checkCookiePersistence());
  ipcMain.handle("spike:get-metrics", () => processMetrics());
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: "#f4f1e8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.on("resize", resizeSiteView);
  mainWindow.on("closed", () => {
    siteView = undefined;
    mainWindow = undefined;
  });

  await mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));
  mainWindow.show();
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  if (process.argv.includes("--probe")) {
    await runAutomatedProbe();
  }
});

app.on("window-all-closed", () => app.quit());
