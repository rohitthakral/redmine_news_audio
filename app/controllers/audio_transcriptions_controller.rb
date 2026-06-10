require 'net/http'
require 'uri'

class AudioTranscriptionsController < ApplicationController
  before_action :require_login
  before_action :require_plugin_configured

  # POST /audio_transcriptions/transcribe
  # Accepts a multipart audio file from the browser, proxies it to the
  # configured Whisper-compatible endpoint, and returns the transcript as JSON.
  def transcribe
    audio = params[:audio]
    return render json: { error: 'No audio data received.' }, status: :unprocessable_entity unless audio

    settings    = Setting.plugin_redmine_news_audio
    endpoint    = settings['api_endpoint'].presence || 'https://api.openai.com/v1/audio/transcriptions'
    api_key     = settings['api_key']
    model       = settings['model'].presence || 'whisper-1'
    language    = settings['language'].presence

    transcript = call_transcription_api(audio, endpoint, api_key, model, language)
    render json: { transcript: transcript }
  rescue => e
    Rails.logger.error "[redmine_news_audio] Transcription error: #{e.message}"
    render json: { error: 'Transcription failed. Check plugin settings and server logs.' }, status: :internal_server_error
  end

  private

  def require_plugin_configured
    api_key = Setting.plugin_redmine_news_audio['api_key'].presence
    render json: { error: 'Audio transcription is not configured. Please set an API key in plugin settings.' }, status: :service_unavailable unless api_key
  end

  def call_transcription_api(audio_file, endpoint, api_key, model, language)
    uri = URI.parse(endpoint)

    # Build a multipart/form-data body manually so we stay dependency-free.
    boundary  = "----RedmineNewsAudioBoundary#{SecureRandom.hex(16)}"
    body_parts = []

    body_parts << "--#{boundary}\r\n" \
                  "Content-Disposition: form-data; name=\"model\"\r\n\r\n" \
                  "#{model}\r\n"

    if language.present?
      body_parts << "--#{boundary}\r\n" \
                    "Content-Disposition: form-data; name=\"language\"\r\n\r\n" \
                    "#{language}\r\n"
    end

    audio_data     = audio_file.read
    original_name  = audio_file.original_filename.presence || 'recording.webm'
    content_type   = audio_file.content_type.presence || 'audio/webm'

    body_parts << "--#{boundary}\r\n" \
                  "Content-Disposition: form-data; name=\"file\"; filename=\"#{original_name}\"\r\n" \
                  "Content-Type: #{content_type}\r\n\r\n"

    body = body_parts.join + audio_data + "\r\n--#{boundary}--\r\n"

    http             = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl     = uri.scheme == 'https'
    http.read_timeout = 60

    request = Net::HTTP::Post.new(uri.request_uri)
    request['Authorization'] = "Bearer #{api_key}"
    request['Content-Type']  = "multipart/form-data; boundary=#{boundary}"
    request.body             = body

    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      raise "Transcription API returned #{response.code}: #{response.body}"
    end

    JSON.parse(response.body)['text'].to_s
  end
end
