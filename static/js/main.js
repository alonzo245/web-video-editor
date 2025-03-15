let currentFileId = null;
let originalWidth = 0;
let originalHeight = 0;
const dropZone = document.getElementById("upload-section");
const videoInput = document.getElementById("video-input");
const processingSection = document.getElementById("processing-section");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const downloadSection = document.getElementById("download-section");
const downloadBtn = document.getElementById("download-btn");
const verticalOptions = document.getElementById("vertical-options");
const cropPreview = document.getElementById("crop-preview");
const videoPreview = document.getElementById("video-preview");
const playPauseBtn = document.getElementById("playPauseBtn");
const videoProgressBar = document.getElementById("videoProgressBar");
const videoTimeDisplay = document.getElementById("videoTime");
const burnSubtitles = document.getElementById("burn-subtitles");
const languageSelect = document.getElementById("language-select");

let currentProcessingParams = null;

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

dropZone.addEventListener("drop", handleDrop, false);
videoInput.addEventListener("change", handleFileSelect, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFileSelect(e) {
  const files = e.target.files;
  handleFiles(files);
}

async function handleFiles(files) {
  if (files.length === 0) return;

  const file = files[0];
  if (!file.type.startsWith("video/")) {
    alert("Please select a video file");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    const data = await response.json();
    currentFileId = data.file_id;
    originalWidth = data.dimensions.width;
    originalHeight = data.dimensions.height;

    // Set up video preview
    videoPreview.src = URL.createObjectURL(file);
    videoPreview.load();
    videoPreview.pause(); // Ensure video is paused after loading

    // Show processing section
    document.getElementById("upload-section").classList.add("hidden");
    processingSection.classList.remove("hidden");
  } catch (error) {
    alert("Error uploading video: " + error.message);
  }
}

function showVerticalOptions() {
  verticalOptions.classList.remove("hidden");
  updateCropPreview(50); // Center position
}

function updateCropPreview(position) {
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
}

function showError(title, message, canRetry = false) {
  const errorSection = document.getElementById("error-section");
  const errorTitle = document.getElementById("error-title");
  const errorMessage = document.getElementById("error-message");
  const retryButton = document.getElementById("retry-button");

  // Format error message for display
  const formattedMessage = message.split("\n").join("<br>");

  errorTitle.textContent = title;
  errorMessage.innerHTML = formattedMessage; // Use innerHTML to support line breaks
  retryButton.style.display = canRetry ? "block" : "none";

  // Hide other sections
  progressSection.classList.add("hidden");
  document.getElementById("subtitle-editor").style.display = "none";

  // Show error section
  errorSection.classList.remove("hidden");
}

function hideError() {
  const errorSection = document.getElementById("error-section");
  errorSection.classList.add("hidden");

  // Show appropriate section based on current state
  if (document.getElementById("subtitle-text").value) {
    document.getElementById("subtitle-editor").style.display = "block";
  } else {
    processingSection.classList.remove("hidden");
  }
}

async function processVideoWithPosition() {
  const position = document.getElementById("crop-position").value;
  const volume = document.getElementById("volume-slider").value;
  const language = document.getElementById("language-select").value;
  const shouldBurnSubtitles = document.getElementById("burn-subtitles").checked;

  // Hide processing section and show progress
  processingSection.classList.add("hidden");
  progressSection.classList.remove("hidden");
  progressText.textContent = "Processing video...";

  try {
    if (shouldBurnSubtitles && language) {
      // First step: Generate transcription
      const transcribeResponse = await fetch(
        `/transcribe/${currentFileId}?language=${language}&target_ratio=9:16&position=${position}&volume=${volume}`,
        {
          method: "POST",
        }
      );

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.detail || "Transcription failed");
      }

      const transcribeData = await transcribeResponse.json();

      // Show subtitle editor
      document.getElementById("subtitle-text").value =
        transcribeData.srt_content;
      document.getElementById("subtitle-editor").style.display = "block";
      progressSection.classList.add("hidden");

      // Store processing parameters
      currentProcessingParams = transcribeData.processing_params;

      // Set up button handlers
      document.getElementById("save-and-render").onclick = () =>
        renderWithSubtitles(false);
      document.getElementById("skip-edit").onclick = () =>
        renderWithSubtitles(true);

      return;
    }

    // If no subtitles needed, proceed with normal processing
    await renderWithSubtitles(true);
  } catch (error) {
    console.error("Error:", error);
    showError(
      "Processing Error",
      error.message || "An error occurred while processing the video",
      true
    );

    // Set up retry button
    document.getElementById("retry-button").onclick = () => {
      hideError();
      processVideoWithPosition();
    };
  }
}

