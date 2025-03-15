import * as videoControls from "./modules/videoControls.js";
import * as subtitles from "./modules/subtitles.js";
import * as fileHandling from "./modules/fileHandling.js";
import * as videoProcessing from "./modules/videoProcessing.js";

// State variables
let currentFileId = null;
let originalWidth = 0;
let originalHeight = 0;
let currentProcessingParams = null;

// DOM Elements
const dropZone = document.getElementById("upload-section");
const videoInput = document.getElementById("video-input");
const videoPreview = document.getElementById("video-preview");
const playPauseBtn = document.getElementById("playPauseBtn");
const burnSubtitles = document.getElementById("burn-subtitles");
const languageSelect = document.getElementById("language-select");

// Drag and drop handlers
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, highlight, false);
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
  dropZone.classList.add("dragover");
}

function unhighlight(e) {
  dropZone.classList.remove("dragover");
}

// Event Listeners
dropZone.addEventListener("drop", handleDrop, false);
videoInput.addEventListener("change", handleFileSelect, false);

async function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  const result = await fileHandling.handleFiles(files, videoPreview);
  if (result) {
    currentFileId = result.currentFileId;
    originalWidth = result.originalWidth;
    originalHeight = result.originalHeight;
  }
}

async function handleFileSelect(e) {
  const files = e.target.files;
  const result = await fileHandling.handleFiles(files, videoPreview);
  if (result) {
    currentFileId = result.currentFileId;
    originalWidth = result.originalWidth;
    originalHeight = result.originalHeight;
  }
}

// Video preview controls
videoPreview.addEventListener("timeupdate", () => {
  const progress = (videoPreview.currentTime / videoPreview.duration) * 100;
  document.getElementById("videoProgressBar").style.width = `${progress}%`;
  document.getElementById(
    "videoTime"
  ).textContent = `${videoControls.formatTime(
    videoPreview.currentTime
  )} / ${videoControls.formatTime(videoPreview.duration)}`;
});

videoPreview.addEventListener("ended", () => {
  playPauseBtn.querySelector(".play-icon").classList.remove("hidden");
  playPauseBtn.querySelector(".pause-icon").classList.add("hidden");
});

// Language select handler
languageSelect.addEventListener("change", (e) => {
  if (!e.target.value) {
    burnSubtitles.checked = false;
    burnSubtitles.disabled = true;
  } else {
    burnSubtitles.disabled = false;
  }
});

// Export functions for HTML event handlers
window.showVerticalOptions = () => {
  document.getElementById("vertical-options").classList.remove("hidden");
  updateCropPreview(50); // Center position
};

window.updateCropPreview = (position) => {
  const newWidth = Math.floor(originalHeight * (9 / 16));
  const maxOffset = originalWidth - newWidth;
  const offset = (position / 100) * maxOffset;

  // Calculate preview dimensions as percentages
  const previewWidth = (newWidth / originalWidth) * 100;
  const previewOffset = (offset / originalWidth) * 100;

  // Update crop frame position and width
  const cropFrame = document.getElementById("crop-preview");
  cropFrame.style.width = `${previewWidth}%`;
  cropFrame.style.left = `${previewOffset}%`;
};

window.processVideoWithPosition = async () => {
  currentProcessingParams = await videoProcessing.processVideoWithPosition(
    currentFileId
  );

  // Initialize subtitle handlers after we have the processing parameters
  if (currentProcessingParams) {
    subtitles.initializeSubtitleEditorHandlers(
      videoProcessing,
      currentFileId,
      currentProcessingParams
    );
  }
};

window.processVideo = async (
  ratio,
  position = 50,
  volume = 100,
  language = "",
  shouldBurnSubtitles = false
) => {
  if (!currentFileId) return;
  currentProcessingParams = await videoProcessing.processVideoWithPosition(
    currentFileId
  );

  // Initialize subtitle handlers after we have the processing parameters
  if (currentProcessingParams) {
    subtitles.initializeSubtitleEditorHandlers(
      videoProcessing,
      currentFileId,
      currentProcessingParams
    );
  }
};

window.togglePlay = () => videoControls.togglePlay(videoPreview, playPauseBtn);
window.restartVideo = () => videoControls.restartVideo(videoPreview);
window.seekVideo = (event) => videoControls.seekVideo(event, videoPreview);
window.updateVolume = (value) =>
  videoControls.updateVolume(value, videoPreview);
window.toggleMute = () => videoControls.toggleMute(videoPreview);
window.updateSubtitlePreview = subtitles.updateSubtitlePreview;
window.updatePreviewAspectRatio = subtitles.updatePreviewAspectRatio;
