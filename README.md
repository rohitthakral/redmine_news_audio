# redmine_news_audio

A Redmine plugin that adds audio recording capability to the text editor, allowing users to record voice notes that are automatically transcribed and inserted into description fields.

## Overview

`redmine_news_audio` enhances Redmine's built-in text editor with a microphone button. When clicked, it opens an audio recorder in the browser. After the user stops recording, the audio is sent to a speech-to-text transcription service, and the resulting text is inserted into the description (or any supported text area) for further editing.

This plugin works on any Redmine entity that uses the standard text editor, including News, Issues, Wiki pages, and more.

## Features

- **In-browser audio recording** using the Web Audio API (no external software required)
- **Automatic transcription** via a configurable speech-to-text backend (OpenAI Whisper by default)
- **Seamless text insertion** — transcribed text is appended to the current cursor position in the description field
- **Visual feedback** — recording indicator shows when the microphone is active
- **Configurable** — API key and transcription endpoint are set through Redmine's plugin settings page

## Requirements

- Redmine 5.0 or later
- Ruby 3.0 or later
- A modern browser with `MediaRecorder` API support (Chrome 49+, Firefox 29+, Edge 79+, Safari 14.1+)
- An OpenAI API key (or compatible Whisper-compatible endpoint) for transcription

## Installation

1. Clone or download the plugin into your Redmine `plugins` directory:

   ```bash
   cd /path/to/redmine/plugins
   git clone https://github.com/rohitthakral/redmine_news_audio.git
   ```

2. Restart Redmine:

   ```bash
   bundle exec rails server
   ```

   No database migrations are required.

3. In Redmine, go to **Administration → Plugins** and click **Configure** next to `redmine_news_audio`.

4. Enter your transcription API key and (optionally) a custom endpoint URL, then save.

## Configuration

| Setting | Description | Default |
|---|---|---|
| `api_key` | API key for the transcription service | _(required)_ |
| `api_endpoint` | Transcription endpoint URL | `https://api.openai.com/v1/audio/transcriptions` |
| `model` | Whisper model to use | `whisper-1` |
| `language` | BCP-47 language code (e.g. `en`, `fr`) | _(auto-detect)_ |

## How It Works

1. The plugin injects a microphone toolbar button into Redmine's text editor via a JavaScript hook.
2. When the user clicks the button, the browser requests microphone permission and begins recording using the `MediaRecorder` API.
3. When recording is stopped, the captured audio blob is uploaded to the configured transcription endpoint via a Rails proxy action (so the API key is never exposed to the browser).
4. The Rails controller forwards the audio to the speech-to-text API and returns the transcript as JSON.
5. The JavaScript handler inserts the transcript text at the current cursor position in the description field.

## Usage

1. Open any Redmine form with a text description field (e.g. create a new issue or news post).
2. Click the **microphone icon** in the editor toolbar.
3. Speak your note. A red recording indicator will be visible while the microphone is active.
4. Click the **stop button** to end the recording.
5. Wait a moment for transcription — the text will appear in the description field automatically.
6. Edit the transcribed text as needed before saving.

## Security

- The transcription API key is stored in Redmine's plugin settings (encrypted at rest if your Redmine instance uses encrypted settings).
- Audio data is proxied through the Redmine server; it is never sent directly from the browser to the transcription API.
- Audio blobs are held in memory only and are not persisted to disk.

## License

This plugin is released under the [MIT License](LICENSE).

## Author

Developed and maintained by **[Target Integration](https://www.targetintegration.com)** — info@targetintegration.com

## Contributing

Pull requests and bug reports are welcome. Please open an issue on GitHub before submitting a large change.
