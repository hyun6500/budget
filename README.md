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
    Portfolio.gs        자산 시트 판독기 (Apps Script 에 새 파일로 추가)
  README.md
```

## script 순서를 지킬 것

`index.html` 의 script 태그는 **위에서 아래로 그 순서대로** 실행됩니다. 모듈이 아니라 전역을 공유하므로 순서가 곧 의존 관계입니다.

- `config.js` 가 가장 먼저입니다. 뒤의 모든 파일이 `CONFIG` 를 씁니다
- `core.js` 가 `FILEV` 와 집계 함수를 만듭니다. `core-asset.js` 는 그 뒤여야 합니다
- `main.js` 는 반드시 마지막입니다. 맨 아래에서 `boot()` 를 부릅니다

파일을 새로 넣을 때는 `index.html` 에 태그를 더하고, 그 파일 맨 위에 `FILEV.이름 = CONFIG.APP_VERSION;` 을 적어 주세요. 화면 아래 도장에 버전이 어긋난 파일이 있으면 붉게 알려 줍니다.

## 세울 순서

1. Apps Script 프로젝트에 `apps-script/Portfolio.gs` 를 **새 파일로** 추가합니다
2. 편집기 왼쪽 [프로젝트 설정] > [스크립트 속성] > [속성 추가] 에서
   속성 이름 `PORTFOLIO_ID`, 값에 종합 자산 포트폴리오 시트 ID 를 넣습니다.
   시트 주소의 `/d/` 와 `/edit` 사이 문자열입니다
3. 편집기에서 `checkPortfolio()` 를 한 번 실행합니다.
   실행 기록에 시트 이름과 자산 총액, 읽어 온 개수가 찍히면 성공입니다
4. 기존 `Code.gs` 두 곳을 고칩니다
   - 라우터에 한 줄: `if (p.action === "assets") return json_(handleAssets_(p));`
   - `VERSION` 을 `"2"` 로 올립니다
5. 새 버전으로 배포합니다
6. `js/config.js` 에서 `SHEET_ID`, `APPS_SCRIPT_URL`, `CARD_APP_URL` 을 채웁니다
7. 이 폴더를 통째로 GitHub Pages 에 올립니다

### 자산 시트 ID 는 왜 코드가 아니라 스크립트 속성에 넣나

이 스크립트는 가계부 스프레드시트에 붙어 있어서 `getActiveSpreadsheet()` 는 언제나 가계부를 돌려줍니다. 자산 포트폴리오는 그것과 다른 파일이라 `openById` 로 따로 열 수밖에 없고, 그래서 ID 가 필요합니다.

다만 ID 를 코드에 박아 두면 코드를 옮기거나 남에게 보일 때 ID 가 따라다닙니다. 스크립트 속성에 두면 코드와 분리되고, 값을 바꿔도 재배포가 필요 없습니다.

`js/config.js` 에는 이 ID 를 두지 않습니다. 그 파일은 GitHub Pages 에 그대로 올라가 누구나 볼 수 있기 때문입니다. 앱은 서버 응답으로만 자산 연결 여부를 압니다.

`SHEET_ID` 가 아직 `js/config.js` 에 남아 있는데, `Code.gs` 가 가계부를 `getActiveSpreadsheet()` 로 열고 있다면 이 값도 필요 없습니다. 확인해 보고 안 쓰이면 지우세요.

## 알아 둘 것

- **외부 라이브러리를 쓰지 않습니다.** 차트는 SVG, 결산 카드는 canvas 2D, 아이콘은 SVG 패스로 직접 그립니다. 글꼴만 CDN 에서 가져옵니다
- **자산 조회에는 비밀번호가 필요합니다.** 가계부 조회는 아직 열려 있습니다. 잠그려면 `Code.gs` 의 `rows` 처리에 `checkToken_(p.token)` 을 넣고 `core.js` 의 `loadAll()` 앞에 `ensureAuth()` 를 두면 됩니다
- **`[hidden]{display:none !important}` 를 지우지 마세요.** `style.css` 앞부분에 있습니다. 이게 없으면 `#modal` 과 `.page` 의 display 규칙이 브라우저 기본 `[hidden]` 을 이겨서, 모달이 화면 위에 늘 깔려 클릭이 전부 막힙니다. v1 에서 실제로 그랬습니다
- 기본 키보드에 없는 문자를 쓰지 않습니다. 이모지, 엠대시, 화살표, 원문자 전부 없습니다
