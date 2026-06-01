import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LoginForm from './components/LoginForm';
import DashboardTab from './components/DashboardTab';
import TextTranslationTab from './components/TextTranslationTab';
import DocumentTranslationTab from './components/DocumentTranslationTab';
import AudioTranslationTab from './components/AudioTranslationTab';
import VideoTranslationTab from './components/VideoTranslationTab';
import SettingsTab from './components/SettingsTab';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('baif_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [modelsStatus, setModelsStatus] = useState({
    is_cached: false,
    whisper_cached: false,
    nllb_cached: false,
    tts_cached: false,
    models_dir: ''
  });
  const [isConnected, setIsConnected] = useState(true);
  const [whisperSize, setWhisperSize] = useState('base');

  // Text Translation States
  const [textInput, setTextInput] = useState('');
  const [textOutput, setTextOutput] = useState('');
  const [textSrcLang, setTextSrcLang] = useState('auto');
  const [textTgtLang, setTextTgtLang] = useState('Hindi');
  const [detectedTextLang, setDetectedTextLang] = useState('');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);

  // Audio Translation States
  const [audioFile, setAudioFile] = useState(null);
  const [audioSrcLang, setAudioSrcLang] = useState('auto');
  const [audioTgtLang, setAudioTgtLang] = useState('Hindi');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioProgressText, setAudioProgressText] = useState('');
  const [audioResult, setAudioResult] = useState(null);
  const [audioActiveSubTab, setAudioActiveSubTab] = useState('translation');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Video Translation States
  const [videoFile, setVideoFile] = useState(null);
  const [videoSrcLang, setVideoSrcLang] = useState('auto');
  const [videoTgtLang, setVideoTgtLang] = useState('Hindi');
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [overlayVoice, setOverlayVoice] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressText, setVideoProgressText] = useState('');
  const [videoResult, setVideoResult] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Document Translation States
  const [docFile, setDocFile] = useState(null);
  const [docSrcLang, setDocSrcLang] = useState('auto');
  const [docTgtLang, setDocTgtLang] = useState('Hindi');
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [docResult, setDocResult] = useState(null);

  const pageTitles = {
    dashboard: 'CSR Translation Hub',
    text:      'Text Translator',
    docs:      'Document Translator',
    audio:     'Speech & Audio Dubber',
    video:     'Video Subtitler & Dubber',
    settings:  'App Settings & Local Models',
  };

  const pageSubtitles = {
    dashboard: 'An enterprise offline AI portal — bridging Indian regional language barriers.',
    text:      'Translate sentences instantly across Marathi, Hindi, and English.',
    docs:      'Translate Word, PowerPoint, Excel, and PDF files while preserving formatting.',
    audio:     'Transcribe audio tracks, translate texts, and synthesize spoken voiceovers.',
    video:     'Extract dialogue, burn-in subtitles, and replace spoken tracks on media files.',
    settings:  'Configure offline hardware capabilities and model cache states.',
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const data = await res.json();
        setAuth(data);
        localStorage.setItem('baif_auth', JSON.stringify(data));
      } else {
        alert('Invalid credentials');
      }
    } catch {
      alert('Login error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('baif_auth');
    setActiveTab('dashboard');
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${auth?.access_token}`
    };
    return fetch(url, { ...options, headers });
  };

  const checkServerStatus = async () => {
    if (!auth) return;
    try {
      const res = await authFetch('/api/models-status');
      if (res.ok) {
        const data = await res.json();
        setModelsStatus(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch('/api/models-status');
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setModelsStatus(data);
            setIsConnected(true);
          } else {
            setIsConnected(false);
          }
        }
      } catch {
        if (!cancelled) setIsConnected(false);
      }
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [auth]);

  const handleTextTranslate = async () => {
    if (!textInput.trim()) return;
    setIsTranslatingText(true);
    setTtsAudioUrl('');
    try {
      const res = await authFetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput,
          src_lang: textSrcLang,
          tgt_lang: textTgtLang
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTextOutput(data.translated_text);
        if (data.detected_src_lang) {
          setDetectedTextLang(data.detected_src_lang);
        }
      } else {
        alert('Translation failed. Please make sure the backend is running and models are loaded.');
      }
    } catch {
      alert('Network error connecting to backend.');
    } finally {
      setIsTranslatingText(false);
    }
  };

  const handleTextToSpeech = async () => {
    if (!textOutput.trim()) return;
    setIsGeneratingTts(true);
    try {
      const res = await authFetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textOutput,
          lang: textTgtLang
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        setTtsAudioUrl(audioUrl);
      } else {
        alert('TTS Synthesis failed.');
      }
    } catch {
      alert('Error generating TTS.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], "recorded_audio.wav", { type: 'audio/wav' });
        setAudioFile(file);
        setAudioResult(null);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Could not access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioResult(null);
    }
  };

  const processAudio = async () => {
    if (!audioFile) return;
    setIsProcessingAudio(true);
    setAudioProgress(10);
    setAudioProgressText('Uploading audio file and initializing pipeline...');

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model_size', whisperSize);
    formData.append('src_lang', audioSrcLang);
    formData.append('tgt_lang', audioTgtLang);

    try {
      const progressInterval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 90) { clearInterval(progressInterval); return prev; }
          if (prev >= 70) { setAudioProgressText('Translating text segments and synthesizing dubbing audio...'); return prev + 1; }
          if (prev >= 40) { setAudioProgressText('Transcribing speech offline using Whisper ASR...'); return prev + 2; }
          return prev + 5;
        });
      }, 800);

      const res = await authFetch('/api/translate-audio', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);

      if (res.ok) {
        setAudioProgress(100);
        setAudioProgressText('Synthesis complete!');
        const data = await res.json();
        setAudioResult(data);
      } else {
        alert('Audio processing failed. Check backend logs.');
        setIsProcessingAudio(false);
      }
    } catch {
      alert('Error connecting to backend.');
      setIsProcessingAudio(false);
    } finally {
      setTimeout(() => {
        setIsProcessingAudio(false);
        setAudioProgress(0);
      }, 1000);
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoResult(null);
    }
  };

  const pollJob = async (job_id, onSuccess, onFail, onProgress) => {
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/jobs/${job_id}`);
        if (res.ok) {
          const job = await res.json();
          if (onProgress) onProgress(job.progress, job.status);

          if (job.status === 'completed') {
            clearInterval(interval);
            onSuccess(job.result);
          } else if (job.status === 'failed') {
            clearInterval(interval);
            onFail(job.error || 'Job failed');
          }
        } else {
          clearInterval(interval);
          onFail('Error checking job status');
        }
      } catch {
        clearInterval(interval);
        onFail('Network error checking job status');
      }
    }, 2000);
    return interval;
  };

  const processVideo = async () => {
    if (!videoFile) return;
    setIsProcessingVideo(true);
    setVideoProgress(5);
    setVideoProgressText('Uploading video track. Initializing workspace...');

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('model_size', whisperSize);
    formData.append('src_lang', videoSrcLang);
    formData.append('tgt_lang', videoTgtLang);
    formData.append('burn_subtitles_option', burnSubtitles);
    formData.append('overlay_voice_option', overlayVoice);

    try {
      const res = await authFetch('/api/process-video', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const { job_id } = await res.json();
        pollJob(
          job_id,
          (result) => {
            setVideoResult(result);
            setVideoProgress(100);
            setVideoProgressText('Video processed successfully!');
            setTimeout(() => {
              setIsProcessingVideo(false);
              setVideoProgress(0);
            }, 1000);
          },
          (error) => {
            alert(`Video processing failed: ${error}`);
            setIsProcessingVideo(false);
          },
          (progress, status) => {
            setVideoProgress(progress);
            if (status === 'processing') {
              if (progress < 40) setVideoProgressText('Running speech-to-text extraction using Whisper...');
              else if (progress < 70) setVideoProgressText('Translating timeline and rendering transcript overlays...');
              else setVideoProgressText('Injecting subtitle layers and copying streams with FFmpeg...');
            }
          }
        );
      } else {
        alert('Video processing failed to start.');
        setIsProcessingVideo(false);
      }
    } catch {
      alert('Error connecting to video processing endpoint.');
      setIsProcessingVideo(false);
    }
  };

  const handleDocUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocFile(file);
      setDocResult(null);
    }
  };

  const processDoc = async () => {
    if (!docFile) return;
    setIsProcessingDoc(true);

    const formData = new FormData();
    formData.append('file', docFile);
    formData.append('src_lang', docSrcLang);
    formData.append('tgt_lang', docTgtLang);

    try {
      const res = await authFetch('/api/translate-document', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const { job_id } = await res.json();
        pollJob(
          job_id,
          (result) => {
            setDocResult(result);
            setIsProcessingDoc(false);
          },
          (error) => {
            alert(`Document translation failed: ${error}`);
            setIsProcessingDoc(false);
          }
        );
      } else {
        alert('Document translation failed to start.');
        setIsProcessingDoc(false);
      }
    } catch {
      alert('Error connecting to backend.');
      setIsProcessingDoc(false);
    }
  };

  return (
    <div className="app-container">

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isConnected={isConnected}
        auth={auth}
        handleLogout={handleLogout}
      />

      <div className="main-content">
        {!auth ? (
          <LoginForm
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            handleLogin={handleLogin}
            isLoggingIn={isLoggingIn}
          />
        ) : (
          <>
            <div className="header-container">
              <h1 className="page-title">{pageTitles[activeTab]}</h1>
              <p className="page-subtitle">{pageSubtitles[activeTab]}</p>
            </div>

            {activeTab === 'dashboard' && <DashboardTab setActiveTab={setActiveTab} />}

            {activeTab === 'text' && (
              <TextTranslationTab
                textInput={textInput} setTextInput={setTextInput}
                textOutput={textOutput}
                textSrcLang={textSrcLang} setTextSrcLang={setTextSrcLang}
                textTgtLang={textTgtLang} setTextTgtLang={setTextTgtLang}
                detectedTextLang={detectedTextLang}
                isTranslatingText={isTranslatingText} handleTextTranslate={handleTextTranslate}
                ttsAudioUrl={ttsAudioUrl}
                isGeneratingTts={isGeneratingTts} handleTextToSpeech={handleTextToSpeech}
              />
            )}

            {activeTab === 'docs' && (
              <DocumentTranslationTab
                docFile={docFile} handleDocUpload={handleDocUpload}
                docSrcLang={docSrcLang} setDocSrcLang={setDocSrcLang}
                docTgtLang={docTgtLang} setDocTgtLang={setDocTgtLang}
                isProcessingDoc={isProcessingDoc} processDoc={processDoc}
                docResult={docResult}
              />
            )}

            {activeTab === 'audio' && (
              <AudioTranslationTab
                audioFile={audioFile} handleAudioUpload={handleAudioUpload}
                audioSrcLang={audioSrcLang} setAudioSrcLang={setAudioSrcLang}
                audioTgtLang={audioTgtLang} setAudioTgtLang={setAudioTgtLang}
                isProcessingAudio={isProcessingAudio} processAudio={processAudio}
                audioProgress={audioProgress} audioProgressText={audioProgressText}
                audioResult={audioResult}
                audioActiveSubTab={audioActiveSubTab} setAudioActiveSubTab={setAudioActiveSubTab}
                isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
                recordingTime={recordingTime}
              />
            )}

            {activeTab === 'video' && (
              <VideoTranslationTab
                videoFile={videoFile} handleVideoUpload={handleVideoUpload}
                videoSrcLang={videoSrcLang} setVideoSrcLang={setVideoSrcLang}
                videoTgtLang={videoTgtLang} setVideoTgtLang={setVideoTgtLang}
                burnSubtitles={burnSubtitles} setBurnSubtitles={setBurnSubtitles}
                overlayVoice={overlayVoice} setOverlayVoice={setOverlayVoice}
                isProcessingVideo={isProcessingVideo} processVideo={processVideo}
                videoProgress={videoProgress} videoProgressText={videoProgressText}
                videoResult={videoResult}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                whisperSize={whisperSize} setWhisperSize={setWhisperSize}
                isConnected={isConnected} modelsStatus={modelsStatus}
                checkServerStatus={checkServerStatus}
              />
            )}
          </>
        )}
      </div>

      <footer className="app-footer">
        <div className="footer-brand">
          <span>🌾</span>
          Offline Translation Portal
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} All rights reserved.</div>
      </footer>
    </div>
  );
}

export default App;
