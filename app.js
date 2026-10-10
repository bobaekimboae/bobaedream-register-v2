const slots = [
  "좌전 45°",
  "정면",
  "우전 45°",
  "우측면",
  "후면",
  "좌측면",
  "계기판",
  "실내",
  "엔진룸",
  "트렁크",
  ...Array.from({ length: 20 }, (_, index) => `기타 ${index + 1}`),
];

const samplePhotos = [
  "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=420&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=420&q=80",
  "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=420&q=80",
  "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=420&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=420&q=80",
  "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=420&q=80",
];

const state = {
  view: "main",
  progress: 32,
  city: "서울",
  verification: "차량명판",
  photos: [],
  activeSlot: 0,
  cameraMode: "camera",
  maskPlate: false,
  previewIndex: 0,
  previewTool: "plate",
  pendingDelete: null,
  videoSegment: 0,
  videoRecording: false,
  videoDone: false,
  modal: null,
  toast: "",
  dragIndex: null,
};

const screen = document.querySelector("#screenRoot");

function icon(name, size = 21) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setView(view) {
  state.view = view;
  state.modal = null;
  render();
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1600);
}

function firstMissingSlot() {
  const taken = new Set(state.photos.map((photo) => photo.slot));
  const priority = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return priority.find((slot) => !taken.has(slot)) ?? state.photos.length;
}

function photoForSlot(slot) {
  return state.photos.find((photo) => photo.slot === slot);
}

function addPhoto(slot = state.activeSlot) {
  if (state.photos.length >= 30) {
    showToast("사진은 최대 30장까지 등록할 수 있습니다");
    return;
  }
  if (photoForSlot(slot)) {
    showToast("이미 등록된 각도입니다");
    return;
  }
  const photo = {
    id: `p-${Date.now()}-${slot}`,
    slot,
    label: slots[slot],
    src: samplePhotos[state.photos.length % samplePhotos.length],
  };
  state.photos.push(photo);
  state.activeSlot = firstMissingSlot();
  state.progress = Math.max(state.progress, 38);
  render();
}

function deletePhoto(id, withConfirm) {
  const photo = state.photos.find((item) => item.id === id);
  if (!photo) return;
  if (withConfirm) {
    state.pendingDelete = id;
    state.modal = "delete-photo";
    render();
    return;
  }
  state.photos = state.photos.filter((item) => item.id !== id);
  state.activeSlot = firstMissingSlot();
  if (state.previewIndex >= state.photos.length) {
    state.previewIndex = Math.max(0, state.photos.length - 1);
  }
  if (!state.photos.length) {
    state.progress = 32;
  }
  render();
}

function confirmDelete() {
  if (state.pendingDelete) {
    state.photos = state.photos.filter((item) => item.id !== state.pendingDelete);
    state.pendingDelete = null;
    state.activeSlot = firstMissingSlot();
    if (!state.photos.length) state.progress = 32;
  }
  state.modal = null;
  render();
}

function openPreview(index) {
  if (!state.photos.length) return;
  state.previewIndex = Math.max(0, Math.min(index, state.photos.length - 1));
  setView("preview");
}

function movePhoto(from, to) {
  if (from === null || from === to || to < 0 || to >= state.photos.length) return;
  const copy = [...state.photos];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  state.photos = copy;
  render();
}

