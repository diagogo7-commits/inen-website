import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const REJECT_REASONS = ["사진 부적격", "교회 정보 미흡", "프로필 정보 미흡", "자기소개 미흡", "허위 정보 의심", "가이드라인 위반"];
const ADMIN_EMAIL = window.InenAdminEmail || "ineninfo@gmail.com";
const root = document.getElementById("root");
const tabsEl = document.getElementById("tabs");
const whoEl = document.getElementById("who");

const data = {
  reservations: [],
  reviews: [],
  profiles: {},
  priv: {},
  photos: {},
  reports: [],
  feedback: [],
  errors: [],
  matches: 0,
  likes: 0,
};
let tab = "summary";
let resFilter = "all";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const when = (at) => {
  if (!at) return "";
  const d = new Date(Number(at));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const sourceOf = (page) => {
  try {
    const p = new URL(page).searchParams;
    return p.get("utm_source") || p.get("from") || "직접";
  } catch {
    return "직접";
  }
};

const genderLabel = (g) => (g === "female" ? "여성" : g === "male" ? "남성" : "-");
const statusPill = (s) => {
  const cls = s === "승인됨" ? "ok" : s === "거절됨" ? "no" : "wait";
  return `<span class="pill ${cls}">${esc(s || "작성 중")}</span>`;
};
const safeImg = (src) => (/^data:image\/(jpeg|png|webp);base64,/.test(String(src)) || /^https:\/\//.test(String(src)) ? src : "");

function ageOf(year, month, day) {
  const y = Number(year);
  if (!y) return "";
  const m = parseInt(month, 10) || 1;
  const d = parseInt(day, 10) || 1;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

const ageBandOf = (age) => (age ? `${Math.floor(age / 10) * 10}대 ${age % 10 < 5 ? "초" : "후"}` : "40대 이상");

if (!window.InenFirebaseConfig) {
  root.innerHTML = `<div class="card login"><h2>설정이 필요합니다</h2><p class="muted">website/js/firebase-config.js 에 Firebase 설정값을 붙여 넣은 뒤 다시 배포해 주세요.</p></div>`;
  throw new Error("no firebase config");
}

const app = initializeApp(window.InenFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const list = async (name, ...constraints) => {
  const snap = await getDocs(constraints.length ? query(collection(db, name), ...constraints) : collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

function loginView(message = "") {
  tabsEl.hidden = true;
  whoEl.textContent = "";
  root.innerHTML = `
    <form class="card login" id="login">
      <h2>관리자 로그인</h2>
      <p class="muted">${esc(ADMIN_EMAIL)} 계정으로만 열립니다.</p>
      <input name="email" type="email" value="${esc(ADMIN_EMAIL)}" autocomplete="username" required />
      <input name="password" type="password" placeholder="비밀번호" autocomplete="current-password" required />
      <button class="btn dark" type="submit">로그인</button>
      <button class="btn" type="button" id="create-admin">처음이면 관리자 계정 만들기</button>
      <p class="muted" id="login-msg">${esc(message)}</p>
    </form>`;
  const form = document.getElementById("login");
  const msg = document.getElementById("login-msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
    } catch (err) {
      msg.textContent = `로그인 실패: ${err.code || err.message}`;
    }
  });
  document.getElementById("create-admin").addEventListener("click", async () => {
    if (form.password.value.length < 8) {
      msg.textContent = "비밀번호를 8자 이상 입력한 뒤 눌러 주세요.";
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      await sendEmailVerification(cred.user);
      msg.textContent = "계정을 만들고 인증 메일을 보냈습니다. 메일의 링크를 누른 뒤 이 페이지를 새로고침해 주세요.";
    } catch (err) {
      msg.textContent = `만들기 실패: ${err.code || err.message}`;
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView();
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    loginView("관리자 계정이 아닙니다.");
    return;
  }
  await user.reload();
  if (!auth.currentUser.emailVerified) {
    root.innerHTML = `<div class="card login"><h2>이메일 인증이 필요합니다</h2>
      <p class="muted">${esc(user.email)} 로 보낸 인증 메일의 링크를 누른 뒤 새로고침해 주세요.</p>
      <button class="btn" id="resend">인증 메일 다시 보내기</button> <button class="btn" id="out">로그아웃</button></div>`;
    document.getElementById("resend").onclick = () => sendEmailVerification(auth.currentUser).then(() => alert("보냈습니다."));
    document.getElementById("out").onclick = () => signOut(auth);
    return;
  }
  await auth.currentUser.getIdToken(true);
  whoEl.innerHTML = `${esc(user.email)} · <button class="btn" id="logout">로그아웃</button>`;
  document.getElementById("logout").onclick = () => signOut(auth);
  await loadAll();
});

async function loadAll() {
  root.innerHTML = `<p class="muted">데이터를 불러오는 중…</p>`;
  try {
    const [reservations, reviews, profiles, priv, reports, feedback, errors, matches, likes] = await Promise.all([
      list("reservations").catch(() => []),
      list("reviews"),
      list("profiles"),
      list("private"),
      list("reports").catch(() => []),
      list("feedback").catch(() => []),
      list("errors", orderBy("at", "desc"), limit(300)).catch(() => []),
      list("matches").catch(() => []),
      list("likes").catch(() => []),
    ]);
    data.reservations = reservations.sort((a, b) => (b.at || 0) - (a.at || 0));
    data.reviews = reviews.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    data.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
    data.priv = Object.fromEntries(priv.map((p) => [p.id, p]));
    data.reports = reports.sort((a, b) => (b.at || 0) - (a.at || 0));
    data.feedback = feedback.sort((a, b) => (b.at || 0) - (a.at || 0));
    data.errors = errors;
    data.matches = matches.length;
    data.likes = likes.length;
    paint();
  } catch (err) {
    root.innerHTML = `<div class="card"><h2>불러오지 못했습니다</h2><p class="muted">${esc(err.code || err.message)}</p>
      <p class="muted">Firestore 보안 규칙(firestore.rules)이 배포되었는지, 관리자 이메일 인증이 끝났는지 확인해 주세요.</p></div>`;
  }
}

function pendingReviews() {
  return data.reviews.filter((r) => r.status === "대기중");
}

function pendingRevisions() {
  return data.reviews.filter((r) => r.status === "승인됨" && r.revision?.status === "대기중");
}

function paint() {
  const tabs = [
    ["summary", "요약"],
    ["reservations", "사전예약", data.reservations.filter((r) => r.status === "new").length],
    ["review", "가입 심사", pendingReviews().length + pendingRevisions().length],
    ["members", "회원"],
    ["reports", "신고", data.reports.filter((r) => !r.done).length],
    ["feedback", "의견", data.feedback.filter((r) => !r.done).length],
    ["errors", "오류"],
  ];
  tabsEl.hidden = false;
  tabsEl.innerHTML =
    tabs
      .map(([id, label, n]) => `<button data-tab="${id}" class="${tab === id ? "on" : ""}">${label}${n ? `<em>${n}</em>` : ""}</button>`)
      .join("") + `<button data-reload="1">새로고침</button>`;
  const views = { summary, reservations, review, members, reports, feedback, errors };
  root.innerHTML = views[tab]();
}

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.reload) {
    loadAll();
    return;
  }
  tab = btn.dataset.tab;
  paint();
  if (tab === "review") loadPhotosFor(pendingReviews().concat(pendingRevisions()).map((r) => r.id));
});

function summary() {
  const res = data.reservations;
  const by = (arr, fn) => arr.filter(fn).length;
  const members = data.reviews;
  const approvedM = members.filter((r) => r.status === "승인됨" && data.profiles[r.id]?.gender === "male").length;
  const approvedF = members.filter((r) => r.status === "승인됨" && data.profiles[r.id]?.gender === "female").length;
  const dayAgo = Date.now() - 86400000;
  const stat = (label, value, sub = "") => `<div class="card stat"><small>${label}</small><b>${value}</b><small>${sub}</small></div>`;
  return `
    <div class="grid">
      ${stat("사전예약", res.length, `남 ${by(res, (r) => r.gender === "male")} · 여 ${by(res, (r) => r.gender === "female")} · 한국 ${by(res, (r) => r.nationality === "kr")} · 일본 ${by(res, (r) => r.nationality === "jp")}`)}
      ${stat("가입 심사 대기", pendingReviews().length, `재승인 대기 ${pendingRevisions().length}`)}
      ${stat("승인된 회원", approvedM + approvedF, `남 ${approvedM} · 여 ${approvedF}`)}
      ${stat("거절", by(members, (r) => r.status === "거절됨"))}
      ${stat("보낸 호감", data.likes)}
      ${stat("매칭", data.matches)}
      ${stat("미처리 신고", by(data.reports, (r) => !r.done))}
      ${stat("새 의견", by(data.feedback, (r) => !r.done))}
      ${stat("오류 (24시간)", by(data.errors, (r) => (r.at || 0) > dayAgo))}
    </div>
    <div class="card">
      <h3>사전예약 유입 경로</h3>
      <p class="muted">${
        Object.entries(res.reduce((acc, r) => ({ ...acc, [sourceOf(r.page)]: (acc[sourceOf(r.page)] || 0) + 1 }), {}))
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${esc(k)} ${n}명`)
          .join(" · ") || "아직 신청이 없습니다."
      }</p>
    </div>
    <div class="card">
      <h3>클로즈 베타 운영 순서</h3>
      <ol class="muted">
        <li>사전예약 탭에서 신청자를 확인하고, Apps Script 의 sendInvites 로 초대 메일을 보냅니다.</li>
        <li>신청자가 앱에서 가입하면 가입 심사 탭에 올라옵니다. 사진과 교회 정보를 보고 승인 또는 거절합니다.</li>
        <li>신고 · 의견 · 오류 탭을 매일 확인하고, 처리한 항목은 완료로 표시합니다.</li>
      </ol>
    </div>`;
}

function joinedEmails() {
  const set = new Set();
  data.reviews.forEach((r) => r.email && set.add(String(r.email).toLowerCase()));
  Object.values(data.priv).forEach((p) => p.email && set.add(String(p.email).toLowerCase()));
  return set;
}

function reservations() {
  const joined = joinedEmails();
  const rows = data.reservations.filter((r) =>
    resFilter === "all" ? true : resFilter === "joined" ? joined.has(String(r.email).toLowerCase()) : r.status === resFilter || r.gender === resFilter
  );
  return `
    <div class="tools">
      <select id="res-filter">
        ${[["all", "전체"], ["new", "새 신청"], ["invited", "초대함"], ["joined", "앱 가입함"], ["male", "남성"], ["female", "여성"]]
          .map(([v, l]) => `<option value="${v}" ${resFilter === v ? "selected" : ""}>${l}</option>`)
          .join("")}
      </select>
      <span class="muted">${rows.length}명</span>
      <button class="btn" id="res-csv">CSV 내려받기</button>
      <span class="muted">시트 원본: Google 드라이브 “INEN Reservations” · 초대 메일은 Apps Script 의 sendInvites</span>
    </div>
    <table>
      <tr><th>신청 시각</th><th>이름</th><th>이메일</th><th>성별</th><th>국적</th><th>언어</th><th>유입 경로</th><th>선착순</th><th>상태</th><th>앱 가입</th><th></th></tr>
      ${rows
        .map(
          (r) => `<tr>
          <td>${when(r.at)}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${genderLabel(r.gender)}</td>
          <td>${r.nationality === "jp" ? "일본" : r.nationality === "kr" ? "한국" : "-"}</td><td>${esc(r.lang)}</td>
          <td>${esc(sourceOf(r.page))}</td>
          <td>${r.seat === "waitlist" ? "대기" : r.seat === "seat" ? "선착순" : "-"}</td>
          <td>${r.status === "invited" ? '<span class="pill ok">초대함</span>' : '<span class="pill wait">새 신청</span>'}</td>
          <td>${joined.has(String(r.email).toLowerCase()) ? "✓" : ""}</td>
          <td><button class="btn" data-res="${esc(r.id)}" data-next="${r.status === "invited" ? "new" : "invited"}">${r.status === "invited" ? "되돌리기" : "초대함 표시"}</button></td>
        </tr>`
        )
        .join("")}
    </table>`;
}

function csv(rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function loadPhotosFor(ids) {
  const missing = ids.filter((id) => !data.photos[id]);
  if (!missing.length) return;
  await Promise.all(
    missing.map(async (id) => {
      const snap = await getDoc(doc(db, "photos", id)).catch(() => null);
      data.photos[id] = snap?.exists() ? snap.data().list || [] : [];
    })
  );
  if (tab === "review" || tab === "members") paint();
}

function photosHtml(list) {
  const imgs = (list || []).map(safeImg).filter(Boolean);
  if (!imgs.length) return `<p class="muted">사진 불러오는 중…</p>`;
  return `<div class="photos">${imgs.map((src) => `<img src="${src}" alt="" data-zoom="1" />`).join("")}</div>`;
}

function memberFacts(id) {
  const p = data.profiles[id] || {};
  const v = data.priv[id] || {};
  const r = data.reviews.find((x) => x.id === id) || {};
  const rows = [
    ["닉네임", p.nickname],
    ["성별", genderLabel(p.gender)],
    ["본명", v.realName],
    ["생년월일", [v.year, v.month, v.day].filter(Boolean).join(" ")],
    ["나이", v.age ? `${v.age}세 (${p.ageBand || ""})` : p.ageBand],
    ["국가 · 도시", [p.country, p.city].filter(Boolean).join(" · ")],
    ["교단", p.denom],
    ["직업", p.job],
    ["교회", v.churchName],
    ["담임목사", v.pastorName],
    ["교회 지역", v.churchRegion],
    ["Kakao / LINE", [v.kakao, v.line].filter(Boolean).join(" / ")],
    ["이메일", r.email || v.email],
    ["언어", (p.langs || []).join(", ")],
    ["이용 목적", [p.purpose, p.kids].filter(Boolean).join(" · ")],
    ["신앙 소개", p.quote],
    ["자기 소개", p.about],
    ["신청", `${when(r.submittedAt)} · ${esc(r.platform || "")} ${esc(r.version || "")}`],
  ];
  return `<dl>${rows.map(([k, val]) => `<dt>${k}</dt><dd>${k === "신청" ? val : esc(val || "-")}</dd>`).join("")}</dl>`;
}

function reasonsHtml(id) {
  return `<div class="reasons">${REJECT_REASONS.map(
    (r) => `<label><input type="checkbox" name="reason-${esc(id)}" value="${esc(r)}" /> ${esc(r)}</label>`
  ).join("")}</div>`;
}

function review() {
  const items = pendingReviews();
  const revs = pendingRevisions();
  if (!items.length && !revs.length) return `<div class="card"><h3>심사할 신청이 없습니다</h3><p class="muted">새 가입 신청이 오면 여기에 올라옵니다.</p></div>`;
  return `
    ${items
      .map(
        (r) => `<div class="card app">
        <div>${photosHtml(data.photos[r.id])}</div>
        <div>
          <h3>${esc(data.profiles[r.id]?.nickname || r.nickname)} ${statusPill(r.status)}</h3>
          ${memberFacts(r.id)}
          ${reasonsHtml(r.id)}
          <button class="btn ok" data-approve="${esc(r.id)}">승인</button>
          <button class="btn no" data-reject="${esc(r.id)}">거절 (사유 선택)</button>
        </div>
      </div>`
      )
      .join("")}
    ${revs
      .map((r) => {
        const rev = r.revision;
        const v = data.priv[r.id] || {};
        const p = data.profiles[r.id] || {};
        const row = (label, before, after) =>
          String(before || "") === String(after || "")
            ? ""
            : `<dt>${label}</dt><dd class="diff"><del>${esc(before || "-")}</del> → <ins>${esc(after || "-")}</ins></dd>`;
        return `<div class="card app">
          <div>${photosHtml(rev.photos)}<p class="muted">새 메인 사진</p></div>
          <div>
            <h3>${esc(p.nickname)} <span class="pill wait">프로필 재승인</span></h3>
            <dl>
              ${row("본명", v.realName, rev.realName)}
              ${row("생년월일", [v.year, v.month, v.day].join(" "), [rev.year, rev.month, rev.day].join(" "))}
              ${row("국가", p.country, rev.country)}
              ${row("도시", p.city, rev.city)}
              ${row("교단", p.denom, rev.denom)}
              ${row("교회", v.churchName, rev.churchName)}
              ${row("담임목사", v.pastorName, rev.pastorName)}
              ${row("교회 지역", v.churchRegion, rev.churchRegion)}
              <dt>요청 항목</dt><dd>${esc((rev.changed || []).join(", "))}</dd>
              <dt>요청 시각</dt><dd>${when(rev.at)}</dd>
            </dl>
            ${reasonsHtml(`rev-${r.id}`)}
            <button class="btn ok" data-rev-approve="${esc(r.id)}">변경 승인</button>
            <button class="btn no" data-rev-reject="${esc(r.id)}">변경 거절</button>
          </div>
        </div>`;
      })
      .join("")}`;
}

function members() {
  return `
    <table>
      <tr><th>신청</th><th>닉네임</th><th>성별</th><th>본명</th><th>교회</th><th>이메일</th><th>상태</th><th></th></tr>
      ${data.reviews
        .map((r) => {
          const p = data.profiles[r.id] || {};
          const v = data.priv[r.id] || {};
          return `<tr>
            <td>${when(r.submittedAt)}</td><td>${esc(p.nickname || r.nickname)}</td><td>${genderLabel(p.gender)}</td>
            <td>${esc(v.realName)}</td><td>${esc(v.churchName)}</td><td>${esc(r.email || v.email)}</td>
            <td>${statusPill(r.status)} ${r.rejectReasons?.length ? `<small class="muted">${esc(r.rejectReasons.join(", "))}</small>` : ""}</td>
            <td>${
              r.status === "승인됨"
                ? `<button class="btn no" data-revoke="${esc(r.id)}">승인 취소</button>`
                : `<button class="btn ok" data-approve="${esc(r.id)}">승인</button>`
            }</td>
          </tr>`;
        })
        .join("")}
    </table>`;
}

function nameOf(uid) {
  const p = data.profiles[uid];
  const r = data.reviews.find((x) => x.id === uid);
  return `${esc(p?.nickname || "?")} <small class="muted">${esc(r?.email || data.priv[uid]?.email || uid)}</small>`;
}

function reports() {
  if (!data.reports.length) return `<div class="card"><h3>신고가 없습니다</h3></div>`;
  return `
    <table>
      <tr><th>시각</th><th>신고한 회원</th><th>신고 대상</th><th>화면</th><th>상태</th><th></th></tr>
      ${data.reports
        .map(
          (r) => `<tr>
          <td>${when(r.at)}</td><td>${nameOf(r.from)}</td><td>${nameOf(r.target)}</td><td>${esc(r.view)}${r.matchId ? " · 대화 중" : ""}</td>
          <td>${r.done ? '<span class="pill ok">처리함</span>' : '<span class="pill wait">미처리</span>'}</td>
          <td>
            <button class="btn" data-done="reports/${esc(r.id)}" data-value="${r.done ? "0" : "1"}">${r.done ? "되돌리기" : "처리 완료"}</button>
            <button class="btn no" data-revoke="${esc(r.target)}">대상 승인 취소</button>
          </td>
        </tr>`
        )
        .join("")}
    </table>`;
}

function feedback() {
  if (!data.feedback.length) return `<div class="card"><h3>받은 의견이 없습니다</h3></div>`;
  const kind = { bug: "오류", idea: "개선 의견", other: "기타" };
  return data.feedback
    .map(
      (f) => `<div class="card">
      <div class="tools">
        <span class="pill ${f.kind === "bug" ? "no" : "wait"}">${kind[f.kind] || "기타"}</span>
        <b>${esc(f.nickname || "")}</b><span class="muted">${esc(f.email || "")} · ${when(f.at)} · ${esc(f.platform || "")} · v${esc(f.version || "")} · 화면 ${esc(f.view || "")}</span>
        <button class="btn" style="margin-left:auto" data-done="feedback/${esc(f.id)}" data-value="${f.done ? "0" : "1"}">${f.done ? "되돌리기" : "확인함"}</button>
      </div>
      <p class="msg">${esc(f.text)}</p>
    </div>`
    )
    .join("");
}

function errors() {
  if (!data.errors.length) return `<div class="card"><h3>기록된 오류가 없습니다</h3></div>`;
  const groups = new Map();
  data.errors.forEach((e) => {
    const key = `${e.where}|${e.message}`;
    const g = groups.get(key) || { ...e, count: 0, users: new Set(), last: 0 };
    g.count += 1;
    if (e.uid) g.users.add(e.uid);
    g.last = Math.max(g.last, e.at || 0);
    groups.set(key, g);
  });
  return `
    <p class="muted">최근 ${data.errors.length}건을 같은 오류끼리 묶었습니다.</p>
    <table>
      <tr><th>마지막</th><th>횟수</th><th>사용자</th><th>위치</th><th>메시지</th><th>화면 · 기기</th></tr>
      ${[...groups.values()]
        .sort((a, b) => b.last - a.last)
        .map(
          (g) => `<tr>
          <td>${when(g.last)}</td><td>${g.count}</td><td>${g.users.size}</td><td>${esc(g.where)}</td>
          <td><details><summary>${esc(g.message)}</summary><pre class="msg muted">${esc(g.stack)}</pre></details></td>
          <td>${esc(g.view)} · ${esc(g.platform)} v${esc(g.version)}</td>
        </tr>`
        )
        .join("")}
    </table>`;
}

function checkedReasons(name) {
  return [...document.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map((i) => i.value);
}

async function approve(uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, "reviews", uid), { status: "승인됨", rejectReasons: [], reviewedAt: Date.now() });
  batch.set(doc(db, "profiles", uid), { approved: true }, { merge: true });
  await batch.commit();
}

async function reject(uid, reasons) {
  const batch = writeBatch(db);
  batch.update(doc(db, "reviews", uid), { status: "거절됨", rejectReasons: reasons, reviewedAt: Date.now() });
  batch.set(doc(db, "profiles", uid), { approved: false }, { merge: true });
  await batch.commit();
}

async function approveRevision(uid) {
  const r = data.reviews.find((x) => x.id === uid);
  const rev = r.revision;
  const age = ageOf(rev.year, rev.month, rev.day);
  const current = (await getDoc(doc(db, "photos", uid))).data()?.list || [];
  const photos = [...current];
  (rev.photos || []).slice(0, 2).forEach((src, i) => {
    if (safeImg(src)) photos[i] = src;
  });
  const batch = writeBatch(db);
  batch.set(
    doc(db, "private", uid),
    {
      realName: rev.realName || "",
      year: rev.year || "",
      month: rev.month || "",
      day: rev.day || "",
      age,
      churchName: rev.churchName || "",
      pastorName: rev.pastorName || "",
      churchRegion: rev.churchRegion || "",
    },
    { merge: true }
  );
  batch.set(doc(db, "profiles", uid), { country: rev.country || "", city: rev.city || "", denom: rev.denom || "", ageBand: ageBandOf(age) }, { merge: true });
  batch.set(doc(db, "photos", uid), { list: photos.filter(Boolean).slice(0, 6) });
  batch.update(doc(db, "reviews", uid), { "revision.status": "승인됨", "revision.reviewedAt": Date.now() });
  await batch.commit();
}

root.addEventListener("change", (e) => {
  if (e.target.id === "res-filter") {
    resFilter = e.target.value;
    paint();
  }
});

root.addEventListener("click", async (e) => {
  const img = e.target.closest("[data-zoom]");
  if (img) {
    const zoom = document.getElementById("zoom");
    zoom.querySelector("img").src = img.src;
    zoom.style.display = "flex";
    return;
  }
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.id === "res-csv") {
    const joined = joinedEmails();
    download(
      `inen-reservations-${new Date().toISOString().slice(0, 10)}.csv`,
      csv([
        ["신청 시각", "이름", "이메일", "성별", "국적", "언어", "유입 경로", "선착순", "상태", "앱 가입"],
        ...data.reservations.map((r) => [when(r.at), r.name, r.email, genderLabel(r.gender), r.nationality, r.lang, sourceOf(r.page), r.seat, r.status, joined.has(String(r.email).toLowerCase()) ? "Y" : ""]),
      ])
    );
    return;
  }
  const run = async (fn, okMsg) => {
    btn.disabled = true;
    try {
      await fn();
      if (okMsg) console.info(okMsg);
      await loadAll();
    } catch (err) {
      alert(`실패했습니다: ${err.code || err.message}`);
      btn.disabled = false;
    }
  };
  if (btn.dataset.res) {
    await run(() => updateDoc(doc(db, "reservations", btn.dataset.res), { status: btn.dataset.next }));
    return;
  }
  if (btn.dataset.approve) {
    await run(() => approve(btn.dataset.approve));
    return;
  }
  if (btn.dataset.reject) {
    const reasons = checkedReasons(`reason-${btn.dataset.reject}`);
    if (!reasons.length) {
      alert("거절 사유를 하나 이상 골라 주세요.");
      return;
    }
    await run(() => reject(btn.dataset.reject, reasons));
    return;
  }
  if (btn.dataset.revoke) {
    const reason = prompt("승인을 취소하는 사유를 적어 주세요. 회원에게 그대로 보입니다.", "가이드라인 위반");
    if (!reason) return;
    await run(() => reject(btn.dataset.revoke, [reason]));
    return;
  }
  if (btn.dataset.revApprove) {
    await run(() => approveRevision(btn.dataset.revApprove));
    return;
  }
  if (btn.dataset.revReject) {
    const reasons = checkedReasons(`reason-rev-${btn.dataset.revReject}`);
    if (!reasons.length) {
      alert("거절 사유를 하나 이상 골라 주세요.");
      return;
    }
    await run(() =>
      updateDoc(doc(db, "reviews", btn.dataset.revReject), {
        "revision.status": "거절됨",
        "revision.rejectReasons": reasons,
        "revision.reviewedAt": Date.now(),
      })
    );
    return;
  }
  if (btn.dataset.done) {
    const [col, id] = btn.dataset.done.split("/");
    await run(() => updateDoc(doc(db, col, id), { done: btn.dataset.value === "1", doneAt: Date.now() }));
  }
});

document.getElementById("zoom").addEventListener("click", (e) => {
  e.currentTarget.style.display = "none";
});
