import { useRef } from 'react';
import { useLang } from '../LanguageContext';

export default function VideoTranslationTab({
  videoFile, handleVideoUpload,
  videoSrcLang, setVideoSrcLang,
  videoTgtLang, setVideoTgtLang,
  burnSubtitles, setBurnSubtitles,
  overlayVoice, setOverlayVoice,
  isProcessingVideo, processVideo,
  videoProgress, videoProgressText,
  videoResult,
}) {
  const { t } = useLang();
  const videoFileInputRef = useRef(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-card translator-grid">
        <div>
          <div className="form-group">
            <label className="form-label">{t('video.direction')}</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>{t('video.from')}</span>
                <select className="select-control" value={videoSrcLang} onChange={(e) => setVideoSrcLang(e.target.value)}>
                  <option value="auto">✨ {t('text.auto')}</option>
                  <option value="English">{t('text.english')}</option>
                  <option value="Hindi">{t('text.hindi')}</option>
                  <option value="Marathi">{t('text.marathi')}</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>{t('video.to')}</span>
                <select className="select-control" value={videoTgtLang} onChange={(e) => setVideoTgtLang(e.target.value)}>
                  <option value="Hindi">{t('text.hindi')}</option>
                  <option value="Marathi">{t('text.marathi')}</option>
                  <option value="English">{t('text.english')}</option>
                </select>
              </div>
            </div>
          </div>

          <div
            className="dropzone"
            onClick={() => videoFileInputRef.current.click()}
            style={{ padding: '2.5rem 2rem' }}
          >
            <div className="dropzone-icon">🎬</div>
            <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{t('video.browse')}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('video.supported')}</div>
            <input
              type="file"
              ref={videoFileInputRef}
              style={{ display: 'none' }}
              accept="video/*"
              onChange={handleVideoUpload}
            />
          </div>

          {videoFile && (
            <div className="file-badge" style={{ marginTop: '1rem' }}>
              <span>🎥</span>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            <div className="switch-container">
              <div className="switch-label-group">
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{t('video.burnSubs')}</span>
                <span className="switch-subtext">{t('video.burnSubsDesc')}</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={burnSubtitles} onChange={(e) => setBurnSubtitles(e.target.checked)} />
                <span className="slider" />
              </label>
            </div>

            <div className="switch-container">
              <div className="switch-label-group">
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{t('video.voiceOverlay')}</span>
                <span className="switch-subtext">{t('video.voiceOverlayDesc')}</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={overlayVoice} onChange={(e) => setOverlayVoice(e.target.checked)} />
                <span className="slider" />
              </label>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.25rem' }}
            disabled={!videoFile || isProcessingVideo}
            onClick={processVideo}
          >
            {isProcessingVideo ? `⏳ ${t('video.processing')}` : `⚡ ${t('video.process')}`}
          </button>

          {isProcessingVideo && (
            <div className="progress-panel">
              <div className="progress-header">
                <div className="processing-pulse">🎞️ {t('common.processing')}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green-dark)' }}>{videoProgress}%</div>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${videoProgress}%` }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {videoProgressText}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">{t('video.preview')}</div>

          {videoResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flexGrow: 1 }}>
              <video src={videoResult.video_url} controls className="custom-video-player" />

              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>{t('video.preview')}</label>
                <div className="subtitle-editor">
                  {videoResult.translated_srt.split('\n\n').filter(Boolean).map((block, idx) => {
                    const lines = block.split('\n');
                    const timing = lines[1] || '';
                    const text = lines.slice(2).join(' ') || '';
                    return (
                      <div className="subtitle-segment" key={idx}>
                        <div className="sub-time">{timing.split(' --> ')[0]?.slice(3, 8)} ➔ {timing.split(' --> ')[1]?.slice(3, 8)}</div>
                        <div className="sub-text">{text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <a
                  className="btn btn-primary"
                  style={{ flex: 1, textDecoration: 'none' }}
                  href={videoResult.video_url}
                  download={`translated_${videoTgtLang}_${videoFile?.name}`}
                >📥 {t('video.downloadVideo')}</a>
                <a
                  className="btn btn-secondary"
                  style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                  href={videoResult.srt_url}
                  download={`subtitles_${videoTgtLang}_${videoFile?.name?.split('.')[0]}.srt`}
                >📄 {t('video.downloadSrt')}</a>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎬</div>
              <span>{t('video.empty')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
