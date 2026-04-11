"""
Stream Translator — Local Seamless M4T v2 Backend
FastAPI + WebSocket server for real-time speech translation on Apple Silicon.
"""

import os
import io
import json
import base64
import struct
import asyncio
import logging
from typing import Optional

import numpy as np
import torch
import torchaudio
from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToSpeech, SeamlessM4Tv2ForSpeechToText
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ──────────────────────────────────────────────────────────────────

app = FastAPI(title="Stream Translator - Seamless M4T v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model globals ──────────────────────────────────────────────────────────────

MODEL_NAME = "facebook/seamless-m4t-v2-large"
SAMPLE_RATE = 16000
CHUNK_DURATION_S = 2.0  # buffer this much audio before translating
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_DURATION_S)

processor: Optional[AutoProcessor] = None
s2tt_model = None  # speech-to-text translation
s2st_model = None  # speech-to-speech translation (loaded lazily)
device: Optional[torch.device] = None


def get_device() -> torch.device:
    """Pick the best available device: MPS > CUDA > CPU."""
    if torch.backends.mps.is_available():
        logger.info("Using MPS (Apple Silicon GPU)")
        return torch.device("mps")
    if torch.cuda.is_available():
        logger.info("Using CUDA")
        return torch.device("cuda")
    logger.info("Using CPU")
    return torch.device("cpu")


@app.on_event("startup")
async def load_models():
    """Load Seamless M4T v2 at server startup."""
    global processor, s2tt_model, s2st_model, device

    device = get_device()
    logger.info(f"Loading {MODEL_NAME} …")

    processor = AutoProcessor.from_pretrained(MODEL_NAME)

    # S2TT model — lighter, used for subtitle text
    s2tt_model = SeamlessM4Tv2ForSpeechToText.from_pretrained(MODEL_NAME)
    s2tt_model = s2tt_model.to(device)
    s2tt_model.eval()
    logger.info("S2TT model loaded.")

    # S2ST model — heavier, produces translated audio
    s2st_model = SeamlessM4Tv2ForSpeechToSpeech.from_pretrained(MODEL_NAME)
    s2st_model = s2st_model.to(device)
    s2st_model.eval()
    logger.info("S2ST model loaded.")

    logger.info("All models ready.")


# ── Helpers ────────────────────────────────────────────────────────────────────

# Seamless M4T v2 language codes
SEAMLESS_LANGS = {
    "eng", "spa", "fra", "deu", "por", "ita", "cmn", "jpn", "kor", "arb", "hin",
    "rus", "tur", "vie", "tha", "ind", "nld", "pol", "swe", "ces",
}


def pcm16_bytes_to_float32(pcm_bytes: bytes) -> np.ndarray:
    """Convert raw PCM16 LE bytes to float32 numpy array in [-1, 1]."""
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return samples


def float32_to_wav_base64(audio: np.ndarray, sample_rate: int = 16000) -> str:
    """Encode float32 audio array as base64 WAV (pure Python, no torchcodec)."""
    # Convert float32 [-1,1] to int16
    pcm16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    # Write WAV header manually
    num_samples = len(pcm16)
    data_size = num_samples * 2  # 2 bytes per int16 sample
    buf.write(b'RIFF')
    buf.write(struct.pack('<I', 36 + data_size))  # file size - 8
    buf.write(b'WAVE')
    buf.write(b'fmt ')
    buf.write(struct.pack('<I', 16))        # fmt chunk size
    buf.write(struct.pack('<H', 1))         # PCM format
    buf.write(struct.pack('<H', 1))         # mono
    buf.write(struct.pack('<I', sample_rate))
    buf.write(struct.pack('<I', sample_rate * 2))  # byte rate
    buf.write(struct.pack('<H', 2))         # block align
    buf.write(struct.pack('<H', 16))        # bits per sample
    buf.write(b'data')
    buf.write(struct.pack('<I', data_size))
    buf.write(pcm16.tobytes())
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


