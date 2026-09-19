# 호환성과 검증 범위

이 도구는 `https://tutor-t.thinkforbl.com/courses/<숫자>`의 Tutor-T 강의를 대상으로 합니다. 브라우저 설치 경로가 있어도 다른 강의 사이트까지 지원한다는 뜻은 아닙니다. 사용자가 로그인한 탭에서 실행되며, 일반 사용에 Python이나 LLM API 키는 필요하지 않습니다.

## 설치 경로

릴리스 배포 파일은 다음 세 가지입니다. ZIP 확장은 먼저 압축을 해제합니다.

- `app/.artifacts/release/video-automation-agent.user.js`: 사용자 스크립트 매니저로 설치하는 기본 배포물.
- `app/.artifacts/release/video-automation-agent-chromium.zip`: Chromium 계열용 unpacked 확장.
- `app/.artifacts/release/video-automation-agent-firefox.zip`: Firefox 개발용 임시 확장.

| 브라우저 | 설치 경로 | 이번 배포본의 검증 상태와 제한 |
| --- | --- | --- |
| Chrome | Tampermonkey 또는 Violentmonkey; Chromium ZIP | 실제 Chrome·매니저 조합 수동 검증 전. 사용자 스크립트 실행 권한이 필요할 수 있음. |
| Edge | Tampermonkey 또는 Violentmonkey; Chromium ZIP | 실제 Edge·매니저 조합 수동 검증 전. 확장 정책과 사용자 스크립트 권한 확인 필요. |
| Brave | Violentmonkey; Chromium ZIP | 공식 매니저 지원 목록에 포함. 실제 Brave 수동 검증 전. |
| Opera | 지원되는 사용자 스크립트 매니저; Chromium ZIP | 실제 Opera 수동 검증 전. Violentmonkey는 공식적으로 Chrome Web Store 설치를 안내함. |
| Firefox | 사용자 스크립트 권장; Firefox ZIP은 임시 설치 | 실제 Firefox·매니저 조합 수동 검증 전. 서명되지 않은 임시 확장은 브라우저 재시작 시 제거됨. |
| Safari on macOS | Userscripts 또는 Tampermonkey를 통한 사용자 스크립트 | 실제 Safari 수동 검증 전. 매니저 설치, 확장 활성화, Tutor-T 사이트 접근 허용 필요. |
| Safari on iOS/iPadOS | Userscripts 등 지원 매니저를 통한 사용자 스크립트 | 조건부 설치 경로만 안내. 실제 기기·재생 검증 전이며 앱 전환·화면 잠금 중 연속 재생을 보장하지 않음. |
| Aside | 저장소의 `node app/scripts/aside.mjs`와 공식 Aside CLI; 사용자 스크립트는 매니저 지원 확인 필요 | 기존 CLI로 실제 강의 전환을 확인함. 새 배포본의 실사용 확인 결과는 아래 검증 기록 참고. 매니저 설치 가능 여부는 미검증. |

Tampermonkey 5.3+의 Chrome 계열에서는 확장 설정의 **Allow User Scripts**(Chrome 138+) 또는 **Developer Mode**가 필요합니다. [공식 설정 안내](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)

Chrome의 unpacked 설치는 `chrome://extensions`에서 개발자 모드를 켜고 **Load unpacked**로 압축 해제한 디렉터리를 선택합니다. 다른 Chromium 계열은 해당 브라우저의 확장 관리 화면을 사용하며 정책에 따라 설치가 제한될 수 있습니다. [Chrome 공식 설치 안내](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)

