/**
 * INEN 출시 스위치
 *
 * phase 만 바꿔도 랜딩 문구가 바뀝니다.
 *   closed-beta  클로즈 베타 사전 예약 (남/여 각 50명 마감 표시)
 *   open-beta    오픈 베타 · 정식에 가까운 공개
 *   live         스토어 출시 이후
 *
 * 순서
 *   1) phase: "closed-beta", stores 비워 둔 채 랜딩을 연다
 *   2) TestFlight / Play 내부테스트 URL이 생기면 stores.ios / stores.android 에 넣는다
 *   3) 선착순 표시가 찼어도 stillAcceptWhenFull 로 접수는 계속된다
 *   4) 공개 범위를 넓히면 phase: "open-beta"
 *   5) 스토어 심사가 끝나면 phase: "live"
 *
 * 경로: 랜딩 index.html → 홈 home.html → 설치 install.html
 */
window.InenLaunch = {
  phase: "closed-beta",
  caps: { male: 50, female: 50 },
  seed: { male: 0, female: 0 },
  stillAcceptWhenFull: true,
  stores: {
    ios: "",
    android: "",
  },
  paths: {
    landing: "index.html",
    home: "home.html",
    install: "install.html",
  },
};

(function () {
  const L = window.InenLaunch;
  const KEY = "inen-reservations";

  function reservations() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function counts() {
    const extra = { male: 0, female: 0 };
    reservations().forEach((row) => {
      if (row.gender === "male" || row.gender === "female") extra[row.gender] += 1;
    });
    return {
      male: L.seed.male + extra.male,
      female: L.seed.female + extra.female,
    };
  }

  function applyPhase() {
    document.documentElement.dataset.phase = L.phase;
    document.querySelectorAll("[data-show]").forEach((el) => {
      const allowed = el.dataset.show.split(/\s+/);
      el.hidden = !allowed.includes(L.phase);
    });
  }

  function paintSeats() {
    const now = counts();
    ["male", "female"].forEach((gender) => {
      const cap = L.caps[gender];
      const n = now[gender];
      const closed = n >= cap;
      const root = document.querySelector(`[data-seat="${gender}"]`);
      if (!root) return;
      const fill = root.querySelector("[data-seat-fill]");
      const num = root.querySelector("[data-seat-count]");
      const tag = root.querySelector("[data-seat-tag]");
      if (fill) fill.style.width = `${Math.min(100, (n / cap) * 100)}%`;
      if (num) num.textContent = `${Math.min(n, cap)} / ${cap}`;
      root.classList.toggle("is-closed", closed);
      if (tag) tag.textContent = closed ? "모집 마감" : "모집 중";
    });
    const note = document.getElementById("seat-note");
    if (!note) return;
    const both = now.male >= L.caps.male && now.female >= L.caps.female;
    if (both) {
      note.textContent = "선착순은 마감되었습니다. 이름은 대기 명단에 올리고, 초대는 순차로 이어집니다.";
    } else if (now.male >= L.caps.male) {
      note.textContent = "남성 선착순은 마감되었습니다. 남성은 대기 명단으로 접수됩니다.";
    } else if (now.female >= L.caps.female) {
      note.textContent = "여성 선착순은 마감되었습니다. 여성은 대기 명단으로 접수됩니다.";
    } else {
      note.textContent = "남 · 여 각 50명 모집 시 해당 성별은 마감으로 표시됩니다.";
    }
  }

  function wireReserve() {
    const form = document.getElementById("reserve-form");
    if (!form) return;
    const ok = document.getElementById("reserve-ok");
    const okCopy = document.getElementById("reserve-ok-copy");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const now = counts();
      const full = now[data.gender] >= L.caps[data.gender];
      const row = {
        ...data,
        status: full ? "waitlist" : "seat",
        phase: L.phase,
        at: new Date().toISOString(),
      };
      const list = reservations();
      list.push(row);
      localStorage.setItem(KEY, JSON.stringify(list));
      form.hidden = true;
      if (ok) ok.hidden = false;
      if (okCopy) {
        okCopy.textContent = full
          ? "선착순은 이미 찼습니다. 대기 명단에 올렸고, 초대가 열리면 메일로 알려 드립니다."
          : "사전 예약이 접수되었습니다. 이야기를 읽고, 설치 안내로 이어져 주세요.";
      }
      paintSeats();
    });
  }

  function wireStores() {
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
  paintSeats();
  wireReserve();
  wireStores();
})();
