---
name: moneyprinterturbo-install
description: Install, configure and run MoneyPrinterTurbo (github.com/harry0703/MoneyPrinterTurbo), the AI short-video generator. Use when the user asks to install, set up, run, configure or troubleshoot MoneyPrinterTurbo (also "Money Printer Turbo", "MPT"), in any language, e.g. "ثبّت MoneyPrinterTurbo".
---

# MoneyPrinterTurbo: install and run

Reply in the user's language (Arabic if they write in Arabic).

## 0. Find out where it runs
- In a cloud session (no access to the user's machine), give the user the steps
  below to run themselves, or offer to install it in the container to test it.
- If computer use or a local shell on the user's machine is available, run the steps there.
- Ask for the OS only if it changes the steps (Windows vs macOS/Linux).

## 1. Choose an install method
| Situation | Method |
|---|---|
| Docker is installed | Docker (step 2A) |
| Windows, no coding experience | One-click package (step 2C) |
| Everything else | Manual install (step 2B) |

## 2A. Docker
```bash
git clone https://github.com/harry0703/MoneyPrinterTurbo.git
cd MoneyPrinterTurbo
cp config.example.toml config.toml   # configure it (step 3)
docker compose up
```

## 2B. Manual install
Prerequisites: Git, Miniconda (or Python 3.11), and ImageMagick:
- Windows: imagemagick.org, the *static* build; note the install path
- macOS: `brew install imagemagick`
- Ubuntu/Debian: `sudo apt install imagemagick`

```bash
git clone https://github.com/harry0703/MoneyPrinterTurbo.git
cd MoneyPrinterTurbo
conda create -n MoneyPrinterTurbo python=3.11 -y
conda activate MoneyPrinterTurbo
pip install -r requirements.txt
cp config.example.toml config.toml
```

## 2C. Windows one-click package
Download it from the link in the README's releases section. Unzip it to a path
with no spaces or non-English characters, then run `update.bat` and then `start.bat`.

## 3. Configure `config.toml`
- `pexels_api_keys`: free key from https://www.pexels.com/api/ (stock footage)
- `llm_provider`: e.g. `openai`, `deepseek`, `moonshot`, `gemini`, `ollama`, plus that
  provider's API key, base URL and model name fields
- Windows only: `imagemagick_path`, e.g. `C:\Program Files\ImageMagick-7.x.x-Q16\magick.exe`
- Optional: `ffmpeg_path` if ffmpeg doesn't download automatically

Never ask the user to paste API keys into the chat. Tell them to put the keys in `config.toml` themselves.

## 4. Run
```bash
sh webui.sh        # macOS / Linux
webui.bat          # Windows
# or on any OS:
streamlit run ./webui/Main.py --browser.gatherUsageStats=False
python main.py     # API only
```
- Web UI: http://localhost:8501
- API docs: http://localhost:8080/docs

## 5. Troubleshooting
- **ffmpeg not found**: install ffmpeg and set `ffmpeg_path` in `config.toml`.
- **ImageMagick security policy error (Linux)**: in `/etc/ImageMagick-6/policy.xml`,
  comment out the line containing `pattern="@"`.
- **Pip install fails**: check the Python version is 3.11. If downloads are slow, use a nearer pip mirror.
- **No stock video found**: check `pexels_api_keys`, or try English search terms.
- **LLM errors**: check the provider name, key, base URL and model in `config.toml`.

If the user pastes an error, diagnose it from the message and point to the specific fix.
Before suggesting a step that may be out of date, check the repo's current README.