@torch.inference_mode()
def translate_audio(
    audio_array: np.ndarray,
    src_lang: str,
    tgt_lang: str,
) -> dict:
    """
    Run S2TT and S2ST on an audio chunk.
    Returns {"input_text": ..., "output_text": ..., "audio": base64-wav | None}.
    """
    # Prepare inputs — processor expects (batch, samples) float tensor at 16kHz
    inputs = processor(
        audio=audio_array,
        sampling_rate=SAMPLE_RATE,
        return_tensors="pt",
        src_lang=src_lang,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    result: dict = {"input_text": None, "output_text": None, "audio": None}

    # ── S2TT (text translation) ───────────────────────────────────────────────
    try:
        text_tokens = s2tt_model.generate(**inputs, tgt_lang=tgt_lang)
        result["output_text"] = processor.decode(text_tokens[0].tolist(), skip_special_tokens=True)
    except Exception as e:
        logger.error(f"S2TT error: {e}")

    # ── S2ST (speech translation) ─────────────────────────────────────────────
    try:
        audio_out = s2st_model.generate(**inputs, tgt_lang=tgt_lang)
        # audio_out is a tuple: (waveform_tensor, sample_rate)
        # The waveform is at index [0] and sample rate at [1]
        if isinstance(audio_out, tuple):
            waveform = audio_out[0]
            out_sr = audio_out[1] if len(audio_out) > 1 else 16000
        else:
            # Some versions return a dict-like object
            waveform = audio_out.audio_sequences if hasattr(audio_out, 'audio_sequences') else audio_out[0]
            out_sr = audio_out.sampling_rate if hasattr(audio_out, 'sampling_rate') else 16000

        if waveform is not None:
            wav_np = waveform.squeeze().cpu().float().numpy()
            sr = int(out_sr.item()) if hasattr(out_sr, 'item') else int(out_sr) if isinstance(out_sr, (int, float)) else 16000
            result["audio"] = float32_to_wav_base64(wav_np, sr)
    except Exception as e:
        logger.error(f"S2ST error: {e}")

    # ── Input transcription (S2TT with tgt=src for ASR-like behaviour) ────────
    try:
        asr_tokens = s2tt_model.generate(**inputs, tgt_lang=src_lang)
        result["input_text"] = processor.decode(asr_tokens[0].tolist(), skip_special_tokens=True)
    except Exception as e:
        logger.error(f"ASR error: {e}")

    return result


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "device": str(device),
        "s2tt_loaded": s2tt_model is not None,
        "s2st_loaded": s2st_model is not None,
    }


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/translate")
async def websocket_translate(ws: WebSocket):
    await ws.accept()
    logger.info("WebSocket client connected")

    src_lang = "eng"
    tgt_lang = "spa"
    audio_buffer = bytearray()

    try:
        while True:
            message = await ws.receive()

            # Text message = config
            if "text" in message:
                try:
                    config = json.loads(message["text"])
                    src_lang = config.get("src_lang", src_lang)
                    tgt_lang = config.get("target_lang", tgt_lang)
                    logger.info(f"Config: {src_lang} → {tgt_lang}")
                    await ws.send_json({"type": "config_ack", "src_lang": src_lang, "target_lang": tgt_lang})
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "message": "Invalid JSON config"})
                continue

            # Binary message = PCM16 audio
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])

                # Process when we have enough audio
                if len(audio_buffer) >= CHUNK_SAMPLES * 2:  # 2 bytes per int16 sample
                    chunk_bytes = bytes(audio_buffer[:CHUNK_SAMPLES * 2])
                    audio_buffer = audio_buffer[CHUNK_SAMPLES * 2:]

                    audio_array = pcm16_bytes_to_float32(chunk_bytes)

                    # Run translation in thread pool to not block the event loop
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(
                        None, translate_audio, audio_array, src_lang, tgt_lang
                    )

                    await ws.send_json({
                        "type": "translation",
                        "input_text": result["input_text"],
                        "output_text": result["output_text"],
                        "audio": result["audio"],
                    })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass
