
(() => {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    console.info("Service workers are not supported in this browser.");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration =
        await navigator.serviceWorker.register("./sw.js");

      console.info(
        "Mwaniki Scholars PWA service worker registered:",
        registration.scope
      );
    } catch (error) {
      console.error(
        "Mwaniki Scholars PWA registration failed:",
        error
      );
    }
  });
})();
