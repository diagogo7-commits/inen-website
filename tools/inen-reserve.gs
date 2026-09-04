/**
 * INEN 사전예약 수집
 *
 * 1) https://script.google.com 에서 새 프로젝트
 * 2) 이 파일을 붙여넣기
 * 3) OWNER_EMAIL 을 본인 지메일로 바꾸기
 * 4) 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 주체: 나
 *    - 액세스: 모든 사용자
 * 5) 나온 웹 앱 URL 을 js/launch.js 의 reserveUrl 에 넣기
 *
 * 명단은 Google 드라이브에 "INEN Reservations" 시트로 생깁니다.
 * 나중에 초대 메일을 보내려면 이 편집기에서 sendInvites 를 실행하세요.
 */
var OWNER_EMAIL = "";
var CAPS = { male: 50, female: 50 };

function doGet() {
  return json_({ ok: true, counts: counts_() });
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data.company) return json_({ ok: true, ignored: true, counts: counts_() });

    var name = String(data.name || "").trim();
    var email = String(data.email || "").trim().toLowerCase();
    var gender = data.gender === "female" ? "female" : data.gender === "male" ? "male" : "";
    var nationality = data.nationality === "jp" ? "jp" : data.nationality === "kr" ? "kr" : "";
    var lang = data.lang === "ja" ? "ja" : "ko";

    if (!name || !email || !gender || !nationality || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: "invalid" });
    }

    var now = counts_();
    var status = now[gender] >= CAPS[gender] ? "waitlist" : "seat";
    var sh = sheet_();
    sh.appendRow([
      new Date(),
      name,
      email,
      gender,
      nationality,
      lang,
      status,
      "",
      String(data.page || ""),
    ]);

    mailApplicant_(name, email, lang, status);
    mailOwner_(name, email, gender, nationality, status);

    return json_({ ok: true, status: status, counts: counts_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function sendInvites() {
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var sent = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][7]) continue;
    var email = rows[i][2];
    var name = rows[i][1];
    var lang = rows[i][5] === "ja" ? "ja" : "ko";
    if (!email) continue;
    if (lang === "ja") {
      MailApp.sendEmail({
        to: email,
        subject: "INEN クローズドβのご案内",
        body:
          name + " 様\n\n" +
          "INEN クローズドβの招待をご案内します。\n" +
          "ホーム: https://www.inen.co.kr/ja/home.html\n" +
          "アプリ: https://www.inen.co.kr/ja/install.html\n\n" +
          "INEN",
      });
    } else {
      MailApp.sendEmail({
        to: email,
        subject: "INEN 클로즈 베타 안내",
        body:
          name + " 님\n\n" +
          "INEN 클로즈 베타 초대를 안내드립니다.\n" +
          "홈: https://www.inen.co.kr/home.html\n" +
          "앱 설치: https://www.inen.co.kr/install.html\n\n" +
          "INEN",
      });
    }
    sh.getRange(i + 1, 8).setValue(new Date());
    sent++;
  }
  return sent;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SHEET_ID");
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create("INEN Reservations");
    props.setProperty("SHEET_ID", ss.getId());
    var created = ss.getSheets()[0];
    created.setName("reservations");
    created.appendRow(["시각", "이름", "이메일", "성별", "국적", "언어", "상태", "초대발송", "페이지"]);
    created.setFrozenRows(1);
  }
  var sh = ss.getSheetByName("reservations") || ss.getSheets()[0];
  return sh;
}

function counts_() {
  var sh = sheet_();
  var values = sh.getDataRange().getValues();
  var male = 0;
  var female = 0;
  for (var i = 1; i < values.length; i++) {
    if (values[i][3] === "male") male++;
    if (values[i][3] === "female") female++;
  }
  return { male: male, female: female };
}

function mailApplicant_(name, email, lang, status) {
  if (lang === "ja") {
    MailApp.sendEmail({
      to: email,
      subject: status === "waitlist" ? "INEN 事前予約（キャンセル待ち）" : "INEN 事前予約を受け付けました",
      body:
        name + " 様\n\n" +
        (status === "waitlist"
          ? "先着は埋まっています。キャンセル待ちに登録しました。順番が来ましたら、このメールへご案内します。\n\n"
          : "クローズドβの事前予約を受け付けました。招待が届きましたら、このメールへご案内します。\n\n") +
        "ストーリー: https://www.inen.co.kr/ja/home.html\n" +
        "INEN",
    });
    return;
  }
  MailApp.sendEmail({
    to: email,
    subject: status === "waitlist" ? "INEN 사전 예약 (대기)" : "INEN 사전 예약이 접수되었습니다",
    body:
      name + " 님\n\n" +
      (status === "waitlist"
        ? "선착순은 이미 찼습니다. 대기 명단에 올렸고, 순서가 되면 이 메일로 안내드립니다.\n\n"
        : "클로즈 베타 사전 예약이 접수되었습니다. 초대가 열리면 이 메일로 안내드립니다.\n\n") +
      "이야기: https://www.inen.co.kr/home.html\n" +
      "INEN",
  });
}

function mailOwner_(name, email, gender, nationality, status) {
  if (!OWNER_EMAIL) return;
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: "[INEN] 새 사전예약 " + name,
    body:
      "이름: " + name + "\n" +
      "이메일: " + email + "\n" +
      "성별: " + gender + "\n" +
      "국적: " + nationality + "\n" +
      "상태: " + status + "\n" +
      "시트: 드라이브에서 INEN Reservations",
  });
}
