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

const videoTemplateImages = [
  "assets/video-template-exterior.png",
  "assets/video-template-interior.png",
  "assets/video-template-engine.png",
  "assets/video-template-trunk.png",
];

const state = {
  view: "main",
  progress: 32,
  city: "서울",
  verification: "차량명판",
  photos: [
    {
      id: "seed-front",
      slot: 1,
      label: "차량 전면",
      src: samplePhotos[0],
      edits: defaultPhotoEdits(),
    },
    {
      id: "seed-left-front",
      slot: 0,
      label: "좌전 45°",
      src: samplePhotos[1],
      edits: defaultPhotoEdits(),
    },
  ],
  activeSlot: 2,
  cameraMode: "camera",
  maskPlate: false,
  previewIndex: 0,
  previewTool: null,
  pendingDelete: null,
  videoSegment: 0,
  videoRecording: false,
  videoDone: false,
  modal: null,
  toast: "",
  dragIndex: null,
  suppressPreviewUntil: 0,
};

const screen = document.querySelector("#screenRoot");

const captureInputs = createCaptureInputs();
const liveCamera = {
  stream: null,
  mode: null,
  renderId: 0,
  recorder: null,
  chunks: [],
};

const demoParams = new URLSearchParams(window.location.search);
if (demoParams.get("empty") === "1") {
  state.photos = [];
  state.activeSlot = 0;
}
if (["main", "camera", "preview", "video"].includes(demoParams.get("view"))) {
  state.view = demoParams.get("view");
  if (state.view === "preview" && !state.photos.length) state.view = "camera";
}
if (["camera", "album"].includes(demoParams.get("cameraMode"))) {
  state.cameraMode = demoParams.get("cameraMode");
}
if (demoParams.has("videoSegment")) {
  const segment = Number(demoParams.get("videoSegment"));
  if (Number.isFinite(segment)) state.videoSegment = Math.max(0, Math.min(3, segment));
}
if (demoParams.get("modal") === "rules") state.modal = "rules";
if (demoParams.get("modal") === "video-exit") {
  state.view = "video";
  state.videoRecording = true;
  state.modal = "video-exit";
}
if (demoParams.get("shot") === "1") {
  state.photos = [
    {
      id: "shot-left-front",
      slot: 0,
      label: "좌전 45°",
      src: samplePhotos[0],
      edits: defaultPhotoEdits(),
    },
  ];
  state.activeSlot = 1;
}
if (demoParams.has("photos")) {
  const count = Math.max(0, Math.min(30, Number(demoParams.get("photos")) || 0));
  state.photos = Array.from({ length: count }, (_, index) => ({
    id: `demo-photo-${index}`,
    slot: index,
    label: slots[index] || `기타 ${index + 1}`,
    src: samplePhotos[index % samplePhotos.length],
    edits: defaultPhotoEdits(),
  }));
  state.activeSlot = firstMissingSlot();
}

