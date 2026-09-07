(function () {
  "use strict";

  var STORAGE_KEY = "nalichat-pwa-dismissed";
  var DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
  var STYLE_ID = "nc-pwa-install-styles";
  var ROOT_ID = "nc-pwa-root";

  var deferredPrompt = null;
  var root = null;

  function isStandalone() {
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    var ua = window.navigator.userAgent || "";
    var iOSDevice = /iPad|iPhone|iPod/.test(ua);
    var iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return (iOSDevice || iPadOs) && !window.MSStream;
  }

  function isLocalPreview() {
    var host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  function wantsForcedPreview() {
    try {
      return new URLSearchParams(window.location.search).has("preview-install");
    } catch (e) {
      return false;
    }
  }

  function wasDismissed() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var ts = parseInt(raw, 10);
      if (!Number.isFinite(ts)) return true;
      return Date.now() - ts < DISMISS_MS;
    } catch (e) {
      return false;
    }
  }

  function rememberDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + ROOT_ID + "{position:fixed;z-index:80;top:50%;right:max(12px,env(safe-area-inset-right,0px));left:auto;bottom:auto;transform:translateY(-50%);display:flex;justify-content:flex-end;pointer-events:none}" +
      "#" + ROOT_ID + " .nc-pwa-card{pointer-events:auto;box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:168px;height:168px;padding:1rem .75rem .85rem;overflow:visible;text-align:center;background:radial-gradient(circle at 35% 28%,#1aa39a 0%,#0e7c7b 68%,#0a6463 100%);border:2px solid rgba(255,255,255,.35);border-radius:50%;box-shadow:0 14px 32px rgba(15,23,42,.16),0 0 0 1px rgba(14,124,123,.12),0 0 24px rgba(14,124,123,.12);animation:nc-pwa-in .38s ease-out,nc-pwa-float 3.2s ease-in-out .38s infinite}" +
      "#" + ROOT_ID + " .nc-pwa-card::before{content:\"\";position:absolute;left:-10px;top:58%;width:18px;height:18px;background:#0e7c7b;border-radius:4px 0 8px 0;box-shadow:-3px 4px 10px rgba(15,23,42,.08);transform:rotate(42deg)}" +
      "#" + ROOT_ID + " .nc-pwa-card::after{content:\"\";position:absolute;top:14px;left:28px;width:42px;height:18px;border-radius:50%;background:rgba(255,255,255,.7);pointer-events:none}" +
      "#" + ROOT_ID + " *{box-sizing:border-box}" +
      "#" + ROOT_ID + " .nc-pwa-close{position:absolute;top:10px;right:14px;z-index:2;width:1.25rem;height:1.25rem;padding:0;border:0;border-radius:999px;background:#f3f4f6;color:#6b7280;font-size:.9rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      "#" + ROOT_ID + " .nc-pwa-close:hover{background:#e5e7eb;color:#111827}" +
      "#" + ROOT_ID + " .nc-pwa-logo{width:42px;height:42px;border-radius:999px;object-fit:cover;box-shadow:0 2px 8px rgba(14,124,123,.22)}" +
      "#" + ROOT_ID + " .nc-pwa-title{margin:.35rem 0 0;color:#fff;font-family:\"Plus Jakarta Sans\",Inter,system-ui,sans-serif;font-size:.76rem;font-weight:800;line-height:1.2}" +
      "#" + ROOT_ID + " .nc-pwa-sub{margin:.12rem 0 0;color:rgba(255,255,255,.88);font-family:Inter,system-ui,sans-serif;font-size:.58rem;font-weight:600}" +
      "#" + ROOT_ID + " .nc-pwa-ios{display:none;margin:.22rem 0 0;max-width:8.5rem;color:rgba(255,255,255,.85);font-family:Inter,system-ui,sans-serif;font-size:.52rem;font-weight:500;line-height:1.3}" +
      "#" + ROOT_ID + "[data-ios=\"true\"] .nc-pwa-ios{display:block}" +
      "#" + ROOT_ID + " .nc-pwa-install{display:inline-flex;align-items:center;justify-content:center;width:5.75rem;margin-top:.35rem;padding:.3rem .65rem;border:0;border-radius:999px;background:#ff6b5b;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:.68rem;font-weight:800;cursor:pointer;box-shadow:0 8px 18px -8px rgba(255,107,91,.7)}" +
      "#" + ROOT_ID + " .nc-pwa-install:hover{transform:scale(1.03)}" +
      "#" + ROOT_ID + " .nc-pwa-install:active{transform:scale(.97)}" +
      "@keyframes nc-pwa-in{from{opacity:0;transform:translateY(10px) scale(.86)}to{opacity:1;transform:translateY(0) scale(1)}}" +
      "@keyframes nc-pwa-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}" +
      "@media (max-width:420px){#" + ROOT_ID + "{right:max(8px,env(safe-area-inset-right,0px))}#" + ROOT_ID + " .nc-pwa-card{width:148px;height:148px}}" +
      "@media (prefers-reduced-motion:reduce){#" + ROOT_ID + " .nc-pwa-card{animation:none}}";
    document.head.appendChild(style);
  }

  function hide() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  function show() {
    if (root || isStandalone()) return;
    if (!wantsForcedPreview() && wasDismissed()) return;
    if (!document.body) return;

    injectStyles();

    var ios = isIos();
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "nc-pwa";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Install NaliChat");
    if (ios) root.setAttribute("data-ios", "true");

    root.innerHTML =
      '<div class="nc-pwa-card">' +
        '<button type="button" class="nc-pwa-close" aria-label="Dismiss install prompt">&times;</button>' +
        '<img class="nc-pwa-logo" src="/favicon-192.png" width="56" height="56" alt="NaliChat">' +
        '<p class="nc-pwa-title">Install NaliChat</p>' +
        '<p class="nc-pwa-sub">Android • iPhone</p>' +
        '<p class="nc-pwa-ios">To install NaliChat:<br>Tap Share → Add to Home Screen</p>' +
        '<button type="button" class="nc-pwa-install">Install</button>' +
      "</div>";

    root.querySelector(".nc-pwa-close").addEventListener("click", function () {
      rememberDismiss();
      hide();
    });

    root.querySelector(".nc-pwa-install").addEventListener("click", function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") hide();
        }).catch(function () {});
        return;
      }
      if (ios) {
        var hint = root.querySelector(".nc-pwa-ios");
        if (hint) hint.style.display = "block";
      }
    });

    document.body.appendChild(root);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone() && (wantsForcedPreview() || !wasDismissed())) show();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hide();
  });

  function start() {
    registerServiceWorker();
    if (isStandalone()) return;
    if (!wantsForcedPreview() && wasDismissed()) return;
    if (isIos() || isLocalPreview() || wantsForcedPreview()) {
      window.setTimeout(show, 700);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
