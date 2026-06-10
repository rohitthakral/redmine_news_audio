Rails.application.routes.draw do
  post 'audio_transcriptions/transcribe', to: 'audio_transcriptions#transcribe', as: :audio_transcribe
end
