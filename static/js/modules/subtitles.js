export function updateSubtitlePreview() {
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

export function updatePreviewAspectRatio(ratio) {
  const aspectRatioBox = document.querySelector(".aspect-ratio-box");
  if (ratio === "9:16") {
    aspectRatioBox.style.paddingTop = "177.78%"; // (16/9 * 100)
  } else {
    aspectRatioBox.style.paddingTop = "56.25%"; // (9/16 * 100)
  }
}

export function getSubtitleStyles() {
  return {
    fontSize: document.getElementById("subtitle-size").value,
    fontColor: document.getElementById("subtitle-color").value.replace("#", ""),
    borderSize: document.getElementById("subtitle-border").value,
    borderColor: document
      .getElementById("subtitle-border-color")
      .value.replace("#", ""),
    yPosition: document.getElementById("subtitle-y").value,
  };
}

export function initializeSubtitleEditorHandlers(
  videoProcessing,
  currentFileId,
  currentProcessingParams
) {
  // Validate required parameters
  if (!videoProcessing || !currentFileId || !currentProcessingParams) {
    console.error(
      "Missing required parameters for subtitle editor initialization"
    );
    return;
  }

  // Initialize subtitle preview
  updateSubtitlePreview();

  // Set up subtitle editor button handlers
  const saveAndRenderBtn = document.getElementById("save-and-render");
  const skipEditBtn = document.getElementById("skip-edit");

  if (saveAndRenderBtn) {
    saveAndRenderBtn.onclick = async () => {
      try {
        await videoProcessing.renderWithSubtitles(
          false,
          currentFileId,
          currentProcessingParams
        );
      } catch (error) {
        console.error("Error rendering with subtitles:", error);
        alert("An error occurred while rendering the video. Please try again.");
      }
    };
  }

  if (skipEditBtn) {
    skipEditBtn.onclick = async () => {
      try {
        await videoProcessing.renderWithSubtitles(
          true,
          currentFileId,
          currentProcessingParams
        );
      } catch (error) {
        console.error("Error rendering with subtitles:", error);
        alert("An error occurred while rendering the video. Please try again.");
      }
    };
  }
}
