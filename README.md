# 주현 장부 v2 (나눈 판)

가계부와 자산을 한 앱에서 봅니다. 구글시트 두 장을 DB로 쓰고 GitHub Pages 에 올리는 정적 앱입니다.

한 파일로 합친 판(`가계부앱_v2_한파일.html`)과 내용이 같습니다. 고칠 때는 이쪽을, 급히 열어 볼 때는 한 파일판을 쓰세요.

## 파일

```
ledger/
  index.html            화면 뼈대. 여기에는 골격과 script 태그만 있습니다
  css/
    style.css           디자인 토큰과 전체 스타일
  js/
    config.js           개인 설정. 여기만 채우면 앱이 돕니다
    core.js             불러오기, 줄 만들기, 달 집계, 잔손
    core-asset.js       자산 저장고, 읽어 주는 말, 물가지수, 고정비
    widgets.js          이중 막대, 순위 목록, 달별 그림, 도넛, 달력
    widgets-extra.js    세그먼트, 잔디, 꺾은선, 막대, 자산 트리 줄
    charts.js           쌓은 막대, 갈라지는 막대, 산점도, 만기 타임라인
    icons.js            24 격자 선 아이콘 스물아홉 개
    auth.js             편집과 자산 조회 잠금
    page-month.js       이번 달
    page-ledger.js      원장 (옛 월별 탭 양식)
    page-spend.js       소비 (추이 / 분석 / 장부 의 껍데기와 분석)
    page-trend.js       소비 > 추이
    page-book.js        소비 > 장부
    page-asset.js       자산 (현황 / 투자 / 수입원)
    page-hall.js        기록실 > 명예의 전당과 껍데기
    page-theme.js       기록실 > 테마
    story.js            월말 결산 카드
    page-add.js         입력
    main.js             켜기, 탭 옮기기, 달 고르기, 가리기와 밤낮
  apps-script/
    Code.gs             서버 전체. 가계부 시트의 Code.gs 에 통째로 붙여 넣습니다
  설치안내.md            처음부터 세우는 순서
  README.md
```

## script 순서를 지킬 것

`index.html` 의 script 태그는 **위에서 아래로 그 순서대로** 실행됩니다. 모듈이 아니라 전역을 공유하므로 순서가 곧 의존 관계입니다.

- `config.js` 가 가장 먼저입니다. 뒤의 모든 파일이 `CONFIG` 를 씁니다
- `core.js` 가 `FILEV` 와 집계 함수를 만듭니다. `core-asset.js` 는 그 뒤여야 합니다
- `main.js` 는 반드시 마지막입니다. 맨 아래에서 `boot()` 를 부릅니다

파일을 새로 넣을 때는 `index.html` 에 태그를 더하고, 그 파일 맨 위에 `FILEV.이름 = CONFIG.APP_VERSION;` 을 적어 주세요. 화면 아래 도장에 버전이 어긋난 파일이 있으면 붉게 알려 줍니다.

## 세울 순서

`설치안내.md` 에 화면 그대로 적어 두었습니다. 요약하면 이렇습니다.

1. **가계부 시트**(자산 시트가 아닙니다)를 열고 확장 프로그램 > Apps Script
2. `Code.gs` 내용을 지우고 `apps-script/Code.gs` 를 통째로 붙여 넣기
3. [프로젝트 설정 > 스크립트 속성]에 `PASSWORD`, `GEMINI_KEY`, `PORTFOLIO_ID` 넣기
   (칸을 만들려면 `setupProps()` 를 한 번 실행. 코드 맨 위 상수에 적어도 되지만, 코드를 갈아 끼우면 날아갑니다)
4. 편집기에서 `checkAll()` 실행해 설치 상태 확인
5. 배포 > 새 배포 > 웹 앱 > 실행 대상 **나** / 액세스 권한 **모든 사용자**
6. `/exec` 주소를 브라우저 주소창에 붙여 넣어 JSON 이 보이는지 확인
7. `js/config.js` 의 `APPS_SCRIPT_URL` 에 그 주소 넣기
8. 이 폴더를 통째로 GitHub Pages 에 올리기

`js/config.js` 에서 채울 곳은 `APPS_SCRIPT_URL` 하나뿐입니다. 시트 ID, 비밀번호, Gemini 키는 전부 Apps Script 쪽에 있습니다. 이 파일은 공개 주소에 그대로 올라가기 때문입니다.

코드를 고친 뒤에는 **배포 > 배포 관리 > 연필 > 버전 [새 버전]** 을 꼭 해 주세요. 안 하면 주소는 그대로인데 옛 코드가 돕니다.

## 알아 둘 것

- **외부 라이브러리를 쓰지 않습니다.** 차트는 SVG, 결산 카드는 canvas 2D, 아이콘은 SVG 패스로 직접 그립니다. 글꼴만 CDN 에서 가져옵니다
- **자산 조회에는 비밀번호가 필요합니다.** 가계부 조회는 아직 열려 있습니다. 잠그려면 `Code.gs` 의 `handleRows_` 첫 줄에 `checkToken_(p.token);` 을 넣고 `js/core.js` 의 `loadAll()` 앞에 `await ensureAuth();` 를 두면 됩니다
- **`[hidden]{display:none !important}` 를 지우지 마세요.** `style.css` 앞부분에 있습니다. 이게 없으면 `#modal` 과 `.page` 의 display 규칙이 브라우저 기본 `[hidden]` 을 이겨서, 모달이 화면 위에 늘 깔려 클릭이 전부 막힙니다. v1 에서 실제로 그랬습니다
- 기본 키보드에 없는 문자를 쓰지 않습니다. 이모지, 엠대시, 화살표, 원문자 전부 없습니다
