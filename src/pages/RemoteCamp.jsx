import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_LIBRARY_URL, SUBMISSIONS_OPEN, remoteTracks, submissionFolderUrl } from '../lib/remote-camp'
import { useLanguage } from '../lib/language'
import styles from './RemoteCamp.module.css'

function Icon({ name }) {
  const paths = {
    external: <><path d="M14 4h6v6M20 4 10 14" /><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
    folder: <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

// Submissions (2026-11-09): each track links to its own Google Drive folder, where participants upload directly.
// The site itself still mounts no file input, drop handler, preview settings, or upload request,
// and /api/remote-upload stays locked. Set SUBMISSIONS_OPEN to false to show the closed state again.
export default function RemoteCamp() {
  const { t } = useLanguage()
  const copy = t.remote

  useEffect(() => {
    const previous = document.title
    document.title = copy.title
    return () => { document.title = previous }
  }, [copy.title])

  return <div className={styles.page}>
    <div className={`${styles.statusBar} ${SUBMISSIONS_OPEN ? styles.statusOpen : ''}`}><div className={styles.wrap}><Icon name={SUBMISSIONS_OPEN ? 'upload' : 'lock'} /><span>{SUBMISSIONS_OPEN ? copy.uploadOpen : copy.uploadClosed}</span></div></div>
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div><Link to="/tabsur" className={styles.breadcrumb}>{copy.breadcrumbCamp} <span>/</span> {copy.breadcrumbRemote}</Link><h1 id="remote-title">{copy.heroTitle} <span>{copy.heroAccent}</span></h1><p>{copy.heroText}</p></div>
        <span className={styles.onlineBadge}><i /> {copy.badge}</span>
      </header>
      <section className={styles.library} id="remote-library" aria-labelledby="library-title">
        <span className={styles.step}>{copy.step1}</span>
        <div className={styles.libraryCopy}><span className={styles.eyebrow}>{copy.libraryEyebrow}</span><h2 id="library-title">{copy.libraryTitle}</h2><p>{copy.libraryText}</p></div>
        <div className={styles.libraryAction}><a className={styles.primary} href={DEFAULT_LIBRARY_URL} target="_blank" rel="noopener noreferrer"><Icon name="folder" /> {copy.openFolder}<Icon name="external" /></a></div>
      </section>
      <section id="remote-submit" className={styles.submission} aria-labelledby="submit-title">
        <div className={styles.sectionHead}><span className={styles.step}>{copy.step2}</span><div><h2 id="submit-title">{copy.submitTitle}</h2><p>{copy.submitText}</p></div></div>
        {SUBMISSIONS_OPEN
          ? <div className={styles.howTo} id="upload-how-to">
            <div className={styles.howToHead}><Icon name="upload" /><strong>{copy.howToTitle}</strong></div>
            <ol>{copy.howToSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
            <p>{copy.howToNote}</p>
          </div>
          : <div className={styles.closedNotice} id="upload-closed-note"><Icon name="lock" /><div><strong>{copy.uploadClosed}</strong><p>{copy.uploadClosedNote}</p></div></div>}
        <div className={styles.trackGrid}>{remoteTracks.map(track => {
          const text = copy.tracks[track.id]
          const folder = SUBMISSIONS_OPEN ? submissionFolderUrl(track.id) : null
          return <article className={styles.track} key={track.id} aria-labelledby={`track-${track.id}`}>
            <div className={styles.trackImage}><img src={track.image} alt="" loading="eager" /><span>{track.number}</span></div>
            <div className={styles.trackBody}><h3 id={`track-${track.id}`}>{text.title}</h3><p>{text.description}</p>
              {folder
                ? <a className={styles.uploadButton} href={folder} target="_blank" rel="noopener noreferrer" aria-describedby="upload-how-to" aria-label={`${copy.uploadButton} — ${text.title}`}><Icon name="upload" /><span className={styles.labelLong}>{copy.uploadButton}</span><span className={styles.labelShort}>{copy.uploadButtonShort}</span><Icon name="external" /></a>
                : <button type="button" className={styles.attachButton} disabled aria-describedby="upload-closed-note" aria-label={`${copy.uploadClosed} — ${text.title}`}><Icon name="lock" /> {copy.uploadClosedButton}</button>}
            </div>
          </article>
        })}</div>
      </section>
    </div>
  </div>
}
