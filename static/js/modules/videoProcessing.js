import { showError, hideError } from "./errorHandling.js";
import { getSubtitleStyles } from "./subtitles.js";
import { downloadFile } from "./fileHandling.js";

export async function processVideoWithPosition(currentFileId) {
  const position = document.getElementById("crop-position").value;
  const volume = document.getElementById("volume-slider").value;
  const language = document.getElementById("language-select").value;
  const shouldBurnSubtitles = document.getElementById("burn-subtitles").checked;

  // Hide processing section and show progress
  document.getElementById("processing-section").classList.add("hidden");
  document.getElementById("progress-section").classList.remove("hidden");
  document.getElementById("progress-text").textContent = "Processing video...";

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
      document.getElementById("progress-section").classList.add("hidden");

      return transcribeData.processing_params;
    }

    // If no subtitles needed, proceed with normal processing
    return await renderWithSubtitles(true, currentFileId);
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
      processVideoWithPosition(currentFileId);
    };
  }
}

export async function renderWithSubtitles(
  skipEdit,
  currentFileId,
  currentProcessingParams = null
) {
  try {
    document.getElementById("progress-section").classList.remove("hidden");
    document.getElementById("subtitle-editor").style.display = "none";
    document.getElementById("progress-text").textContent =
      "Processing video...";

    const params = currentProcessingParams || {
      target_ratio: "9:16",
      position: document.getElementById("crop-position").value,
      volume: document.getElementById("volume-slider").value,
      language: document.getElementById("language-select").value,
    };

    const renderData = {
      skip_edit: skipEdit,
      srt_content: skipEdit
        ? null
        : document.getElementById("subtitle-text").value,
      subtitle_styles: getSubtitleStyles(),
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
    document.getElementById("progress-section").classList.add("hidden");
    document.getElementById("download-section").classList.remove("hidden");

    // Update download buttons with file information
    updateDownloadButtons(
      responseData.output_file,
      responseData.transcript_files || {},
      currentFileId
    );
  } catch (error) {
    console.error("Error:", error);

    let errorMessage =
      error.message || "An error occurred while processing the video";
    let errorTitle = "Processing Error";

    if (error.technical) {
      errorMessage = `${errorMessage}\n\nTechnical details: ${error.technical}`;
    }

    showError(errorTitle, errorMessage, error.canRetry !== false);

    if (error.canRetry !== false) {
      document.getElementById("retry-button").onclick = () => {
        hideError();
        renderWithSubtitles(skipEdit, currentFileId, currentProcessingParams);
      };
    }
  }
}

function updateDownloadButtons(outputFile, transcriptFiles, currentFileId) {
  // Video download button
  const videoBtn = document.getElementById("download-video-btn");
  if (outputFile) {
    videoBtn.onclick = () =>
      downloadFile(outputFile, outputFile.split("/").pop(), currentFileId);
    videoBtn.disabled = false;
    videoBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    videoBtn.disabled = true;
    videoBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // SRT download button
  const srtBtn = document.getElementById("download-srt-btn");
  if (transcriptFiles.srt) {
    srtBtn.onclick = () =>
      downloadFile(transcriptFiles.srt, `transcript_${currentFileId}.srt`);
    srtBtn.disabled = false;
    srtBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    srtBtn.disabled = true;
    srtBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // TXT download button
  const txtBtn = document.getElementById("download-txt-btn");
  if (transcriptFiles.txt) {
    txtBtn.onclick = () =>
      downloadFile(transcriptFiles.txt, `transcript_${currentFileId}.txt`);
    txtBtn.disabled = false;
    txtBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    txtBtn.disabled = true;
    txtBtn.classList.add("opacity-50", "cursor-not-allowed");
  }
}