const iconPaths = {
  "chevron-left": '<path d="M15.5 5 8.5 12l7 7"/>',
  "chevron-right": '<path d="M8.5 5 15.5 12l-7 7"/>',
  x: '<path d="M6.5 6.5 17.5 17.5"/><path d="m17.5 6.5-11 11"/>',
  "circle-help":
    '<circle cx="12" cy="12" r="9"/><path d="M9.7 9.2c.4-1.5 1.6-2.4 3.2-2.2 1.5.2 2.6 1.2 2.6 2.6 0 1.2-.7 1.9-1.9 2.6-.9.5-1.3 1.1-1.3 2.1"/><path d="M12.2 17.2h.1"/>',
  "message-circle": '<path d="M5.2 18.1 4 21l3.4-1.1A8.2 8.2 0 1 0 5.2 18.1Z"/><path d="M8.3 10.4h7.4"/><path d="M8.3 13.6h5.2"/>',
  "trash-2":
    '<path d="M8 8.5v9"/><path d="M12 8.5v9"/><path d="M16 8.5v9"/><path d="M5.2 6.2h13.6"/><path d="M9 6.2l.7-2h4.6l.7 2"/><path d="M7 6.2 8 20h8l1-13.8"/>',
  camera:
    '<rect x="3.5" y="7" width="17" height="12" rx="2.4"/><path d="M8.4 7 9.8 4.7h4.4L15.6 7"/><circle cx="12" cy="13" r="3.4"/><path d="M17.2 9.4h.1"/>',
  "image-upload":
    '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m6.5 16.5 3.3-3.3 2.6 2.4 1.9-1.9 3.2 2.8"/><circle cx="15.8" cy="9" r="1.3"/><path d="M12 15.5V8.8"/><path d="m9.3 11.3 2.7-2.7 2.7 2.7"/>',
  video:
    '<rect x="3.5" y="6.5" width="12.3" height="11" rx="2.2"/><path d="m15.8 10.1 4.7-2.6v9l-4.7-2.6Z"/><path d="M8.7 10.1v3.8l3.3-1.9Z"/>',
  "badge-check": '<circle cx="12" cy="12" r="9"/><path d="m7.8 12.2 2.8 2.8 5.8-6.1"/>',
  badge:
    '<rect x="5" y="3.8" width="14" height="16.4" rx="2.5"/><path d="M8.2 8.3h7.6"/><path d="M8.2 12h7.6"/><path d="M8.2 15.7h5.2"/>',
  archive: '<path d="M4.5 7.2h15"/><path d="M6.2 7.2v11h11.6v-11"/><path d="M8 4.2h8l1.5 3H6.5Z"/><path d="M9.7 11.2h4.6"/>',
  "scan-face":
    '<path d="M4.5 9V5.8c0-.7.6-1.3 1.3-1.3H9"/><path d="M15 4.5h3.2c.7 0 1.3.6 1.3 1.3V9"/><path d="M19.5 15v3.2c0 .7-.6 1.3-1.3 1.3H15"/><path d="M9 19.5H5.8c-.7 0-1.3-.6-1.3-1.3V15"/><path d="M8.4 12.8c1.7 1.8 5.5 1.8 7.2 0"/><path d="M9.2 9.5h.1"/><path d="M14.7 9.5h.1"/>',
  grip: '<path d="M9 6.5h.1"/><path d="M15 6.5h.1"/><path d="M9 12h.1"/><path d="M15 12h.1"/><path d="M9 17.5h.1"/><path d="M15 17.5h.1"/>',
  "rotate-cw": '<path d="M17.7 8.3A6.7 6.7 0 1 0 18 16"/><path d="M17.7 4.5v3.8h-3.8"/>',
  crop: '<path d="M7 3.8v13.2h13.2"/><path d="M3.8 7h13.2v13.2"/><path d="M17 7v-3.2"/><path d="M7 17H3.8"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  play: '<path d="M8.5 5.8v12.4L18 12Z"/>',
  zap: '<path d="M13.2 2.8 4.8 13h6.3l-1.1 8.2 8.8-11h-6.4Z"/>',
};

function icon(name, size = 21) {
  const path = iconPaths[name] || iconPaths["circle-help"];
  return `<svg class="ui-icon ui-icon-${name}" viewBox="0 0 24 24" aria-hidden="true" style="width:${size}px;height:${size}px">${path}</svg>`;
}

function uploadAssetIcon(type, size = 42) {
  return `<img class="upload-asset-icon upload-asset-icon-${type}" src="./assets/${type}-upload-chotot.png" alt="" aria-hidden="true" style="width:${size}px;height:${size}px" />`;
}

function defaultPhotoEdits() {
  return {
    plate: false,
    mosaic: false,
    rotate: 0,
    crop: 0,
  };
}

function photoEdits(photo) {
  if (!photo.edits) photo.edits = defaultPhotoEdits();
  return photo.edits;
}

function photoLayerStyle(photo) {
  const edits = photoEdits(photo);
  const cropScales = [1, 1.14, 1.28];
  const scale = cropScales[edits.crop] || 1;
  return `background-image:url('${photo.src}');transform:rotate(${edits.rotate}deg) scale(${scale})`;
}

function photoEditBadges(photo, variant = "") {
  const edits = photoEdits(photo);
  const variantClass = variant ? ` ${variant}` : "";
  return `
    ${edits.plate ? `<span class="plate-mask${variantClass}" aria-hidden="true"></span>` : ""}
    ${edits.mosaic ? `<span class="mosaic-mask${variantClass}" aria-hidden="true"></span>` : ""}
  `;
}

function updateIcons() {
  return true;
}

function setView(view) {
  state.view = view;
  state.modal = null;
  render();
}

function setCameraMode(mode) {
  state.cameraMode = mode;
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

function audioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext.instance) audioContext.instance = new AudioContextClass();
  if (audioContext.instance.state === "suspended") audioContext.instance.resume().catch(() => {});
  return audioContext.instance;
}

