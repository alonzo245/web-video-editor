export function showError(title, message, canRetry = false) {
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
  document.getElementById("progress-section").classList.add("hidden");
  document.getElementById("subtitle-editor").style.display = "none";

  // Show error section
  errorSection.classList.remove("hidden");
}

export function hideError() {
  const errorSection = document.getElementById("error-section");
  errorSection.classList.add("hidden");

  // Show appropriate section based on current state
  if (document.getElementById("subtitle-text").value) {
    document.getElementById("subtitle-editor").style.display = "block";
  } else {
    document.getElementById("processing-section").classList.remove("hidden");
  }
}
