from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Body
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import subprocess
import uuid
from pathlib import Path
import shutil
import logging
from typing import Optional
import whisper
import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Video Cropper")

# Create necessary directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
TRANSCRIPTS_DIR = Path("transcripts")

# Create directories with proper permissions
for directory in [UPLOAD_DIR, OUTPUT_DIR, TRANSCRIPTS_DIR]:
    try:
        directory.mkdir(exist_ok=True)
        # Ensure directory is writable
        test_file = directory / ".test"
        test_file.touch()
        test_file.unlink()
    except Exception as e:
        print(f"Error creating/accessing directory {directory}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create/access directory {directory}: {e}"
        )

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize Whisper model
whisper_model = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        whisper_model = whisper.load_model("medium")
    return whisper_model

def format_timestamp(seconds):
    """Convert seconds to SRT timestamp format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def create_srt_file(segments, output_path):
    """Create SRT file from transcription segments."""
    with open(output_path, 'w', encoding='utf-8') as f:
        for i, segment in enumerate(segments, 1):
            start_time = format_timestamp(segment['start'])
            end_time = format_timestamp(segment['end'])
            f.write(f"{i}\n")
            f.write(f"{start_time} --> {end_time}\n")
            f.write(f"{segment['text'].strip()}\n\n")
    return output_path

def create_txt_file(segments, output_path):
    """Create plain text file from transcription segments."""
    with open(output_path, 'w', encoding='utf-8') as f:
        for segment in segments:
            f.write(f"{segment['text'].strip()}\n")
    return output_path

def transcribe_audio(input_path: str, language: Optional[str] = None):
    """Transcribe audio using Whisper."""
    model = get_whisper_model()
    
    # Set language options
    if language == "hebrew":
        language = "he"
    elif language == "english":
        language = "en"
    
    # Transcribe audio
    options = {"language": language} if language else {}
    result = model.transcribe(input_path, **options)
    
    return result

def get_video_dimensions(file_path: str) -> tuple:
    """Get video dimensions using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        file_path
    ]
    
    print(f"Running ffprobe command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"ffprobe error output: {result.stderr}")
        raise HTTPException(
            status_code=400,
            detail=f"Could not process video file: {result.stderr}"
        )
    
    try:
        width, height = map(int, result.stdout.strip().split('x'))
        print(f"Video dimensions: {width}x{height}")
        return width, height
    except ValueError as e:
        print(f"Error parsing dimensions: {result.stdout}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid video dimensions format: {result.stdout}"
        )

def crop_video(input_path: str, output_path: str, target_ratio: str, position: float = 50, volume: float = 100, language: Optional[str] = None, burn_subtitles: bool = False, subtitle_styles: Optional[dict] = None):
    """Crop video to target aspect ratio, adjust volume, and optionally burn in subtitles."""
    width, height = get_video_dimensions(input_path)
    
    print(f"Original dimensions: {width}x{height}")
    print(f"Volume adjustment: {volume}%")
    
    # Initialize variables
    new_width = width
    new_height = height
    x_offset = 0
    y_offset = 0
    
    if target_ratio == "9:16":  # Vertical
        new_width = int(height * (9/16))
        max_offset = width - new_width
        x_offset = int((position / 100) * max_offset)
        y_offset = 0
        print(f"Converting to vertical (9:16):")
        print(f"- New width: {new_width} (based on height {height})")
        print(f"- X offset: {x_offset} (position: {position}%)")
        print(f"- Y offset: {y_offset}")
    else:  # 16:9 Horizontal
        new_height = int(width * (9/16))
        x_offset = 0
        y_offset = (height - new_height) // 2
        print(f"Converting to horizontal (16:9):")
        print(f"- New height: {new_height} (based on width {width})")
        print(f"- X offset: {x_offset}")
        print(f"- Y offset: {y_offset} (centered)")
    
    # Ensure dimensions are even numbers (required by some codecs)
    new_width = new_width - (new_width % 2)
    new_height = new_height - (new_height % 2)
    
    print(f"Final dimensions: {new_width}x{new_height}")
    
    # Calculate volume factor (1.0 = 100%)
    volume_factor = volume / 100

    # Base video processing command
    filter_complex = [f"[0:v]crop={new_width}:{new_height}:{x_offset}:{y_offset}[v];[0:a]volume={volume_factor}[a]"]
    
    # If burning subtitles and language is specified
    temp_srt_path = None
    temp_ass_path = None
    if burn_subtitles and language:
        try:
            logger.info(f"Starting subtitle burn-in process with language: {language}")
            
            # Create temporary SRT file
            temp_srt_path = TRANSCRIPTS_DIR / f"temp_{uuid.uuid4()}.srt"
            
            # If we have existing SRT content, use it directly
            if subtitle_styles and 'srt_content' in subtitle_styles:
                logger.info("Using provided SRT content")
                with open(temp_srt_path, 'w', encoding='utf-8') as f:
                    f.write(subtitle_styles['srt_content'])
            else:
                # Otherwise, generate new transcription
                logger.info("Generating new transcription")
                print(f"Transcribing audio for subtitle burn-in...")
                result = transcribe_audio(str(input_path), language)
                create_srt_file(result["segments"], temp_srt_path)
            
            logger.info(f"Created SRT file at: {temp_srt_path}")
            
            # Apply subtitle styling if provided, otherwise use defaults
            if subtitle_styles:
                font_size = int(subtitle_styles.get('fontSize', 24))
                font_color = subtitle_styles.get('fontColor', 'ffffff')
                border_size = int(subtitle_styles.get('borderSize', 2))
                border_color = subtitle_styles.get('borderColor', '000000')
                y_position = float(subtitle_styles.get('yPosition', 90))
                
                # Convert RGB hex colors to ASS BBGGRR format
                def rgb_to_ass(color):
                    # Remove any '#' if present
                    color = color.lstrip('#')
                    # Ensure 6 digits
                    if len(color) != 6:
                        return 'FFFFFF'  # Default to white if invalid
                    # Convert from RGB to BGR (reverse pairs of characters)
                    return color[4:6] + color[2:4] + color[0:2]
                
                font_color = rgb_to_ass(font_color)
                border_color = rgb_to_ass(border_color)
                
                logger.info(f"Using custom styles: size={font_size}, color={font_color}, border={border_size}")
            else:
                # Improved default styling
                font_size = max(32, min(64, new_height // 15))  # Larger default font size
                font_color = 'FFFFFF'  # White in ASS format
                border_size = 3
                border_color = '000000'  # Black in ASS format
                y_position = 90
                logger.info(f"Using default styles: size={font_size}, color={font_color}, border={border_size}")
            
            # Create ASS style header with corrected color format
            ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {new_width}
PlayResY: {new_height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font_size},&H00{font_color},&H000000FF,&H00{border_color},&H00000000,0,0,0,0,100,100,0,0,1,{border_size},0,2,10,10,{int((new_height * (100 - y_position) / 100))},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
            # Convert SRT to ASS format using FFmpeg
            temp_ass_path = TRANSCRIPTS_DIR / f"temp_{uuid.uuid4()}.ass"
            convert_cmd = [
                "ffmpeg",
                "-y",
                "-i", str(temp_srt_path),
                str(temp_ass_path)
            ]
            subprocess.run(convert_cmd, check=True, capture_output=True)
            logger.info(f"Converted SRT to ASS format at: {temp_ass_path}")
            
            # Read the generated ASS file
            with open(temp_ass_path, 'r', encoding='utf-8') as f:
                ass_content = f.read()
            
            # Extract events section from the generated ASS file
            events_section = ass_content[ass_content.find('[Events]'):]
            
            # Write the new ASS file with custom styles
            with open(temp_ass_path, 'w', encoding='utf-8') as f:
                f.write(ass_header + events_section[events_section.find('\n')+1:])
            
            # Create subtitle filter
            subtitle_filter = f";[v]ass='{temp_ass_path}'[v]"
            
            logger.info(f"Generated subtitle filter: {subtitle_filter}")
            filter_complex[0] += subtitle_filter
            
        except Exception as e:
            print(f"Warning: Failed to burn subtitles: {str(e)}")
            logger.error(f"Subtitle burning error: {str(e)}")
            logger.error(f"Full error details:", exc_info=True)
            # Continue without subtitles if there's an error
        finally:
            # Clean up temporary SRT file if it exists
            if temp_srt_path and temp_srt_path.exists():
                try:
                    temp_srt_path.unlink()
                except Exception as e:
                    print(f"Warning: Could not clean up temporary SRT file: {e}")
    
    cmd = [
        "ffmpeg",
        "-y",  # Overwrite output file if it exists
        "-i", input_path,
        "-filter_complex", filter_complex[0],
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-profile:v", "main",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", "192k",
        output_path
    ]
    
    print(f"Running FFmpeg command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Clean up temporary ASS file if it was created
    if temp_ass_path and temp_ass_path.exists():
        try:
            temp_ass_path.unlink()
            print(f"Cleaned up temporary ASS file: {temp_ass_path}")
        except Exception as e:
            print(f"Warning: Could not clean up temporary ASS file: {e}")
    
    if result.returncode != 0:
        print(f"FFmpeg error output: {result.stderr}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to process video",
                "error": result.stderr,
                "technical_details": "FFmpeg command failed",
                "can_retry": True
            }
        )
    else:
        print("FFmpeg processing completed successfully")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    input_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    output_path = OUTPUT_DIR / f"cropped_{file_id}.mp4"
    
    # Save uploaded file
    with open(input_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    try:
        # Get video dimensions
        width, height = get_video_dimensions(str(input_path))
        return {
            "file_id": file_id,
            "original_filename": file.filename,
            "dimensions": {"width": width, "height": height}
        }
    except Exception as e:
        input_path.unlink()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/crop/{file_id}")
async def crop_video_endpoint(
    file_id: str, 
    target_ratio: str, 
    position: float = 50, 
    volume: float = 100,
    language: Optional[str] = None,
    burn_subtitles: bool = False
):
    print(f"Processing crop request for file_id: {file_id}, target_ratio: {target_ratio}, position: {position}, volume: {volume}%, language: {language}, burn_subtitles: {burn_subtitles}")
    
    if target_ratio not in ["9:16", "16:9"]:
        raise HTTPException(status_code=400, detail="Invalid aspect ratio")
    
    if not 0 <= position <= 100:
        raise HTTPException(status_code=400, detail="Position must be between 0 and 100")

    if not 0 <= volume <= 300:
        raise HTTPException(status_code=400, detail="Volume must be between 0 and 300")
        
    if language and language not in ["hebrew", "english"]:
        raise HTTPException(status_code=400, detail="Language must be either 'hebrew' or 'english'")
    
    # Find the uploaded file
    input_files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    print(f"Found input files: {input_files}")
    
    if not input_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    input_path = input_files[0]
    output_path = OUTPUT_DIR / f"cropped_{file_id}.mp4"
    
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")
    
    try:
        # Verify input file exists and is readable
        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        # Verify output directory is writable
        try:
            test_file = OUTPUT_DIR / ".test"
            test_file.touch()
            test_file.unlink()
        except Exception as e:
            raise PermissionError(f"Cannot write to output directory: {e}")
        
        # Process video
        crop_video(str(input_path), str(output_path), target_ratio, position, volume, language, burn_subtitles)
        
        # Verify output file was created
        if not output_path.exists():
            raise FileNotFoundError("Output file was not created")
            
        # Create separate transcript files if language is specified and not burning subtitles
        transcript_files = {}
        if language and not burn_subtitles:
            try:
                print(f"Starting transcription in {language}")
                result = transcribe_audio(str(input_path), language)
                
                # Create SRT file
                srt_path = TRANSCRIPTS_DIR / f"transcript_{file_id}.srt"
                create_srt_file(result["segments"], srt_path)
                transcript_files["srt"] = str(srt_path)
                
                # Create TXT file
                txt_path = TRANSCRIPTS_DIR / f"transcript_{file_id}.txt"
                create_txt_file(result["segments"], txt_path)
                transcript_files["txt"] = str(txt_path)
                
                print(f"Transcription completed: {transcript_files}")
            except Exception as e:
                print(f"Transcription error: {str(e)}")
                logger.error(f"Transcription failed: {str(e)}")
            
        print(f"Successfully created output file: {output_path}")
        return {
            "output_file": str(output_path),
            "transcript_files": transcript_files
        }
    except Exception as e:
        print(f"Error during video processing: {str(e)}")
        if output_path.exists():
            try:
                output_path.unlink()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if input_path.exists():
                input_path.unlink()
                print(f"Cleaned up input file: {input_path}")
        except Exception as e:
            print(f"Warning: Could not clean up input file: {e}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    # Check both OUTPUT_DIR and TRANSCRIPTS_DIR
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        file_path = TRANSCRIPTS_DIR / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)

@app.post("/confirm-download/{file_id}")
async def confirm_download(file_id: str):
    try:
        # Remove uploaded file
        uploaded_files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
        for file in uploaded_files:
            try:
                file.unlink()
                logger.info(f"Removed uploaded file: {file}")
            except Exception as e:
                logger.error(f"Error removing uploaded file {file}: {str(e)}")

        # Remove output file
        output_files = list(OUTPUT_DIR.glob(f"cropped_{file_id}.mp4"))
        for file in output_files:
            try:
                file.unlink()
                logger.info(f"Removed output file: {file}")
            except Exception as e:
                logger.error(f"Error removing output file {file}: {str(e)}")

        return JSONResponse({"status": "success"})
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe/{file_id}")
async def transcribe_video(
    file_id: str,
    language: str,
    target_ratio: str,
    position: float = 50,
    volume: float = 100
):
    # Find the uploaded file
    input_files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if not input_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    input_path = input_files[0]
    
    try:
        # Generate transcription
        result = transcribe_audio(str(input_path), language)
        
        # Create temporary SRT file
        temp_srt_path = TRANSCRIPTS_DIR / f"temp_{file_id}.srt"
        create_srt_file(result["segments"], temp_srt_path)
        
        # Read the SRT content
        with open(temp_srt_path, 'r', encoding='utf-8') as f:
            srt_content = f.read()
        
        # Store processing parameters
        processing_params = {
            "target_ratio": target_ratio,
            "position": position,
            "volume": volume,
            "language": language
        }
        
        return {
            "srt_content": srt_content,
            "temp_srt_path": str(temp_srt_path),
            "processing_params": processing_params
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/render/{file_id}")
async def render_video_endpoint(
    file_id: str,
    render_data: dict = Body(...),
):
    """Render the video with optional subtitle customization."""
    logger.info(f"Starting render for file_id: {file_id}")
    logger.info(f"Render parameters: {render_data}")
    
    try:
        # Find the uploaded file
        input_files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
        logger.info(f"Found input files: {input_files}")
        
        if not input_files:
            logger.error(f"No input files found for file_id: {file_id}")
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "Video file not found",
                    "error": f"No input file found for ID: {file_id}",
                    "can_retry": False
                }
            )
        
        input_file = input_files[0]
        if not input_file.exists():
            logger.error(f"Input file no longer exists: {input_file}")
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "Video file was removed or is no longer accessible",
                    "error": f"File not found: {input_file}",
                    "can_retry": False
                }
            )
        
        # Generate output filename with UUID
        output_filename = f"cropped_{uuid.uuid4()}.mp4"
        output_file = OUTPUT_DIR / output_filename
        logger.info(f"Output file will be: {output_file}")
        
        # Extract parameters from render_data
        skip_edit = render_data.get('skip_edit', True)
        srt_content = render_data.get('srt_content')
        target_ratio = render_data.get('target_ratio', '9:16')
        position = float(render_data.get('position', 50))
        volume = float(render_data.get('volume', 100))
        language = render_data.get('language')
        subtitle_styles = render_data.get('subtitle_styles')
        
        # Create temporary SRT file if content is provided
        temp_srt = None
        if not skip_edit and srt_content:
            try:
                temp_srt = TRANSCRIPTS_DIR / f"temp_{uuid.uuid4()}.srt"
                temp_srt.write_text(srt_content, encoding='utf-8')
                logger.info(f"Created temporary SRT file: {temp_srt}")
            except Exception as e:
                logger.error(f"Failed to create temporary SRT file: {e}")
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": "Failed to process subtitle file",
                        "error": str(e),
                        "can_retry": True
                    }
                )
        
        try:
            # Process video with subtitle customization
            if subtitle_styles is None:
                subtitle_styles = {}
            
            if not skip_edit and srt_content:
                # Include the SRT content in subtitle_styles
                subtitle_styles['srt_content'] = srt_content
            
            crop_video(
                str(input_file),
                str(output_file),
                target_ratio=target_ratio,
                position=position,
                volume=volume,
                language=language,
                burn_subtitles=bool(language and (skip_edit or srt_content)),
                subtitle_styles=subtitle_styles
            )
            
            if not output_file.exists():
                raise FileNotFoundError("Output file was not created after processing")
                
            logger.info(f"Successfully processed video: {output_file}")
            
            return {
                "output_file": str(output_file),
                "message": "Video processed successfully"
            }
            
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg process failed: {e.stderr}")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Video processing failed",
                    "error": e.stderr.decode() if e.stderr else str(e),
                    "can_retry": True,
                    "technical_details": {
                        "returncode": e.returncode,
                        "cmd": e.cmd
                    }
                }
            )
        except Exception as e:
            logger.error(f"Error during video processing: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Failed to process video",
                    "error": str(e),
                    "can_retry": True
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in render endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "An unexpected error occurred",
                "error": str(e),
                "can_retry": True
            }
        )
    finally:
        # Clean up temporary files
        if temp_srt and temp_srt.exists():
            try:
                temp_srt.unlink()
                logger.info(f"Cleaned up temporary SRT file: {temp_srt}")
            except Exception as e:
                logger.warning(f"Could not clean up temporary SRT file: {e}") 