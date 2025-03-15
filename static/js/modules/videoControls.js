// Video control functions
export function togglePlay(videoPreview, playPauseBtn) {
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

export function restartVideo(videoPreview) {
  videoPreview.currentTime = 0;
  if (videoPreview.paused) {
    togglePlay(videoPreview);
  }
}

export function seekVideo(event, videoPreview) {
  const progress = document.getElementById("videoProgress");
  const position = (event.pageX - progress.offsetLeft) / progress.offsetWidth;
  videoPreview.currentTime = position * videoPreview.duration;
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function updateVolume(value, videoPreview) {
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

export function toggleMute(videoPreview) {
  const volumeSlider = document.getElementById("volume-slider");
  if (videoPreview.volume > 0) {
    videoPreview.dataset.previousVolume = volumeSlider.value;
    volumeSlider.value = 0;
    updateVolume(0, videoPreview);
  } else {
    const previousVolume = videoPreview.dataset.previousVolume || 100;
    volumeSlider.value = previousVolume;
    updateVolume(previousVolume, videoPreview);
  }
}
