/* ===== js/config.js ===== */
/* 개인 설정. 채울 곳은 APPS_SCRIPT_URL 하나뿐입니다.
   시트 ID, 비밀번호, Gemini 키는 전부 Apps Script 의 Code.gs 에 있습니다.
   이 파일은 GitHub Pages 에 그대로 올라가 누구나 볼 수 있기 때문입니다. */
const CONFIG = {
  // Apps Script 웹 앱 주소.
  //   [배포 > 배포 관리] 를 열면 오른쪽에 [웹 앱] 칸과 [라이브러리] 칸이 따로 있습니다.
  //   [웹 앱] 칸 아래 URL 옆의 복사 단추로 가져오세요. 라이브러리 쪽이 아닙니다.
  //   맞는 모양: https://script.google.com/macros/s/AKfycb.../exec
  //   틀린 모양: https://script.google.com/macros/library/d/...   (라이브러리)
  //             AKfycb...                                        (배포 ID)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyqKheI47Vahw_8P_4j6IKi223UhCASM1LKtsprKacJ9JLg2uD7k0EW_H1OMw-pTO8dSg/exec",

  // 화면 파일 버전. Code.gs 를 고칠 때만 SERVER_EXPECTED 를 올립니다
  APP_VERSION: "v2.4.1",
  SERVER_EXPECTED: "3",

  OWNER: "주현",

  // 자산 탭은 비밀번호를 넣어야 열립니다. false 로 두면 조회도 잠깁니다
  ASSET_NEEDS_AUTH: true,

  // 카드 캐시백은 별도 앱이 정본입니다. 자산 탭에서 링크로만 잇습니다
  CARD_APP_URL: "https://hyun6500.github.io/card/",
};