function mainView() {
  const completed = state.photos.length > 0;
  return `
    <div class="app-view">
      <header class="topbar">
        <div class="topbar-row">
          <button class="icon-button" aria-label="뒤로">${icon("chevron-left", 28)}</button>
          <div class="top-title">
            <h2>매물등록 V2</h2>
            <small>완성도 ${state.progress}%</small>
          </div>
          <button class="draft-link" type="button">임시저장<span class="badge">4</span></button>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${state.progress}%"></div></div>
      </header>

      <div class="scroll-body">
        <section class="section">
          <div class="section-title"><h3>차량 소재지</h3><span class="required">필수</span></div>
          <div class="field-line"><span>${state.city}</span>${icon("chevron-right", 20)}</div>
        </section>

        <section class="section">
          <div class="section-title">
            <h3>${completed ? "차량 이미지 등록 완료" : "사진 및 영상 등록"}</h3>
            <button class="help-link" type="button" data-action="rules">${icon("circle-help", 16)} 촬영규칙</button>
          </div>
          <p class="alert-copy">첫 사진은 좌전 45° 차량 사진을 사용하면 목록 노출 효과가 좋습니다.</p>
          ${
            completed
              ? `<div class="tip-card">
                  <div class="tip-head">${icon("message-circle", 22)} 등록 가이드</div>
                  <p>노출을 높이려면 기본 10개 각도를 채워주세요. 현재 부족한 추천 각도는 <b>${Math.max(0, 10 - state.photos.length)}</b>개입니다.</p>
                </div>`
              : ""
          }
          <div class="media-grid" id="mainMediaGrid">
            ${state.photos
              .map(
                (photo, index) => `
                  <div class="media-card" draggable="true" data-drag-index="${index}">
                    <button class="thumb" data-action="preview" data-index="${index}" style="background-image:url('${photo.src}')" aria-label="${photo.label} 미리보기"></button>
                    <button class="delete-chip" data-action="main-delete" data-id="${photo.id}" aria-label="사진 삭제">${icon("trash-2", 16)}</button>
                    <label>${photo.label}</label>
                  </div>`,
              )
              .join("")}
            <button class="add-card count-card" type="button" data-action="photo-camera">
              ${icon("camera", 34)}
              <span>${state.photos.length}/30</span>
            </button>
            <button class="add-card" type="button" data-action="video">
              ${icon(state.videoDone ? "badge-check" : "video", 34)}
              <span>${state.videoDone ? "영상완료" : "영상추가"}</span>
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-title"><h3>차량 인증</h3><span class="required">하나 선택</span></div>
          <div class="radio-row">
            ${["등록증", "성능기록", "차량명판"]
              .map(
                (item) => `<button class="radio-button ${state.verification === item ? "is-active" : ""}" data-action="verify" data-value="${item}" type="button">${item}</button>`,
              )
              .join("")}
          </div>
          <button class="doc-upload" type="button" data-action="doc-upload">
            ${icon("badge", 34)}
            <span>${state.verification} 실사 촬영</span>
          </button>
        </section>

        <section class="section">
          <div class="section-title"><h3>차량 정보</h3><span class="required">필수</span></div>
          <div class="field-card">
            ${[
              ["제조사/모델", "현대 쏘나타"],
              ["연식", "2021년"],
              ["주행거리", "42,000 km"],
              ["연료", "가솔린"],
              ["판매가격", "1,860만원"],
            ]
              .map((row) => `<div class="form-row"><span>${row[0]}</span><span>${row[1]} ${icon("chevron-right", 16)}</span></div>`)
              .join("")}
          </div>
        </section>
      </div>

      <footer class="bottom-bar">
        <button class="save-draft" type="button">${icon("archive", 24)} 임시저장</button>
        <button class="primary-cta" type="button">매물 등록하기</button>
      </footer>
      ${modalLayer()}
      ${toastLayer()}
    </div>`;
}

function cameraView() {
  const albumMode = state.cameraMode === "album";
  return `
    <div class="camera-view">
      <header class="dark-topbar">
        <button class="icon-button dark-button" data-action="close-camera" aria-label="닫기">${icon("x", 30)}</button>
        <h2>${albumMode ? "내 사진첩" : "사진 촬영"}</h2>
        <span></span>
      </header>

      ${
        albumMode
          ? `<div class="guide-pill">우선 등록 각도: 좌전45° · 정면 · 우전45° · 측면</div>
             <div class="album-grid">
              ${samplePhotos
                .map(
                  (src, index) => `<button class="album-item" data-action="album-photo" data-index="${index}" style="background-image:url('${src}')" aria-label="앨범 사진 ${index + 1}"></button>`,
                )
                .join("")}
             </div>`
          : `<div class="camera-stage">
              <div class="guide-pill">${slots[state.activeSlot]} 촬영</div>
            </div>
            <div class="slot-rail">
              ${slots
                .map((slot, index) => {
                  const photo = photoForSlot(index);
                  return `<div class="slot-card ${state.activeSlot === index ? "is-active" : ""} ${photo ? "has-photo" : ""}" style="${photo ? `background-image:url('${photo.src}')` : ""}">
                    <button type="button" data-action="slot-select" data-slot="${index}">${slot}</button>
                    ${photo ? `<button class="slot-delete" data-action="slot-delete" data-id="${photo.id}" aria-label="${slot} 삭제">${icon("x", 14)}</button>` : ""}
                  </div>`;
                })
                .join("")}
            </div>
            <div class="camera-controls">
              <button class="mask-toggle ${state.maskPlate ? "is-active" : ""}" data-action="mask" type="button">${icon("scan-face", 22)}번호판가림</button>
              <button class="shutter" data-action="shutter" type="button" aria-label="촬영"></button>
              <div class="counter-finish">
                <strong>${state.photos.length}/30</strong>
                <button class="finish-small" data-action="finish-camera" type="button">완료</button>
              </div>
            </div>`
      }

      <div class="mode-tabs">
        <button class="${!albumMode ? "is-active" : ""}" data-action="mode-camera" type="button">촬영</button>
        <button class="${albumMode ? "is-active" : ""}" data-action="mode-album" type="button">앨범</button>
      </div>
      ${toastLayer()}
    </div>`;
}

