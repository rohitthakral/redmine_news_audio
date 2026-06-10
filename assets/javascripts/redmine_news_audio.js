/**
 * redmine_news_audio
 *
 * Injects a microphone button into every Redmine text-editor toolbar.
 * On click: records audio via MediaRecorder, uploads to the Rails proxy,
 * and inserts the returned transcript at the cursor position.
 */
(function () {
  'use strict';

  // Path is rendered by the view helper into a data attribute on <body>.
  function transcribeUrl() {
    return document.body.dataset.audioTranscribeUrl || '/audio_transcriptions/transcribe';
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }

  /**
   * Insert text at the cursor in a plain <textarea>, or append if no selection
   * API is available (e.g. CodeMirror-replaced textareas).
   */
  function insertText(textarea, text) {
    if (typeof textarea.selectionStart === 'number') {
      var start = textarea.selectionStart;
      var end   = textarea.selectionEnd;
      var before = textarea.value.substring(0, start);
      var after  = textarea.value.substring(end);
      // Add a space separator when inserting into existing content.
      var separator = (before.length > 0 && !before.match(/\s$/)) ? ' ' : '';
      textarea.value = before + separator + text + after;
      textarea.selectionStart = textarea.selectionEnd = start + separator.length + text.length;
    } else {
      textarea.value += (textarea.value.length ? ' ' : '') + text;
    }
    // Trigger change event so frameworks (e.g. Vue/React wrappers) pick it up.
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  /**
   * Build and return the microphone toolbar button + status indicator.
   * @param {HTMLTextAreaElement} textarea  The target description field.
   */
  function createMicButton(textarea) {
    var wrapper = document.createElement('span');
    wrapper.className = 'rna-mic-wrapper';

    var btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'rna-mic-btn';
    btn.title     = 'Record audio note';
    btn.setAttribute('aria-label', 'Record audio note');
    btn.innerHTML = '<span class="rna-mic-icon" aria-hidden="true">&#127908;</span>';

    var status = document.createElement('span');
    status.className = 'rna-status';
    status.setAttribute('aria-live', 'polite');

    wrapper.appendChild(btn);
    wrapper.appendChild(status);

    var mediaRecorder = null;
    var audioChunks   = [];
    var recording     = false;

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.classList.toggle('rna-status--error', !!isError);
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }

    function startRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Your browser does not support audio recording.', true);
        return;
      }

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          // Prefer webm/opus; fall back to whatever the browser supports.
          var mimeType = '';
          var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
          for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) {
              mimeType = candidates[i];
              break;
            }
          }

          var options = mimeType ? { mimeType: mimeType } : {};
          mediaRecorder  = new MediaRecorder(stream, options);
          audioChunks    = [];

          mediaRecorder.addEventListener('dataavailable', function (e) {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
            }
          });

          mediaRecorder.addEventListener('stop', function () {
            // Stop all microphone tracks to release the browser indicator.
            stream.getTracks().forEach(function (t) { t.stop(); });

            var blob     = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
            var filename = 'recording.' + (mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm');

            btn.classList.remove('rna-mic-btn--recording');
            btn.title = 'Record audio note';
            btn.setAttribute('aria-label', 'Record audio note');
            recording = false;

            setStatus('Transcribing…');
            btn.disabled = true;

            uploadAndTranscribe(blob, filename, mimeType || 'audio/webm');
          });

          mediaRecorder.start(1000); // collect chunks every second
          recording = true;
          btn.classList.add('rna-mic-btn--recording');
          btn.title = 'Stop recording';
          btn.setAttribute('aria-label', 'Stop recording');
          setStatus('Recording…');
        })
        .catch(function (err) {
          var msg = err.name === 'NotAllowedError'
            ? 'Microphone access was denied.'
            : 'Could not access microphone: ' + err.message;
          setStatus(msg, true);
        });
    }

    function uploadAndTranscribe(blob, filename, mimeType) {
      var formData = new FormData();
      formData.append('audio', blob, filename);
      formData.append('authenticity_token', csrfToken());

      var xhr = new XMLHttpRequest();
      xhr.open('POST', transcribeUrl(), true);
      xhr.setRequestHeader('X-CSRF-Token', csrfToken());
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.onload = function () {
        btn.disabled = false;
        if (xhr.status === 200) {
          var data;
          try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; }
          if (data.transcript) {
            insertText(textarea, data.transcript);
            setStatus('');
          } else {
            setStatus(data.error || 'Transcription failed.', true);
          }
        } else {
          var errData;
          try { errData = JSON.parse(xhr.responseText); } catch (e) { errData = {}; }
          setStatus(errData.error || 'Transcription failed (HTTP ' + xhr.status + ').', true);
        }
      };

      xhr.onerror = function () {
        btn.disabled = false;
        setStatus('Network error during transcription.', true);
      };

      xhr.send(formData);
    }

    btn.addEventListener('click', function () {
      if (recording) {
        stopRecording();
      } else {
        setStatus('');
        startRecording();
      }
    });

    return wrapper;
  }

  /**
   * Find the toolbar for a given textarea and inject the mic button.
   * Redmine's EasyMDE / jstoolbar toolbars sit in a sibling element.
   */
  function injectButton(textarea) {
    if (textarea.dataset.rnaInjected) return;
    textarea.dataset.rnaInjected = 'true';

    var micWidget = createMicButton(textarea);

    // jstoolbar: the toolbar is the previous sibling div with class "jstElements"
    var jstoolbar = textarea.parentElement &&
                    textarea.parentElement.querySelector('.jstElements');
    if (jstoolbar) {
      jstoolbar.appendChild(micWidget);
      return;
    }

    // EasyMDE: toolbar is inside the .EasyMDEContainer that wraps the textarea
    var easymdeContainer = textarea.closest('.EasyMDEContainer');
    if (easymdeContainer) {
      var toolbar = easymdeContainer.querySelector('.editor-toolbar');
      if (toolbar) {
        var sep = document.createElement('span');
        sep.className = 'separator';
        toolbar.appendChild(sep);
        toolbar.appendChild(micWidget);
        return;
      }
    }

    // Fallback: insert directly before the textarea.
    textarea.parentNode.insertBefore(micWidget, textarea);
  }

  /**
   * Scan the page for description/content textareas and inject buttons.
   * Runs once on DOMContentLoaded and again after a short delay to catch
   * textareas revealed by JS (e.g. tabs, dialogs).
   */
  function injectAll() {
    // Target the main description-like textareas Redmine uses.
    var selectors = [
      'textarea#issue_description',
      'textarea#news_description',
      'textarea#wiki_content_text',
      'textarea[name$="[description]"]',
      'textarea[name$="[notes]"]',
      'textarea.wiki-edit'
    ];
    var textareas = document.querySelectorAll(selectors.join(','));
    textareas.forEach(injectButton);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectAll();
    // Re-scan after a delay for dynamically loaded content.
    setTimeout(injectAll, 1500);
  });

  // Also re-scan on Turbo/Rails UJS navigations if the app uses them.
  document.addEventListener('turbo:load',    injectAll);
  document.addEventListener('turbolinks:load', injectAll);
})();
