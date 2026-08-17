/* ===== js/config.js ===== */
/* 개인 설정. 이 파일만 채우면 앱이 돕니다. */
const CONFIG = {
  // 가계부 구글시트 ID (주소의 /d/ 와 /edit 사이 문자열)
  SHEET_ID: "1AWHmkn0TH_zayTLbRBmMNvNDP4KaJoZ9888JCEsBbVI",

  // 자산 포트폴리오 시트 ID 는 여기에 두지 않습니다.
  // 이 파일은 GitHub Pages 에 그대로 올라가 누구나 볼 수 있기 때문입니다.
  // 그 ID 는 Apps Script 의 스크립트 속성(PORTFOLIO_ID)에 넣습니다.

  // Apps Script 웹앱 주소. [배포 > 배포 관리]의 복사 아이콘으로 가져오세요. /exec 로 끝납니다
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz3woCJblApRjF2ErlafX7Y-f2R1ltE0dlB4w6X9pNsqfp0iPihW8hY0_hRvfgMsqn4/exec",

  // 시트 이름
  SHEET_NAME: "입력",
  META_SHEET: "분류표",

  // 화면 파일 버전. Code.gs 를 고칠 때만 SERVER_EXPECTED 를 올립니다
  APP_VERSION: "v2.0",
  SERVER_EXPECTED: "2",

  OWNER: "주현",

  // 자산 탭은 비밀번호를 넣어야 열립니다. false 로 두면 조회도 잠깁니다
  ASSET_NEEDS_AUTH: true,

  // 카드 캐시백은 별도 앱이 정본입니다. 자산 탭에서 링크로만 잇습니다
  CARD_APP_URL: "https://hyun6500.github.io/card/",
};