function playBeep({ frequency = 880, duration = 0.08, gain = 0.12, type = "square", delay = 0 }) {
  const context = audioContext();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.006);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playClickNoise({ delay = 0, duration = 0.024, gain = 0.24, highpass = 1200 }) {
  const context = audioContext();
  if (!context) return;
  const start = context.currentTime + delay;
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const decay = 1 - index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.setValueAtTime(highpass, start);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(volume);
  volume.connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.01);
}

function playShutterSound() {
  playClickNoise({ gain: 0.32, duration: 0.018, highpass: 1800 });
  playClickNoise({ delay: 0.055, gain: 0.22, duration: 0.026, highpass: 950 });
}

function playRecordStartSound() {
  playBeep({ frequency: 880, duration: 0.07, gain: 0.13, type: "sine" });
}

function playRecordStopSound() {
  playBeep({ frequency: 660, duration: 0.06, gain: 0.12, type: "sine" });
  playBeep({ frequency: 440, duration: 0.07, gain: 0.1, type: "sine", delay: 0.075 });
}

function stopLiveCamera() {
  liveCamera.renderId += 1;
  if (liveCamera.recorder && liveCamera.recorder.state !== "inactive") {
    liveCamera.recorder.stop();
  }
  if (liveCamera.stream) {
    liveCamera.stream.getTracks().forEach((track) => track.stop());
  }
  liveCamera.stream = null;
  liveCamera.mode = null;
  liveCamera.recorder = null;
  liveCamera.chunks = [];
}

function attachLiveStream(video) {
  if (!video || !liveCamera.stream) return;
  if (video.srcObject !== liveCamera.stream) video.srcObject = liveCamera.stream;
  video.play().catch(() => {});
}

async function startLiveCamera(mode) {
  const video = screen.querySelector("[data-camera-preview]");
  const stage = screen.querySelector("[data-camera-stage]");
  const error = screen.querySelector("[data-camera-error]");
  if (!video) return;

  if (liveCamera.stream && liveCamera.mode === mode) {
    attachLiveStream(video);
    stage?.classList.add("is-live");
    return;
  }

  stopLiveCamera();
  const renderId = ++liveCamera.renderId;

  if (!navigator.mediaDevices?.getUserMedia) {
    if (error) error.textContent = "이 브라우저는 실시간 카메라를 지원하지 않습니다. 셔터를 누르면 기본 카메라를 엽니다.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    if (renderId !== liveCamera.renderId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    liveCamera.stream = stream;
    liveCamera.mode = mode;
    attachLiveStream(video);
    stage?.classList.add("is-live");
    if (error) error.textContent = "";
  } catch (errorObject) {
    if (error) error.textContent = "카메라 권한이 필요합니다. 권한 허용 후 다시 누르세요.";
    showToast("카메라 권한을 허용해 주세요");
  }
}

function photoDataUrlFromPreview() {
  const video = screen.querySelector("[data-camera-preview]");
  if (!video || !video.videoWidth || !video.videoHeight) return "";
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function addPhotoFromDataUrl(slot = state.activeSlot, src) {
  if (!src) {
    openPhotoCapture();
    return;
  }
  if (state.photos.length >= 30) {
    showToast("사진은 최대 30장까지 등록할 수 있습니다");
    return;
  }
  if (photoForSlot(slot)) {
    slot = firstMissingSlot();
  }
  state.photos.push({
    id: `camera-${Date.now()}-${slot}`,
    slot,
    label: slots[slot] || `기타 ${state.photos.length + 1}`,
    src,
    edits: defaultPhotoEdits(),
  });
  state.activeSlot = firstMissingSlot();
  state.progress = Math.max(state.progress, 38);
  showToast("사진이 등록되었습니다");
  render();
}

function capturePhotoFromLiveCamera() {
  if (!liveCamera.stream) {
    openPhotoCapture();
    return;
  }
  playShutterSound();
  addPhotoFromDataUrl(state.activeSlot, photoDataUrlFromPreview());
}

function toggleVideoRecording() {
  if (!liveCamera.stream || typeof MediaRecorder === "undefined") {
    openVideoCapture();
    return;
  }
  if (liveCamera.recorder && liveCamera.recorder.state === "recording") {
    playRecordStopSound();
    liveCamera.recorder.stop();
    return;
  }

  playRecordStartSound();
  liveCamera.chunks = [];
  const recorderOptions = MediaRecorder.isTypeSupported("video/webm") ? { mimeType: "video/webm" } : undefined;
  const recorder = new MediaRecorder(liveCamera.stream, recorderOptions);
  liveCamera.recorder = recorder;
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) liveCamera.chunks.push(event.data);
  });
  recorder.addEventListener("stop", () => {
    const blob = new Blob(liveCamera.chunks, { type: "video/webm" });
    state.videoDone = blob.size > 0;
    state.videoRecording = false;
    state.progress = Math.max(state.progress, 42);
    showToast("영상이 등록되었습니다");
  });
  recorder.start();
  state.videoRecording = true;
  render();
}

