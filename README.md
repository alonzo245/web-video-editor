# Web Video Editor

A web-based video editor that allows users to crop videos, add subtitles, and customize their appearance. Built with FastAPI and modern JavaScript.

## Features

- Video upload via drag & drop or file selection
- Video cropping with aspect ratio options (16:9 and 9:16)
- Subtitle generation and customization
  - Font size adjustment
  - Color selection
  - Border size and color customization
  - Vertical position adjustment
- Real-time subtitle preview
- Video playback controls
- Multiple language support for subtitle generation

## Prerequisites

- Python 3.8 or higher
- Node.js and npm (for Tailwind CSS)
- FFmpeg installed on your system

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd web-video-editor
```

2. Create a Python virtual environment and activate it:

```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install Python dependencies:

```bash
pip install -r requirements.txt
```

4. Install Node.js dependencies:

```bash
npm install
```

5. Build the CSS:

```bash
npm run build
```

## Running the Application

1. Make sure your virtual environment is activated:

```bash
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

2. Start the FastAPI server:

```bash
uvicorn main:app --reload
```

3. Open your browser and navigate to:

```
http://localhost:8000
```

## Project Structure

```
web-video-editor/
├── main.py              # FastAPI application
├── static/
│   ├── css/            # CSS files
│   └── js/             # JavaScript modules
│       ├── main.js
│       └── modules/    # JavaScript module files
├── templates/          # HTML templates
├── uploads/           # Temporary storage for uploaded videos
├── outputs/           # Processed video output directory
└── transcripts/       # Generated subtitle files
```

## Development

- The application uses ES6 modules for JavaScript organization
- Tailwind CSS is used for styling
- FastAPI handles the backend API endpoints
- FFmpeg is used for video processing

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