function previewView() {
  const photo = state.photos[state.previewIndex];
  if (!photo) {
    return mainView();
  }
  return `
    <div class="preview-view">
      <header class="dark-topbar">
        <button class="icon-button dark-button" data-action="preview-close" aria-label="닫기">${icon("x", 30)}</button>
        <h2>사진 미리보기(${state.previewIndex + 1})</h2>
        <span></span>
      </header>
      <div class="preview-photo" style="background-image:url('${photo.src}')"></div>
      <div class="preview-rail">
        <button class="preview-add" data-action="preview-add" type="button" aria-label="사진 추가">+</button>
        ${state.photos
          .map(
            (item, index) => `
              <div class="preview-item ${index === state.previewIndex ? "is-active" : ""}">
              <button class="preview-thumb" data-action="preview-pick" data-index="${index}" style="background-image:url('${item.src}')" aria-label="${item.label} 선택"></button>
                <button class="preview-delete" data-action="preview-delete" data-id="${item.id}" aria-label="사진 삭제">×</button>
                <span class="preview-label">${item.label}</span>
              </div>`,
          )
          .join("")}
      </div>
      <div class="tool-row">
        ${[
          ["plate", "scan-face", "번호판"],
          ["mosaic", "grip", "모자이크"],
          ["rotate", "rotate-cw", "회전"],
          ["crop", "crop", "자르기"],
        ]
          .map(
            ([key, iconName, label]) => `<button class="edit-tool ${state.previewTool === key ? "is-active" : ""}" data-action="tool" data-tool="${key}" type="button">${icon(iconName, 28)}${label}</button>`,
          )
          .join("")}
        <button class="preview-finish" data-action="preview-finish" type="button">완료</button>
      </div>
      ${toastLayer()}
    </div>`;
}

function videoView() {
  const segmentNames = ["외관", "실내", "엔진룸", "트렁크"];
  return `
    <div class="video-view">
      <header class="dark-topbar">
        <button class="icon-button dark-button" data-action="video-close" aria-label="닫기">${icon("x", 30)}</button>
        <h2>차량 영상</h2>
        <span></span>
      </header>
      <div class="video-segments">
        ${segmentNames
          .map(
            (name, index) => `<button class="segment-step ${state.videoSegment === index ? "is-active" : ""}" data-action="video-segment" data-index="${index}" type="button">${name}</button>`,
          )
          .join("")}
      </div>
      <div class="video-stage">
        <div class="record-timer">${state.videoRecording ? "00:08 녹화 중" : `${segmentNames[state.videoSegment]} 촬영 준비`}</div>
        <div class="video-frame-line"></div>
      </div>
      <div class="video-controls">
        <span></span>
        <button class="record-button ${state.videoRecording ? "is-recording" : ""}" data-action="record" type="button" aria-label="녹화"></button>
        <button class="next-video" data-action="video-next" type="button">${state.videoSegment === 3 ? "완료" : "다음"}</button>
      </div>
      ${modalLayer()}
      ${toastLayer()}
    </div>`;
}

function modalLayer() {
  if (state.modal === "rules") {
    return `<div class="modal-layer">
      <div class="bottom-sheet">
        <div class="sheet-body">
          <h3>차량 사진 촬영 규칙</h3>
          <p>최소 1장 이상 등록해야 하며, 추천 각도를 채우면 매물 신뢰도가 높아집니다.</p>
          <div class="rules-grid">
            <div class="rules-group"><h4>외관 6장</h4><div class="rules-chips"><span>좌전 45°</span><span>정면</span><span>우전 45°</span><span>우측면</span><span>후면</span><span>좌측면</span></div></div>
            <div class="rules-group"><h4>실내 2장</h4><div class="rules-chips"><span>계기판</span><span>실내</span></div></div>
            <div class="rules-group"><h4>기타 2장</h4><div class="rules-chips"><span>엔진룸</span><span>트렁크</span></div></div>
          </div>
        </div>
        <div class="modal-actions"><button data-action="modal-close">닫기</button><button data-action="photo-camera">사진 추가</button></div>
      </div>
    </div>`;
  }
  if (state.modal === "delete-photo") {
    return `<div class="modal-layer">
      <div class="modal">
        <div class="modal-body"><h3>사진 삭제</h3><p>선택한 차량 사진을 삭제할까요?</p></div>
        <div class="modal-actions"><button data-action="modal-close">취소</button><button data-action="delete-confirm">삭제</button></div>
      </div>
    </div>`;
  }
  if (state.modal === "video-exit") {
    return `<div class="modal-layer">
      <div class="modal">
        <div class="modal-body"><h3>영상 촬영 중단</h3><p>촬영 중인 영상은 저장되지 않습니다. 나가시겠습니까?</p></div>
        <div class="modal-actions"><button data-action="modal-close">계속 촬영</button><button data-action="video-exit-confirm">나가기</button></div>
      </div>
    </div>`;
  }
  return "";
}