function firstMissingSlot() {
  const taken = new Set(state.photos.map((photo) => photo.slot));
  const priority = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return priority.find((slot) => !taken.has(slot)) ?? state.photos.length;
}

function photoForSlot(slot) {
  return state.photos.find((photo) => photo.slot === slot);
}

function createCaptureInputs() {
  const makeInput = ({ accept, capture, multiple = false }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.setAttribute("capture", capture);
    if (multiple) input.multiple = true;
    input.hidden = true;
    input.tabIndex = -1;
    document.body.appendChild(input);
    return input;
  };

  const inputs = {
    photoCamera: makeInput({ accept: "image/*", capture: "environment" }),
    photoAlbum: makeInput({ accept: "image/*", multiple: true }),
    videoCamera: makeInput({ accept: "video/*", capture: "environment" }),
  };

  inputs.photoCamera.addEventListener("change", () => {
    const file = inputs.photoCamera.files?.[0];
    if (file) addPhotoFromFile(state.activeSlot, file);
    inputs.photoCamera.value = "";
  });

  inputs.photoAlbum.addEventListener("change", () => {
    Array.from(inputs.photoAlbum.files || []).forEach((file) => addPhotoFromFile(firstMissingSlot(), file, false));
    inputs.photoAlbum.value = "";
    if (state.photos.length) {
      state.cameraMode = "camera";
      showToast("앨범 사진이 추가되었습니다");
    }
  });

  inputs.videoCamera.addEventListener("change", () => {
    const file = inputs.videoCamera.files?.[0];
    if (!file) return;
    state.videoRecording = false;
    state.videoDone = true;
    state.progress = Math.max(state.progress, 42);
    showToast("영상이 등록되었습니다");
    inputs.videoCamera.value = "";
  });

  return inputs;
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
    edits: defaultPhotoEdits(),
  };
  state.photos.push(photo);
  state.activeSlot = firstMissingSlot();
  state.progress = Math.max(state.progress, 38);
  render();
}

function addPhotoFromFile(slot = state.activeSlot, file, shouldRender = true) {
  if (state.photos.length >= 30) {
    showToast("사진은 최대 30장까지 등록할 수 있습니다");
    return;
  }
  if (photoForSlot(slot)) {
    slot = firstMissingSlot();
  }
  const photo = {
    id: `file-${Date.now()}-${slot}-${Math.random().toString(16).slice(2)}`,
    slot,
    label: slots[slot] || `기타 ${state.photos.length + 1}`,
    src: URL.createObjectURL(file),
    fileName: file.name,
    edits: defaultPhotoEdits(),
  };
  state.photos.push(photo);
  state.activeSlot = firstMissingSlot();
  state.progress = Math.max(state.progress, 38);
  if (shouldRender) render();
}

function openPhotoCapture() {
  captureInputs.photoCamera.click();
}

function openAlbumPicker() {
  captureInputs.photoAlbum.click();
}