async function processVideo(
  ratio,
  position = 50,
  volume = 100,
  language = "",
  shouldBurnSubtitles = false
) {
  if (!currentFileId) return;

  processingSection.classList.add("hidden");
  progressSection.classList.remove("hidden");

  try {
    document.getElementById("processing-status").textContent =
      "Transcribing...";

    if (shouldBurnSubtitles && language !== "none") {
      // First step: Generate transcription
      const transcribeResponse = await fetch(
        `/transcribe/${currentFileId}?language=${language}&target_ratio=${ratio}&position=${position}&volume=${volume}`,
        {
          method: "POST",
        }
      );

      if (!transcribeResponse.ok) {
        throw new Error(
          `Transcription failed: ${await transcribeResponse.text()}`
        );
      }

      const transcribeData = await transcribeResponse.json();

      // Show subtitle editor
      document.getElementById("subtitle-text").value =
        transcribeData.srt_content;
      document.getElementById("subtitle-editor").style.display = "block";
      document.getElementById("processing-status").textContent =
        "Edit subtitles if needed, then click Save and Render";

      // Store processing parameters
      currentProcessingParams = transcribeData.processing_params;

      // Set up button handlers
      document.getElementById("save-and-render").onclick = () =>
        renderWithSubtitles(false);
      document.getElementById("skip-edit").onclick = () =>
        renderWithSubtitles(true);

      return;
    }

    // If no subtitles needed, proceed with normal processing
    await renderWithSubtitles(true);
  } catch (error) {
    console.error("Error:", error);
    progressText.textContent = "Error processing video";
    progressBar.style.width = "0%";
    processingSection.classList.remove("hidden");
  }
}