Firefox ZIP은 `about:debugging` → **This Firefox** → **Load Temporary Add-on**으로 설치합니다. 일반 사용자용 영구 확장은 Mozilla 서명이 필요하므로, 이 프로젝트의 서명되지 않은 ZIP과 구분해야 합니다. [Firefox 공식 임시 설치 안내](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

Safari Userscripts는 App Store에서 설치합니다. 공식 README 기준 macOS 12+/Safari 14.1+ 또는 iOS 15.1+가 필요합니다. `.user.js` 파일 주소를 연 뒤 확장 팝업에서 설치하거나 매니저의 스크립트 폴더에 파일을 저장할 수 있습니다. [Userscripts 설치·접근 권한 안내](https://github.com/quoid/userscripts)

매니저의 지원 목록은 도구 자체의 재생 검증과 별개입니다. [Tampermonkey 지원 브라우저](https://www.tampermonkey.net/), [Violentmonkey 지원 브라우저](https://violentmonkey.github.io/get-it/)

## 자동 테스트와 실제 브라우저

| 검증 대상 | 현재 결과 | 이 결과로 확인할 수 없는 것 |
| --- | --- | --- |
| Playwright Chromium | macOS에서 50개 통과. 실제 unpacked 확장 로딩 포함 | Chrome·Edge·Brave·Opera 및 각 매니저의 실제 설치·재생 |
| Playwright Firefox | macOS에서 공통 동작 49개 통과. 확장 설치 테스트 제외 | 일반 Firefox 배포판과 매니저의 실제 설치·재생 |
| Playwright WebKit | macOS에서 공통 동작 49개 통과. 확장 설치 테스트 제외 | 실제 Safari, iPhone/iPad, Safari 매니저의 실제 설치·재생 |

2026-09-19 로컬 검증: Node.js 24.11.1, Playwright 1.63.0. 잠금 파일로 새로 설치한 뒤 브라우저 테스트 **148개 통과·2개 제외**, Node 테스트 **12개 통과**, 구문·경로 검사와 설치 파일 패키징 통과. 제외된 2개는 Chromium 전용 확장 로딩 테스트의 Firefox·WebKit 실행입니다. 운영체제별 자동 실행 결과는 [GitHub Actions](https://github.com/LSB-afk/Video-Automation-Agent/actions/workflows/ci.yml)에서 확인할 수 있습니다.

Aside 1.26.916.1741에서는 새 배포본의 CLI로 기존 실행을 교체하고 `until_complete: true`, `running: true`, 사이트 완료율 읽기와 실제 재생 시간 증가를 확인했습니다. 전 과정이 100%에 도달하는 장시간 실사용 검증은 진행 중이며, 100% 종료 조건은 합성 강의 테스트에서 검증했습니다.

Windows hosted CI에서는 WebKit의 실제 영상 테스트 40개를 제외하고 패널 테스트 9개를 유지합니다. 이 조합은 영상 로딩 단계에서 실패했으며, Playwright 1.63.0 upstream도 Windows Server의 Media Pack 문제로 동일 조합을 제외합니다. macOS·Linux에서는 WebKit 영상 테스트를 계속 실행합니다. 모든 Windows 환경에서 WebKit 재생이 불가능하다는 뜻은 아닙니다. [해당 버전의 공식 테스트와 제외 사유](https://github.com/microsoft/playwright/blob/v1.63.0/tests/library/capabilities.spec.ts#L62-L110)

Playwright Firefox와 WebKit은 패치된 테스트 빌드입니다. **WebKit 테스트 통과를 Safari 검증 완료로 표기하지 않습니다.** 영상 코덱은 운영체제별로 다르며, Playwright는 Safari에 가까운 영상 테스트에 macOS WebKit을 권장합니다. Chrome·Edge의 코덱 동작은 해당 공식 브라우저 채널에서도 확인해야 합니다. [Playwright 브라우저·미디어 문서](https://playwright.dev/docs/browsers)

MV3 확장도 브라우저별 차이가 있습니다. 현재 Firefox는 `background.service_worker`를 지원하지 않고 `background.scripts`를 사용합니다. 배포 manifest를 변경할 때 공통 제어 코드와 별도로 이 차이를 확인해야 합니다. [MDN MV3 background 호환성](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)

## 실행 한계

- 브라우저와 강의 탭을 열어 두고 기기가 잠들지 않게 해야 합니다. 숨겨진 탭의 제한, 자동 재생 정책, 네트워크 장애가 진행에 영향을 줄 수 있습니다.
- 시작은 사용자가 **Start**를 눌러야 하며 새로고침 후에도 다시 시작해야 합니다. 선택한 과정 밖으로 이동하면 추가 자동 동작을 중단합니다.
- 실제 영상 종료 후 정상 **Next** 버튼으로 이동합니다. 사이트 완료 표시가 없으면 저장을 위한 3초 유예 후 이동할 수 있습니다.
- 기본 100% 모드는 마지막 영상 뒤 미완료 항목을 다시 재생하고, 사이트 완료율이 실제 100%가 되면 `course_completed`로 종료합니다. 과정 완료율이 아닌 별도의 시험·수료 인증은 지원 범위에 포함되지 않습니다. 시간 제한 모드의 `finished`는 재생 순회 종료만 뜻합니다.

공식 문서 확인 기준: 2026-09-19. 실행이 막히면 [문제 해결](troubleshooting.md)을 확인하세요.