function openVideoCapture() {
  captureInputs.videoCamera.click();
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
          <div class="section-title"><div class="title-with-required"><h3>차량 소재지</h3><span class="required">(필수)</span></div></div>
          <div class="field-line"><span>${state.city}</span>${icon("chevron-right", 20)}</div>
        </section>

        <section class="section">
          <div class="section-title">
            <div class="title-with-required"><h3>${completed ? "차량 사진 인식 완료" : "사진/영상 등록"}</h3><span class="required">(필수)</span></div>
            <button class="help-link" type="button" data-action="rules">${icon("circle-help", 16)} 촬영규칙</button>
          </div>
          <p class="alert-copy">첫 사진은 좌전 45° 차량 사진을 사용하면 <span>목록 노출 효과가 좋습니다.</span></p>
          ${
            completed
              ? `<div class="tip-card source-tip">
                  <div class="tip-head">
                    <span class="tip-icon">${icon("message-circle", 24)}</span>
                    <span>게시 팁</span>
                    <span class="tip-toggle">${icon("chevron-right", 18)}</span>
                  </div>
                  <p>노출을 높이려면 차량 각도 사진을 모두 올려주세요. 시스템 기준으로 아직 <b>${Math.max(0, 10 - state.photos.length)}</b>개 각도가 부족합니다.</p>
                </div>`
              : ""
          }
          <div class="media-grid ${completed ? "is-completed" : "is-empty"}" id="mainMediaGrid">
            ${state.photos
              .map(
                (photo, index) => {
                  const edits = photoEdits(photo);
                  return `
                  <div class="media-card" draggable="true" data-drag-index="${index}">
                    <button class="thumb" data-action="preview" data-index="${index}" aria-label="${photo.label} 미리보기">
                      <span class="thumb-layer ${edits.mosaic ? "is-mosaic" : ""}" style="${photoLayerStyle(photo)}"></span>
                      ${photoEditBadges(photo, "is-thumb")}
                    </button>
                    <button class="delete-chip" data-action="main-delete" data-id="${photo.id}" aria-label="사진 삭제">${icon("trash-2", 16)}</button>
                    <label>${photo.label}</label>
                  </div>`;
                },
              )
              .join("")}
            <button class="add-card count-card" type="button" data-action="photo-camera">
              ${uploadAssetIcon("photo", 42)}
              <span>${completed ? `${state.photos.length}/30` : "사진 추가"}</span>
            </button>
            <button class="add-card" type="button" data-action="video">
              ${uploadAssetIcon("video", 42)}
              <span>${state.videoDone ? "영상 완료" : "영상 추가"}</span>
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-title"><div class="title-with-required"><h3>차량 인증</h3><span class="required">(하나 선택)</span></div></div>
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
          <div class="section-title"><div class="title-with-required"><h3>VIN번호</h3><span class="required">(필수)</span>${icon("circle-help", 17)}</div></div>
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
          ? `<div class="album-guide-pill">우선 등록 각도: 좌전45° · 정면 · 우전45° · 측면</div>
             <div class="album-grid">
              ${samplePhotos
                .map(
                  (src, index) => `<button class="album-item" data-action="album-photo" data-index="${index}" style="background-image:url('${src}')" aria-label="앨범 사진 ${index + 1}"></button>`,
                )
                .join("")}
             </div>`
          : `<div class="camera-stage" data-camera-stage>
              <video class="live-camera-feed" data-camera-preview playsinline autoplay muted></video>
              <div class="guide-pill">촬영 ${slots[state.activeSlot]}</div>
              <p class="camera-permission-copy" data-camera-error>카메라 권한을 허용하면 실제 화면이 표시됩니다.</p>
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
              <button class="shutter" data-action="capture-photo" type="button" aria-label="촬영"></button>
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
      ${androidNav()}
      ${toastLayer()}
    </div>`;
}

function previewView() {
  const photo = state.photos[state.previewIndex];
  if (!photo) {
    return mainView();
  }
  const edits = photoEdits(photo);
  return `
    <div class="preview-view">
      <header class="dark-topbar">
        <button class="icon-button dark-button" data-action="preview-close" aria-label="닫기">${icon("x", 30)}</button>
        <h2>사진 미리보기(${state.previewIndex + 1})</h2>
        <span></span>
      </header>
      <div class="preview-photo">
        <div class="preview-photo-layer ${edits.mosaic ? "is-mosaic" : ""}" style="${photoLayerStyle(photo)}"></div>
        ${photoEditBadges(photo)}
      </div>
      <div class="preview-rail">
        <button class="preview-add" data-action="preview-add" type="button" aria-label="사진 추가">${icon("plus", 30)}</button>
        ${state.photos
          .map(
            (item, index) => {
              const itemEdits = photoEdits(item);
              return `
              <div class="preview-item ${index === state.previewIndex ? "is-active" : ""}">
                <button class="preview-thumb" data-action="preview-pick" data-index="${index}" aria-label="${item.label} 선택">
                  <span class="thumb-layer ${itemEdits.mosaic ? "is-mosaic" : ""}" style="${photoLayerStyle(item)}"></span>
                  ${photoEditBadges(item, "is-thumb")}
                </button>
                <button class="preview-delete" data-action="preview-delete" data-id="${item.id}" aria-label="사진 삭제">×</button>
                <span class="preview-label">${item.label}</span>
              </div>`;
            },
          )
          .join("")}
      </div>
      <div class="tool-row">
        ${[
          ["plate", "scan-face", "번호판", edits.plate],
          ["mosaic", "grip", "모자이크", edits.mosaic],
          ["rotate", "rotate-cw", "회전", edits.rotate !== 0],
          ["crop", "crop", "자르기", edits.crop > 0],
        ]
          .map(
            ([key, iconName, label, active]) => `<button class="edit-tool ${state.previewTool === key || active ? "is-active" : ""}" data-action="tool" data-tool="${key}" type="button">${icon(iconName, 27)}${label}</button>`,
          )
          .join("")}
        <button class="preview-finish" data-action="preview-finish" type="button">완료</button>
      </div>
      ${androidNav()}
      ${toastLayer()}
    </div>`;
}

