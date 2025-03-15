# Web Video Editor

A FastAPI-based web application for video processing with features including aspect ratio conversion, volume adjustment, and subtitle generation/burning.

## Features

- Video cropping/resizing to 16:9 or 9:16 aspect ratios
- Volume adjustment (0-300%)
- Automatic speech transcription (English and Hebrew)
- Subtitle generation and customization
- Subtitle burning into videos
- Modern web interface
- Real-time video processing

## Prerequisites

- Python 3.8+
- FFmpeg
- [Whisper](https://github.com/openai/whisper) for speech recognition

## Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd web-video-editor
```

2. Install the required Python packages:

```bash
pip install -r requirements.txt
```

3. Ensure FFmpeg is installed on your system:

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
- **Windows**: Download from [FFmpeg website](https://ffmpeg.org/download.html)

## Project Structure

```
web-video-editor/
├── main.py              # FastAPI application
├── static/              # Static files (JS, CSS)
├── templates/           # HTML templates
├── uploads/            # Temporary storage for uploaded videos
├── outputs/            # Processed video output directory
└── transcripts/        # Generated subtitle files
```

## Usage

1. Start the server:

```bash
uvicorn main:app --reload
```

2. Open your browser and navigate to `http://localhost:8000`

3. Upload a video and choose from the following options:
   - Select target aspect ratio (16:9 or 9:16)
   - Adjust horizontal position (for 9:16 cropping)
   - Set volume level
   - Choose language for transcription (English or Hebrew)
   - Customize subtitle appearance

## API Endpoints

- `GET /`: Main web interface
- `POST /upload`: Upload video file
- `POST /crop/{file_id}`: Process video with specified parameters
- `POST /transcribe/{file_id}`: Generate transcription
- `POST /render/{file_id}`: Render video with customized subtitles
- `GET /download/{filename}`: Download processed files
- `POST /confirm-download/{file_id}`: Clean up files after download

## Environment Setup

The application requires write access to the following directories:

- `uploads/`: Temporary storage for uploaded videos
- `outputs/`: Storage for processed videos
- `transcripts/`: Storage for generated subtitle files

## Error Handling

The application includes comprehensive error handling for:

- Invalid file types
- Processing failures
- File system errors
- Transcription errors
- FFmpeg processing errors

## Security Considerations

- Temporary files are automatically cleaned up
- File extensions are validated
- Process isolation for FFmpeg commands
- Resource limits on file uploads
- Secure file handling practices

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Your License Here]

## Support

For support, please [create an issue](repository-issues-url) or contact [your-contact-info].
