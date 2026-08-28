const sitesRoot = document.querySelector("#sites");
const status = document.querySelector("#status");
const details = document.querySelector("#details");

function showStatus(message, payload) {
  status.textContent = message;
  if (payload) details.textContent = JSON.stringify(payload, null, 2);
}

async function boot() {
  const sites = await window.lockInSpike.getSites();
  for (const site of sites) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = site.name;
    button.addEventListener("click", async () => {
      showStatus(`Opening ${site.name}…`);
      try {
        const result = await window.lockInSpike.openSite(site.id);
        showStatus(result.site, result);
      } catch (error) {
        showStatus("Load failed", { message: error.message });
      }
    });
    sitesRoot.append(button);
  }

  document.querySelector("#close-site").addEventListener("click", async () => {
    await window.lockInSpike.closeSite();
    showStatus("Ready");
  });

  document.querySelector("#cookie-check").addEventListener("click", async () => {
    const result = await window.lockInSpike.runCookieCheck();
    showStatus(result.passed ? "Cookie persistence passed" : "Cookie persistence failed", result);
  });

  window.lockInSpike.onStatus((event) => {
    const label = event.site ? `${event.type}: ${event.site}` : event.type;
    showStatus(label, event);
  });
}

boot().catch((error) => showStatus("Spike failed to initialize", { message: error.message }));
