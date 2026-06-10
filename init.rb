require 'redmine'
require_relative 'lib/redmine_news_audio'

Redmine::Plugin.register :redmine_news_audio do
  name        'Redmine News Audio'
  author      'Rohit Thakral'
  description 'Adds an audio recording button to the text editor; speech is transcribed and inserted into the description field.'
  version     '1.0.0'
  url         'https://github.com/rohitthakral/redmine_news_audio'
  author_url  'https://github.com/rohitthakral'

  settings default: {
    'api_key'      => '',
    'api_endpoint' => 'https://api.openai.com/v1/audio/transcriptions',
    'model'        => 'whisper-1',
    'language'     => ''
  }, partial: 'settings/redmine_news_audio_settings'
end