function videoView() {
  const segmentNames = ["차량외관", "차내장식", "엔진룸", "트렁크"];
  return `
    <div class="video-view">
      <header class="dark-topbar">
        <button class="icon-button dark-button" data-action="video-close" aria-label="닫기">${icon("x", 30)}</button>
        <h2>차량 영상</h2>
        <button class="icon-button dark-button flash-button" type="button" aria-label="플래시">${icon("zap", 31)}</button>
      </header>
      <div class="video-stage" data-camera-stage>
        <video class="live-camera-feed" data-camera-preview playsinline autoplay muted></video>
        <div class="guide-pill">촬영 ${segmentNames[state.videoSegment]}</div>
        <div class="video-frame-line"></div>
        <p class="video-guide-copy">촬영 항목이 맞는지 확인해 주세요</p>
        <p class="camera-permission-copy video-permission-copy" data-camera-error>카메라 권한을 허용하면 실제 화면이 표시됩니다.</p>
      </div>
      <div class="video-segments">
        ${segmentNames
          .map(
            (name, index) => `<button class="segment-step ${state.videoSegment === index ? "is-active" : ""}" data-action="video-segment" data-index="${index}" type="button" style="--segment-image:url('${videoTemplateImages[index]}')"><span>${index === state.videoSegment ? "예시" : ""}</span><b>${name}</b></button>`,
          )
          .join("")}
      </div>
      <div class="video-controls">
        <span class="record-timer">${state.videoRecording ? "00:08" : ""}</span>
        <button class="record-button ${state.videoRecording ? "is-recording" : ""}" data-action="record" type="button" aria-label="녹화"></button>
        <button class="next-video" data-action="video-next" type="button">${state.videoSegment === 3 ? "완료" : "다음"}</button>
      </div>
      <div class="mode-tabs video-mode-tabs">
        <button class="is-active" type="button">촬영</button>
        <button type="button">앨범</button>
      </div>
      ${androidNav()}
      ${modalLayer()}
      ${toastLayer()}
    </div>`;
}

function androidNav() {
  return `<div class="android-nav" aria-hidden="true"><span class="nav-square"></span><span class="nav-circle"></span><span class="nav-triangle"></span></div>`;
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
  screen.closest(".phone-frame").dataset.view = state.view;
  if (state.view === "camera") screen.innerHTML = cameraView();
  if (state.view === "preview") screen.innerHTML = previewView();
  if (state.view === "video") screen.innerHTML = videoView();
  if (state.view === "main") screen.innerHTML = mainView();
  bindEvents();
  updateIcons();
  if (state.view === "camera" && state.cameraMode === "camera") {
    startLiveCamera("photo");
  } else if (state.view === "video") {
    startLiveCamera("video");
  } else {
    stopLiveCamera();
  }
}

