/**
 * INEN 출시 스위치
 *
 * phase
 *   store-beta  스토어 설치 → 앱 가입 → 승인 대기 (현재)
 *   open-beta   오픈 베타 카피
 *   live        정식 스토어 출시 이후
 *
 * stores  App Store / Play / 테스터 그룹 링크
 *         링크가 비어 있으면 카드는 "준비 중"으로 보이고,
 *         값이 들어가면 즉시 다운로드 버튼이 살아납니다.
 */
window.InenLaunch = {
  phase: "store-beta",
  reserveUrl: "",
  caps: { male: 50, female: 50 },
  seed: { male: 0, female: 0 },
  stillAcceptWhenFull: true,
  stores: {
    ios: "",
    android: "",
    androidGroup: "",
  },
  paths: {
    landing: "index.html",
    home: "home.html",
    install: "install.html",
  },
};

(function () {
  const L = window.InenLaunch;
  const ja = document.documentElement.lang === "ja";

  function applyPhase() {
    const phase = L.phase === "store-beta" ? "open-beta" : L.phase;
    document.documentElement.dataset.phase = phase;
    document.querySelectorAll("[data-show]").forEach((el) => {
      const allowed = el.dataset.show.split(/\s+/);
      // store-beta uses open-beta / live visual slots plus store-beta-only blocks
      const ok =
        allowed.includes(L.phase) ||
        (L.phase === "store-beta" && (allowed.includes("open-beta") || allowed.includes("store-beta"))) ||
        (L.phase !== "store-beta" && allowed.includes(phase));
      el.hidden = !ok;
    });
    // Hide legacy reserve seats / forms in store-beta
    document.querySelectorAll("[data-legacy-reserve]").forEach((el) => {
      el.hidden = L.phase === "store-beta" || L.phase === "open-beta" || L.phase === "live";
    });
  }

  function wireStores() {
    document.querySelectorAll("[data-store-group]").forEach((el) => {
      el.hidden = !L.stores.androidGroup;
    });
    document.querySelectorAll("[data-store]").forEach((el) => {
      const url = L.stores[el.dataset.store];
      const soon = el.querySelector("[data-store-soon]");
      const ready = el.querySelector("[data-store-ready]");
      if (url) {
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.classList.remove("is-soon");
        if (soon) soon.hidden = true;
        if (ready) ready.hidden = false;
      } else {
        el.href = "#";
        el.classList.add("is-soon");
        if (soon) soon.hidden = false;
        if (ready) ready.hidden = true;
        el.addEventListener("click", (ev) => ev.preventDefault());
      }
    });
  }

  applyPhase();
  wireStores();
})();
