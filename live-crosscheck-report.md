# 라이브 배포본 크로스체크

- 배포 URL: https://bobaekimboae.github.io/bobaedream-register-v2/?v=06124ab
- 확인 커밋: `06124ab1c96e1b42c83d28dcc9ab864d0f6ff121`
- GitHub Pages 상태: built
- 확인 일시: 2026-10-10

## 확인 파일

- 원본 등록표: `C:\Users\bobae\AppData\Local\Temp\58-media-registration-audit\outputs\58-capture-register\screen-register.md`
- 원본 핵심 화면: `C:\Users\bobae\AppData\Local\Temp\58-media-registration-audit\outputs\58-capture-register\source-screens-core`
- 원본 순서 영상: `C:\Users\bobae\AppData\Local\Temp\58-media-registration-audit\outputs\58-capture-register\58_source_core_flow.mp4`
- 라이브 재캡처: `C:\Users\bobae\AppData\Local\Temp\58-media-registration-audit\outputs\58-capture-register\live-crosscheck-3`

## 통과

1. 메인 화면
   - Pretendard 폰트 적용 확인.
   - 상단 진행률 `완성도 32%` DOM 확인.
   - `차량 사진 인식 완료`, 게시 팁 카드, 썸네일 2장, `2/30`, `영상 추가`, 차량 인증 영역 확인.

2. 사진 촬영 화면
   - 검정 상단바, 회색 카메라 프리뷰, 촬영 가이드 pill, 각도 슬롯 레일, 하단 촬영/앨범 컨트롤 확인.
   - 촬영 버튼 내부에 실제 모바일 카메라 호출 입력 확인:
     `input type="file" accept="image/*" capture="environment" data-file-action="photo-camera"`.
   - 앨범 버튼 내부에 실제 이미지 선택 입력 확인:
     `input type="file" accept="image/*" multiple data-file-action="photo-album"`.

3. 영상 촬영 화면
   - `차량외관 -> 차내장식 -> 엔진룸 -> 트렁크` 4단계 템플릿 확인.
   - 검정 상단바, 플래시, 가이드 프레임, 예시 카드, 녹화 버튼, 다음 버튼 확인.
   - 녹화 버튼 내부에 실제 모바일 영상 호출 입력 확인:
     `input type="file" accept="video/*" capture="environment" data-file-action="video-camera"`.

4. 코드 검증
   - `node --check outputs\bobaedream-register-v2\app.js` 통과.
   - 라이브 `app.js`에서 `capture=environment`와 `data-file-action` 확인.

## 아직 차이 나는 부분

1. 원본 58 화면은 실제 앱 카메라 프리뷰를 쓰지만, 웹 배포본은 브라우저 보안상 촬영 전 프리뷰를 회색 가이드 화면으로 표시한다.
2. 원본 썸네일에는 58 워터마크/흐린 실촬영 이미지 질감이 있고, 배포본은 샘플 차량 이미지다.
3. 원본 중국어 앱의 아이콘 원본 벡터가 없어서 일부 아이콘은 로컬 아이콘으로 근사했다.
4. 헤드리스 브라우저에서는 실제 Android 카메라 앱 실행까지 검증할 수 없다. 다만 실폰에서 누르면 카메라/파일 선택을 여는 HTML 구조는 라이브 DOM에서 확인했다.

## 다음 수정 우선순위

1. 원본 대비 메인 화면 세로 간격과 카드/썸네일 크기를 더 키워서 58 화면 밀도에 맞춘다.
2. 썸네일 이미지를 실제 원본처럼 저채도/워터마크 느낌으로 바꾼다.
3. 사진 촬영 후 자동 다음 슬롯, 삭제, 재촬영, 미리보기 편집 흐름을 실폰 터치로 다시 전수 확인한다.
