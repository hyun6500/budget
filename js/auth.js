/* ===== js/auth.js ===== */
/* auth.js - 조회는 자유, 쓰기는 잠금.
   비밀번호는 앱에 저장하지 않고 서버가 확인한다. 10분이 지나면 다시 잠긴다. */
FILEV.auth = CONFIG.APP_VERSION;

const AUTH = { token: "", until: 0 };
const authAlive = () => AUTH.token && Date.now() < AUTH.until;

function authTouch() { if (AUTH.token) AUTH.until = Date.now() + 10 * 60 * 1000; paintLock(); }
function authLock() {
  AUTH.token = ""; AUTH.until = 0;
  A.data = null; A.loaded = false; A.denied = false;   /* 자산은 잠기면 화면에서도 지운다 */
  paintLock();
  if (S.tab === "asset") renderAsset();
  toast("잠갔습니다");
}

function paintLock() {
  const b = $("#lockBtn"); if (!b) return;
  const on = authAlive();
  b.textContent = on ? "열림" : "잠김";
  b.classList.toggle("open", on);
  b.title = on ? "누르면 다시 잠깁니다" : "편집하려면 비밀번호를 넣으세요";
}

/** 쓰기 직전에 부른다. 통과하면 true */
async function ensureAuth() {
  if (authAlive()) { authTouch(); return true; }
  const pw = await askPw();
  if (pw == null) return false;
  try {
    const j = await post("login", { pw });
    AUTH.token = j.token; authTouch();
    toast("편집을 열었습니다");
    return true;
  } catch (e) { toast("비밀번호가 맞지 않습니다"); return false; }
}

function askPw() {
  return new Promise(resolve => {
    openModal(
      '<h2 style="font-size:16px;margin-bottom:4px">편집 잠금 풀기</h2>' +
      '<p style="font-size:12.5px;color:var(--ink2);margin:0 0 14px">비밀번호를 넣으면 10분 동안 기록을 더하거나 고칠 수 있습니다.</p>' +
      '<div class="form"><div class="fl"><span>비밀번호</span>' +
      '<input id="pwIn" type="password" inputmode="numeric" autocomplete="current-password"></div>' +
      '<button class="btn" id="pwGo">열기</button>' +
      '<button class="btn ghost" id="pwNo">그만두기</button></div>',
      () => resolve(null)
    );
    const go = () => { const v = $("#pwIn").value.trim(); closeModal(true); resolve(v || null); };
    $("#pwGo").onclick = go;
    $("#pwIn").onkeydown = e => { if (e.key === "Enter") go(); };
    $("#pwNo").onclick = () => { closeModal(true); resolve(null); };
    setTimeout(() => $("#pwIn").focus(), 60);
  });
}

/* ---------- 모달 ---------- */
let _onClose = null;
function openModal(html, onClose) {
  _onClose = onClose || null;
  $("#modalBody").innerHTML = html;
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal(silent) {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
  const f = _onClose; _onClose = null;
  if (f && !silent) f();
}
