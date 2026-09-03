const ja = document.documentElement.lang === "ja";
const nav = document.getElementById("nav");
const menu = document.getElementById("menu");
const links = document.getElementById("nav-links");
const form = document.getElementById("wait-form");
const ok = document.getElementById("form-ok");

if (nav) {
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? (ja ? "メニューを閉じる" : "메뉴 닫기") : ja ? "メニューを開く" : "메뉴 열기");
    document.body.style.overflow = open ? "hidden" : "";
  });
}

if (links) {
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menu?.setAttribute("aria-expanded", "false");
      menu?.setAttribute("aria-label", ja ? "メニューを開く" : "메뉴 열기");
      document.body.style.overflow = "";
    });
  });
}

document.querySelectorAll(".nav-lang a").forEach((a) => {
  a.addEventListener("click", (e) => {
    const hash = location.hash;
    if (!hash) return;
    const href = a.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    location.href = href.split("#")[0] + hash;
  });
});

if (form && ok) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const list = JSON.parse(localStorage.getItem("inen-waitlist") || "[]");
    list.push({ ...data, at: new Date().toISOString() });
    localStorage.setItem("inen-waitlist", JSON.stringify(list));
    form.reset();
    ok.hidden = false;
  });
}
