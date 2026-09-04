/**
 * INEN 출시 스위치
 *
 * phase 만 바꿔도 랜딩 문구가 바뀝니다.
 *   closed-beta  클로즈 베타 사전 예약 (남/여 각 50명 마감 표시)
 *   open-beta    오픈 베타 · 정식에 가까운 공개
 *   live         스토어 출시 이후
 *
 * reserveUrl  Google Apps Script 웹 앱 주소 (tools/inen-reserve.gs)
 */
window.InenLaunch = {
  phase: "closed-beta",
  reserveUrl: "https://script.google.com/macros/s/AKfycbyT37gfTxkVaVcQoP3sUoi3mDP69GLZ60HNljpS-f_8gtv8-mAuRFQIg34o7yzEQrY5/exec",
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
  const ja = document.documentElement.lang === "ja";
  const t = ja
    ? {
        closed: "満員",
        open: "募集中",
        noteBoth: "先着は満員です。お名前はキャンセル待ちに載せ、招待は順にお送りします。",
        noteMale: "男性の先着は満員です。男性はキャンセル待ちで受け付けます。",
        noteFemale: "女性の先着は満員です。女性はキャンセル待ちで受け付けます。",
        noteOpen: "男女それぞれ50名に達した時点で、その性別は満員と表示されます。",
        okWait: "先着はすでに埋まっています。キャンセル待ちに載せました。ご案内はメールでお送りします。",
        okSeat: "事前予約を受け付けました。確認メールをお送りしました。ストーリーへお進みください。",
        err: "予約を保存できませんでした。通信を確認して、もう一度お試しください。",
        sending: "送信しています…",
        submit: "予約してストーリーを見る",
      }
    : {
        closed: "모집 마감",
        open: "모집 중",
        noteBoth: "선착순은 마감되었습니다. 이름은 대기 명단에 올리고, 초대는 순차로 이어집니다.",
        noteMale: "남성 선착순은 마감되었습니다. 남성은 대기 명단으로 접수됩니다.",
        noteFemale: "여성 선착순은 마감되었습니다. 여성은 대기 명단으로 접수됩니다.",
        noteOpen: "남 · 여 각 50명 모집 시 해당 성별은 마감으로 표시됩니다.",
        okWait: "선착순은 이미 찼습니다. 대기 명단에 올렸고, 안내는 메일로 드립니다.",
        okSeat: "사전 예약이 접수되었습니다. 확인 메일을 보냈습니다. 이야기를 이어서 읽어 주세요.",
        err: "예약을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
        sending: "접수 중…",
        submit: "예약하고 이야기 보기",
      };

  let remote = { male: 0, female: 0 };

  function counts() {
    return {
      male: L.seed.male + remote.male,
      female: L.seed.female + remote.female,
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
      if (tag) tag.textContent = closed ? t.closed : t.open;
    });
    const note = document.getElementById("seat-note");
    if (!note) return;
    const both = now.male >= L.caps.male && now.female >= L.caps.female;
    if (both) {
      note.textContent = t.noteBoth;
    } else if (now.male >= L.caps.male) {
      note.textContent = t.noteMale;
    } else if (now.female >= L.caps.female) {
      note.textContent = t.noteFemale;
    } else {
      note.textContent = t.noteOpen;
    }
  }

  async function api(body) {
    if (!L.reserveUrl) throw new Error("no-endpoint");
    const res = await fetch(L.reserveUrl, {
      method: body ? "POST" : "GET",
      redirect: "follow",
      headers: body ? { "Content-Type": "text/plain;charset=utf-8" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data && data.error ? data.error : "fail");
    return data;
  }

  async function refreshCounts() {
    try {
      const data = await api();
      if (data.counts) remote = data.counts;
    } catch {
      /* 시트가 아직 연결되지 않으면 0으로 둡니다 */
    }
    paintSeats();
  }

  function wireReserve() {
    const form = document.getElementById("reserve-form");
    if (!form) return;
    const ok = document.getElementById("reserve-ok");
    const okCopy = document.getElementById("reserve-ok-copy");
    const err = document.getElementById("reserve-err");
    const btn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (err) err.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.company) {
        form.hidden = true;
        if (ok) ok.hidden = false;
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = t.sending;
      }
      try {
        const result = await api({
          name: data.name,
          email: data.email,
          gender: data.gender,
          nationality: data.nationality,
          lang: ja ? "ja" : "ko",
          page: location.href,
        });
        if (result.counts) remote = result.counts;
        form.hidden = true;
        if (ok) ok.hidden = false;
        if (okCopy) okCopy.textContent = result.status === "waitlist" ? t.okWait : t.okSeat;
        paintSeats();
      } catch {
        if (err) {
          err.hidden = false;
          err.textContent = t.err;
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = t.submit;
        }
      }
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
  refreshCounts();
  wireReserve();
  wireStores();
})();