async function renderWithSubtitles(skipEdit) {
  try {
    progressSection.classList.remove("hidden");
    document.getElementById("subtitle-editor").style.display = "none";
    progressText.textContent = "Processing video...";

    const params = currentProcessingParams || {
      target_ratio: "9:16",
      position: document.getElementById("crop-position").value,
      volume: document.getElementById("volume-slider").value,
      language: document.getElementById("language-select").value,
    };

    // Add subtitle styling parameters
    const subtitleStyles = {
      fontSize: document.getElementById("subtitle-size").value,
      fontColor: document
        .getElementById("subtitle-color")
        .value.replace("#", ""),
      borderSize: document.getElementById("subtitle-border").value,
      borderColor: document
        .getElementById("subtitle-border-color")
        .value.replace("#", ""),
      yPosition: document.getElementById("subtitle-y").value,
    };

    const renderData = {
      skip_edit: skipEdit,
      srt_content: skipEdit
        ? null
        : document.getElementById("subtitle-text").value,
      subtitle_styles: subtitleStyles,
      ...params,
    };

    const renderResponse = await fetch(`/render/${currentFileId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(renderData),
    });

    if (!renderResponse.ok) {
      const errorData = await renderResponse.json();
      throw {
        message: errorData.detail.message || "Video processing failed",
        technical: errorData.detail.technical_details,
        canRetry: errorData.detail.can_retry,
      };
    }

    const responseData = await renderResponse.json();

    // Hide progress and show download section
    progressSection.classList.add("hidden");
    downloadSection.classList.remove("hidden");

    // Update download buttons with file information
    const transcriptFiles = responseData.transcript_files || {};
    updateDownloadButtons(responseData.output_file, transcriptFiles);
  } catch (error) {
    console.error("Error:", error);

    let errorMessage =
      error.message || "An error occurred while processing the video";
    let errorTitle = "Processing Error";

    if (error.technical) {
      errorMessage = `${errorMessage}\n\nTechnical details: ${error.technical}`;
    }

    // Show error with retry option if available
    showError(
      errorTitle,
      errorMessage,
      error.canRetry !== false // Default to true if not specified
    );

    // Set up retry button if retry is allowed
    if (error.canRetry !== false) {
      document.getElementById("retry-button").onclick = () => {
        hideError();
        renderWithSubtitles(skipEdit);
      };
    }
  }
}

// Video control functions
function togglePlay() {
  if (videoPreview.paused) {
    videoPreview.play();
    playPauseBtn.querySelector(".play-icon").classList.add("hidden");
    playPauseBtn.querySelector(".pause-icon").classList.remove("hidden");
  } else {
    videoPreview.pause();
    playPauseBtn.querySelector(".play-icon").classList.remove("hidden");
    playPauseBtn.querySelector(".pause-icon").classList.add("hidden");
  }
}

function restartVideo() {
  videoPreview.currentTime = 0;
  if (videoPreview.paused) {
    togglePlay();
  }
}

function seekVideo(event) {
  const progress = document.getElementById("videoProgress");
  const position = (event.pageX - progress.offsetLeft) / progress.offsetWidth;
  videoPreview.currentTime = position * videoPreview.duration;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Update video progress
videoPreview.addEventListener("timeupdate", () => {
  const progress = (videoPreview.currentTime / videoPreview.duration) * 100;
  videoProgressBar.style.width = `${progress}%`;
  videoTimeDisplay.textContent = `${formatTime(
    videoPreview.currentTime
  )} / ${formatTime(videoPreview.duration)}`;
});

// Update play/pause button on video end
videoPreview.addEventListener("ended", () => {
  playPauseBtn.querySelector(".play-icon").classList.remove("hidden");
  playPauseBtn.querySelector(".pause-icon").classList.add("hidden");
});

function updateVolume(value) {
  const volumeDisplay = document.getElementById("volume-display");
  const volumeIcon = document.getElementById("volume-icon");
  volumeDisplay.textContent = `${value}%`;

  // Update volume icon based on value
  if (value == 0) {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />`;
  } else if (value < 50) {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M15.536 8.464a5 5 0 010 7.072" />`;
  } else {
    volumeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M15.536 8.464a5 5 0 010 7.072 M17.536 6.464a9 9 0 010 11.072" />`;
  }

  // Update video preview volume
  videoPreview.volume = value / 100;
}

function toggleMute() {
  const volumeSlider = document.getElementById("volume-slider");
  if (videoPreview.volume > 0) {
    videoPreview.dataset.previousVolume = volumeSlider.value;
    volumeSlider.value = 0;
    updateVolume(0);
  } else {
    const previousVolume = videoPreview.dataset.previousVolume || 100;
    volumeSlider.value = previousVolume;
    updateVolume(previousVolume);
  }
}

// Add event listener to language select
languageSelect.addEventListener("change", (e) => {
  if (!e.target.value) {
    // If "No transcription" is selected, uncheck and disable burn subtitles
    burnSubtitles.checked = false;
    burnSubtitles.disabled = true;
  } else {
    // Enable burn subtitles option when a language is selected
    burnSubtitles.disabled = false;
  }
});

function updateSubtitlePreview() {
  const preview = document.getElementById("subtitle-preview");
  const size = document.getElementById("subtitle-size").value;
  const color = document.getElementById("subtitle-color").value;
  const borderSize = document.getElementById("subtitle-border").value;
  const borderColor = document.getElementById("subtitle-border-color").value;
  const yPosition = document.getElementById("subtitle-y").value;

  // Update value displays
  document.getElementById("size-value").textContent = `${size}px`;
  document.getElementById("border-value").textContent = `${borderSize}px`;
  document.getElementById("y-value").textContent = `${yPosition}%`;

  // Apply styles to preview
  preview.style.fontSize = `${size}px`;
  preview.style.color = color;
  preview.style.textShadow =
    borderSize > 0
      ? `0 0 ${borderSize}px ${borderColor}, 0 0 ${borderSize}px ${borderColor}, 0 0 ${borderSize}px ${borderColor}`
      : "none";
  preview.style.bottom = `${100 - yPosition}%`;
  preview.style.transform = "translateY(50%)";
}

// Update the download section handlers
function updateDownloadButtons(outputFile, transcriptFiles = {}) {
  // Video download button
  const videoBtn = document.getElementById("download-video-btn");
  if (outputFile) {
    videoBtn.onclick = async () => {
      try {
        const response = await fetch(
          `/download/${outputFile.split("/").pop()}`
        );
        if (!response.ok) throw new Error("Download failed");

        // Create a temporary anchor and trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outputFile.split("/").pop();
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Clean up files after successful download
        await fetch(`/confirm-download/${currentFileId}`, { method: "POST" });
      } catch (error) {
        console.error("Download error:", error);
        showError(
          "Download Failed",
          error.message || "Failed to download the video file"
        );
      }
    };
    videoBtn.disabled = false;
    videoBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    videoBtn.disabled = true;
    videoBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // SRT download button
  const srtBtn = document.getElementById("download-srt-btn");
  if (transcriptFiles && transcriptFiles.srt) {
    srtBtn.onclick = async () => {
      try {
        const response = await fetch(
          `/download/${transcriptFiles.srt.split("/").pop()}`
        );
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript_${currentFileId}.srt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Download error:", error);
        showError(
          "Download Failed",
          error.message || "Failed to download the SRT file"
        );
      }
    };
    srtBtn.disabled = false;
    srtBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    srtBtn.disabled = true;
    srtBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // TXT download button
  const txtBtn = document.getElementById("download-txt-btn");
  if (transcriptFiles && transcriptFiles.txt) {
    txtBtn.onclick = async () => {
      try {
        const response = await fetch(
          `/download/${transcriptFiles.txt.split("/").pop()}`
        );
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript_${currentFileId}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Download error:", error);
        showError(
          "Download Failed",
          error.message || "Failed to download the TXT file"
        );
      }
    };
    txtBtn.disabled = false;
    txtBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    txtBtn.disabled = true;
    txtBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // Upload new video button
  document.getElementById("new-video-btn").onclick = () => {
    // Reset the application state
    currentFileId = null;
    document.getElementById("video-preview").src = "";
    document.getElementById("subtitle-editor").style.display = "none";
    document.getElementById("processing-section").classList.add("hidden");
    document.getElementById("progress-section").classList.add("hidden");
    document.getElementById("download-section").classList.add("hidden");
    document.getElementById("error-section").classList.add("hidden");
    document.getElementById("upload-section").classList.remove("hidden");

    // Reset form values
    document.getElementById("video-input").value = "";
    document.getElementById("crop-position").value = 50;
    document.getElementById("volume-slider").value = 100;
    document.getElementById("language-select").value = "";
    document.getElementById("burn-subtitles").checked = false;

    // Reset subtitle customization
    document.getElementById("subtitle-size").value = 24;
    document.getElementById("subtitle-color").value = "#ffffff";
    document.getElementById("subtitle-border").value = 2;
    document.getElementById("subtitle-border-color").value = "#000000";
    document.getElementById("subtitle-y").value = 90;
    updateSubtitlePreview();
  };
}

function updatePreviewAspectRatio(ratio) {
  const aspectRatioBox = document.querySelector(".aspect-ratio-box");
  if (ratio === "9:16") {
    aspectRatioBox.style.paddingTop = "177.78%"; // (16/9 * 100)
  } else {
    aspectRatioBox.style.paddingTop = "56.25%"; // (9/16 * 100)
  }
}

// Update the aspect ratio when ratio buttons are clicked
document
  .querySelector('button[onclick="showVerticalOptions()"]')
  .addEventListener("click", () => {
    updatePreviewAspectRatio("9:16");
  });
document
  .querySelector("button[onclick=\"processVideo('16:9')\"]")
  .addEventListener("click", () => {
    updatePreviewAspectRatio("16:9");
  });