function bindEvents() {
  screen.querySelectorAll("[data-file-action]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const action = target.dataset.fileAction;
      if (action === "photo-camera") {
        const file = target.files?.[0];
        if (file) addPhotoFromFile(state.activeSlot, file);
      }
      if (action === "photo-album") {
        Array.from(target.files || []).forEach((file) => addPhotoFromFile(firstMissingSlot(), file, false));
        if (state.photos.length) {
          state.cameraMode = "camera";
          showToast("앨범 사진이 추가되었습니다");
        }
      }
      if (action === "video-camera") {
        const file = target.files?.[0];
        if (file) {
          state.videoRecording = false;
          state.videoDone = true;
          state.progress = Math.max(state.progress, 42);
          showToast("영상이 등록되었습니다");
        }
      }
      target.value = "";
    });
  });

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
      if (action === "preview") {
        if (Date.now() < state.suppressPreviewUntil) return;
        openPreview(Number(target.dataset.index));
      }
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
      if (action === "capture-photo") capturePhotoFromLiveCamera();
      if (action === "finish-camera") {
        if (!state.photos.length) {
          showToast("사진을 최소 1장 등록해 주세요");
        } else {
          setView("main");
        }
      }
      if (action === "mode-camera") {
        setCameraMode("camera");
      }
      if (action === "mode-album") {
        setCameraMode("album");
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
        const tool = target.dataset.tool;
        const photo = state.photos[state.previewIndex];
        const edits = photoEdits(photo);
        state.previewTool = tool;
        if (tool === "plate") {
          edits.plate = !edits.plate;
          showToast(edits.plate ? "번호판 가림 적용" : "번호판 가림 해제");
        }
        if (tool === "mosaic") {
          edits.mosaic = !edits.mosaic;
          showToast(edits.mosaic ? "모자이크 적용" : "모자이크 해제");
        }
        if (tool === "rotate") {
          edits.rotate = (edits.rotate + 90) % 360;
          showToast("사진을 회전했습니다");
        }
        if (tool === "crop") {
          edits.crop = (edits.crop + 1) % 3;
          showToast(edits.crop ? "자르기 영역 조정" : "자르기 원본 비율");
        }
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
      if (action === "record") toggleVideoRecording();
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
    let dragStarted = false;
    let targetIndex = null;
    let cardRects = [];

    card.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });
    card.addEventListener("dragend", () => {
      state.dragIndex = Number(card.dataset.dragIndex);
      state.dragIndex = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      movePhoto(state.dragIndex, Number(card.dataset.dragIndex));
    });
    card.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".delete-chip")) return;
      startX = event.clientX;
      startY = event.clientY;
      pointerDragging = true;
      dragStarted = false;
      targetIndex = Number(card.dataset.dragIndex);
      state.dragIndex = Number(card.dataset.dragIndex);
      cardRects = Array.from(screen.querySelectorAll("#mainMediaGrid .media-card")).map((item) => ({
        index: Number(item.dataset.dragIndex),
        rect: item.getBoundingClientRect(),
      }));
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointermove", (event) => {
      if (!pointerDragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragStarted && Math.hypot(dx, dy) > 10) {
        dragStarted = true;
        card.classList.add("touch-dragging");
        state.suppressPreviewUntil = Date.now() + 500;
      }
      if (!dragStarted) return;

      card.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
      const hover = cardRects.find(({ rect }) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
      if (hover && hover.index !== targetIndex) {
        targetIndex = hover.index;
        screen.querySelectorAll("#mainMediaGrid .media-card").forEach((item) => item.classList.toggle("is-drop-target", Number(item.dataset.dragIndex) === targetIndex));
      }
    });
    card.addEventListener("pointerup", (event) => {
      if (!pointerDragging) return;
      pointerDragging = false;
      card.style.transform = "";
      card.classList.remove("touch-dragging");
      screen.querySelectorAll("#mainMediaGrid .media-card").forEach((item) => item.classList.remove("is-drop-target"));
      if (!dragStarted) return;
      state.suppressPreviewUntil = Date.now() + 500;
      const from = Number(card.dataset.dragIndex);
      const to = targetIndex ?? from;
      if (from !== to) movePhoto(from, to);
    });
  });

  const cameraViewElement = screen.querySelector(".camera-view");
  if (cameraViewElement) {
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartedOnRail = false;

    cameraViewElement.addEventListener("pointerdown", (event) => {
      swipeStartX = event.clientX;
      swipeStartY = event.clientY;
      swipeStartedOnRail = Boolean(event.target.closest(".slot-rail") || event.target.closest(".album-grid") || event.target.closest(".native-file-input"));
    });

    cameraViewElement.addEventListener("pointerup", (event) => {
      if (swipeStartedOnRail) return;
      const dx = event.clientX - swipeStartX;
      const dy = event.clientY - swipeStartY;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (state.cameraMode === "camera") {
        setCameraMode("album");
        showToast("앨범으로 이동했습니다");
      } else {
        setCameraMode("camera");
      }
    });
  }
}

render();