function toastLayer() {
  return state.toast ? `<div class="toast">${state.toast}</div>` : "";
}

function render() {
  if (state.view === "camera") screen.innerHTML = cameraView();
  if (state.view === "preview") screen.innerHTML = previewView();
  if (state.view === "video") screen.innerHTML = videoView();
  if (state.view === "main") screen.innerHTML = mainView();
  bindEvents();
  updateIcons();
}

function bindEvents() {
  screen.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.currentTarget;
      const action = target.dataset.action;
      if (action === "rules") {
        state.modal = "rules";
        render();
      }
      if (action === "modal-close") {
        state.modal = null;
        render();
      }
      if (action === "photo-camera") {
        state.activeSlot = firstMissingSlot();
        state.cameraMode = "camera";
        setView("camera");
      }
      if (action === "video") setView("video");
      if (action === "verify") {
        state.verification = target.dataset.value;
        render();
      }
      if (action === "doc-upload") showToast("인증 이미지는 실시간 촬영만 지원합니다");
      if (action === "preview") openPreview(Number(target.dataset.index));
      if (action === "main-delete") deletePhoto(target.dataset.id, true);
      if (action === "delete-confirm") confirmDelete();
      if (action === "close-camera") setView("main");
      if (action === "slot-select") {
        state.activeSlot = Number(target.dataset.slot);
        render();
      }
      if (action === "slot-delete") deletePhoto(target.dataset.id, false);
      if (action === "mask") {
        state.maskPlate = !state.maskPlate;
        render();
      }
      if (action === "shutter") addPhoto(state.activeSlot);
      if (action === "finish-camera") {
        if (!state.photos.length) {
          showToast("사진을 최소 1장 등록해 주세요");
        } else {
          setView("main");
        }
      }
      if (action === "mode-camera") {
        state.cameraMode = "camera";
        render();
      }
      if (action === "mode-album") {
        state.cameraMode = "album";
        render();
      }
      if (action === "album-photo") {
        addPhoto(firstMissingSlot());
        showToast("앨범 사진이 추가되었습니다");
      }
      if (action === "preview-close" || action === "preview-finish") setView("main");
      if (action === "preview-add") {
        state.activeSlot = firstMissingSlot();
        state.cameraMode = "camera";
        setView("camera");
      }
      if (action === "preview-pick") {
        state.previewIndex = Number(target.dataset.index);
        render();
      }
      if (action === "preview-delete") {
        deletePhoto(target.dataset.id, false);
        showToast("사진이 삭제되었습니다");
      }
      if (action === "tool") {
        state.previewTool = target.dataset.tool;
        showToast(`${target.textContent.trim()} 도구 선택`);
        render();
      }
      if (action === "video-close") {
        if (state.videoRecording) {
          state.modal = "video-exit";
          render();
        } else {
          setView("main");
        }
      }
      if (action === "video-exit-confirm") {
        state.videoRecording = false;
        setView("main");
      }
      if (action === "video-segment") {
        state.videoSegment = Number(target.dataset.index);
        render();
      }
      if (action === "record") {
        state.videoRecording = !state.videoRecording;
        render();
      }
      if (action === "video-next") {
        state.videoRecording = false;
        if (state.videoSegment < 3) {
          state.videoSegment += 1;
          render();
        } else {
          state.videoDone = true;
          state.progress = Math.max(state.progress, 42);
          setView("main");
        }
      }
    });
  });

  screen.querySelectorAll("[draggable='true']").forEach((card) => {
    let startX = 0;
    let startY = 0;
    let pointerDragging = false;

    card.addEventListener("dragstart", (event) => {
      state.dragIndex = Number(card.dataset.dragIndex);
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      state.dragIndex = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      movePhoto(state.dragIndex, Number(card.dataset.dragIndex));
    });
    card.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".delete-chip") || event.target.closest(".thumb")) return;
      startX = event.clientX;
      startY = event.clientY;
      pointerDragging = true;
      state.dragIndex = Number(card.dataset.dragIndex);
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointermove", (event) => {
      if (!pointerDragging) return;
      const dx = Math.abs(event.clientX - startX);
      const dy = Math.abs(event.clientY - startY);
      if (dx > 16 && dx > dy) {
        card.classList.add("touch-dragging");
      }
    });
    card.addEventListener("pointerup", (event) => {
      if (!pointerDragging) return;
      pointerDragging = false;
      card.classList.remove("touch-dragging");
      const dx = event.clientX - startX;
      if (Math.abs(dx) < 42) return;
      const direction = dx > 0 ? 1 : -1;
      const from = Number(card.dataset.dragIndex);
      const to = Math.max(0, Math.min(state.photos.length - 1, from + direction));
      movePhoto(from, to);
    });
  });
}

render();
