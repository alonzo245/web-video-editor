import { showError } from "./errorHandling.js";

export async function handleFiles(files, videoPreview) {
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
    const currentFileId = data.file_id;
    const originalWidth = data.dimensions.width;
    const originalHeight = data.dimensions.height;

    // Set up video preview
    videoPreview.src = URL.createObjectURL(file);
    videoPreview.load();
    videoPreview.pause(); // Ensure video is paused after loading

    // Show processing section
    document.getElementById("upload-section").classList.add("hidden");
    document.getElementById("processing-section").classList.remove("hidden");

    return { currentFileId, originalWidth, originalHeight };
  } catch (error) {
    alert("Error uploading video: " + error.message);
    return null;
  }
}

export async function downloadFile(fileUrl, fileName, currentFileId) {
  try {
    const response = await fetch(`/download/${fileUrl.split("/").pop()}`);
    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Clean up files after successful download
    if (currentFileId) {
      await fetch(`/confirm-download/${currentFileId}`, { method: "POST" });
    }
  } catch (error) {
    console.error("Download error:", error);
    showError(
      "Download Failed",
      error.message || "Failed to download the file"
    );
  }
}
