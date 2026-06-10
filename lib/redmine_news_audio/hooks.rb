module RedmineNewsAudio
  class Hooks < Redmine::Hook::ViewListener
    # Injects the transcription URL into <body> and loads plugin assets.
    # Called by the :view_layouts_base_html_head hook.
    def view_layouts_base_html_head(context = {})
      return '' unless User.current.logged?

      transcribe_url = Rails.application.routes.url_helpers.audio_transcribe_path

      content = javascript_include_tag('redmine_news_audio', plugin: 'redmine_news_audio')
      content += stylesheet_link_tag('redmine_news_audio', plugin: 'redmine_news_audio')
      # Expose the transcription endpoint to the JS without hard-coding the URL.
      content += "<script>document.addEventListener('DOMContentLoaded',function(){" \
                 "document.body.dataset.audioTranscribeUrl='#{transcribe_url}';});</script>"
      content
    end
  end
end
