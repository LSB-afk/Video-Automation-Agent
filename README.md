# Video Automation Agent

[English](docs/README.en.md) · [설치 파일](https://github.com/LSB-afk/Video-Automation-Agent/releases/latest) · [브라우저 호환성](docs/compatibility.md) · [문제 해결](docs/troubleshooting.md)

Tutor-T 강의를 실제로 재생하고, 보충영상과 다음 강의·주제 이동을 처리하는 브라우저 자동화 도구입니다. **사이트의 학습완료율이 100%가 되면 자동 종료**하는 모드를 제공합니다.

사용자가 로그인한 브라우저 안에서 실행됩니다. 일반 설치에는 Python, Hermes, LLM API 키가 필요하지 않습니다. 지원 사이트는 `https://tutor-t.thinkforbl.com/courses/<숫자>`입니다.

## 빠른 설치

1. 브라우저에 사용자 스크립트 매니저를 설치합니다. Chrome·Edge·Firefox 등은 [Tampermonkey](https://www.tampermonkey.net/) 또는 [Violentmonkey](https://violentmonkey.github.io/get-it/), Safari는 [Userscripts](https://github.com/quoid/userscripts)를 사용할 수 있습니다.
2. [video-automation-agent.user.js](https://github.com/LSB-afk/Video-Automation-Agent/releases/latest/download/video-automation-agent.user.js)를 열어 설치합니다. 파일로 다운로드만 되면 매니저의 **새 스크립트/가져오기**에서 파일 내용을 붙여 넣거나 가져옵니다.
3. Tutor-T에 로그인하고 원하는 과정·강의를 엽니다. 목차 패널을 펼쳐 둡니다.
4. 왼쪽 위 **영상 자동화 / Video Automation Agent**에서 설정을 확인하고 **시작 / Start**를 누릅니다.

Chrome 계열 Tampermonkey는 확장 설정의 **Allow User Scripts** 또는 **Developer Mode**가 필요할 수 있습니다. [공식 안내](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)

**100%까지 실행**은 기본으로 켜져 있습니다. 이 모드에는 시간 제한이 없으며, **정지 / Stop**으로 언제든 자동화를 멈출 수 있습니다. 체크를 끄면 설정한 시간 동안 실행하고 마지막 영상에서 종료합니다. 정지는 현재 영상 자체를 일시정지하지 않습니다.

## 100%까지 실행하는 방식

- 사이트의 학습완료율과 진행 막대를 읽습니다. 영상 재생률이나 임의의 `100%` 문구를 완료율로 사용하지 않습니다.
- 본 영상과 보충영상을 정상 재생하고, 제공된 계속·복귀 버튼을 처리합니다. **질문 건너뛰기**는 화면에서 선택할 수 있습니다.
- 본 영상이 실제로 끝나면 다음 강의로 이동합니다. 완료 체크가 늦으면 3초를 기다린 뒤 정상 다음 버튼으로 이동합니다.
- `1.1.4 → 1.2 → 1.2.1`처럼 다음 주제와 챕터까지 사이트 순서대로 이어갑니다. 끝난 영상 창이 다음 버튼을 가리면 숨긴 뒤 이동합니다.
- 마지막 영상 뒤에도 완료율이 낮으면 접힌 목차를 펼치고, 사이트에서 미완료로 표시된 항목을 다시 정상 재생합니다.
- 사이트가 실제 100%를 표시하면 `course_completed` 상태로 자동 종료합니다. 미완료 항목이 없는데 완료율이 낮으면 사이트의 갱신을 기다리며 완료로 보고하지 않습니다.

수강 기록·재생 시간을 조작하거나 정답을 대신 제출하지 않습니다. 사이트 오류, 로그인 만료, 필수 입력, 인식하지 못한 화면에서는 사용자 조치가 필요할 수 있습니다. 브라우저와 기기를 켜 두어야 하며, **새로고침 후에는 Start를 다시 눌러야 합니다.**

## 확장 프로그램으로 설치

사용자 스크립트 대신 [릴리스](https://github.com/LSB-afk/Video-Automation-Agent/releases/latest)의 ZIP을 선택할 수 있습니다. 두 방식을 동시에 실행하지 마세요.

| 배포 파일 | 설치 방법 |
| --- | --- |
| `video-automation-agent-chromium.zip` | 압축 해제 → `chrome://extensions` 또는 해당 브라우저의 확장 관리 → 개발자 모드 → 압축 해제된 확장 로드 |
| `video-automation-agent-firefox.zip` | 압축 해제 → `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json` 선택 |

Firefox ZIP은 서명되지 않은 개발용 패키지여서 재시작하면 제거됩니다. 지속적으로 사용하려면 사용자 스크립트 설치를 권장합니다. Safari는 사용자 스크립트 경로를 사용합니다. 스토어에 등록된 확장 프로그램은 아닙니다.

## Aside에서 사용

Aside의 사용자 스크립트 매니저 지원은 확인되지 않았으므로, [공식 Aside CLI](https://docs.aside.com/help/developers)를 통한 연결도 제공합니다. Node.js 22+와 Aside CLI가 설치된 상태에서 저장소를 내려받아 실행합니다.

```sh
git clone https://github.com/LSB-afk/Video-Automation-Agent.git
cd Video-Automation-Agent
node app/scripts/aside.mjs start
node app/scripts/aside.mjs status
node app/scripts/aside.mjs stop
```

과정 탭이 여러 개라면 `start --url https://tutor-t.thinkforbl.com/courses/9`처럼 지정합니다. 시간 제한이 필요하면 `start --bounded --hours 4`, 질문을 직접 처리하려면 `start --no-skip`을 사용합니다. 이전 자동화가 같은 탭에서 실행 중이면 먼저 그 자동화를 중지합니다. 인증정보는 복사하지 않습니다.

## 개발과 검증

Node.js 22+를 사용합니다. 실행 코드는 외부 라이브러리에 의존하지 않으며 Playwright는 개발 테스트에만 사용합니다.

```sh
cd app
npm ci
npx playwright install
npm run build
npm run check
npm run test:unit
npm test
npm run package
```

`app/.artifacts/dist/`에 빌드 결과, `app/.artifacts/release/`에 설치 파일을 생성합니다. 실제 짧은 합성 영상을 사용해 Chromium·Firefox·WebKit에서 재생·이동·보충영상·100% 종료를 검사합니다. CI는 Linux·macOS·Windows에서 같은 검사를 실행합니다. **엔진 테스트가 모든 브라우저 브랜드와 모바일 기기의 검증을 의미하지는 않습니다.** 최신 결과와 제한은 [호환성 문서](docs/compatibility.md)를 확인하세요.

| 경로 | 역할 |
| --- | --- |
| `app/package.json`, `app/package-lock.json` | 개발 명령과 고정된 테스트 의존성 |
| `app/config/` | 브라우저 테스트 설정 |
| `app/src/controller.js` | 재생, 상호작용, 다음 이동, 완료율 목표 제어 |
| `app/src/panel.js` | 시작·정지·설정·상태 화면 |
| `app/scripts/` | 빌드·패키징·검사·Aside 연결 |
| `app/tests/` | 실제 미디어 회귀 테스트와 배포 파일 검사 |
| `skills/video-automation-agent/` | Hermes·Codex 등 에이전트에서 참고할 재사용 스킬 |
| `docs/superpowers/` | 요구사항과 구현 계획 |

JSON은 용도에 맞는 위치에 둡니다. npm 설정은 `app/`, 생성되는 확장 설정 `manifest.json`은 `app/.artifacts/dist/chromium/`과 `firefox/`, 실행 결과는 `app/.artifacts/test-results/`에 있습니다. `node_modules/`와 `.artifacts/`는 Git에 올리지 않습니다. 일반 사용자는 저장소의 개발 파일 대신 릴리스 설치 파일을 사용하면 됩니다.

기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. [MIT License](LICENSE).
