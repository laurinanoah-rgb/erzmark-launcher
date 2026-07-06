/**
 * Spielt das Update-Video einmalig nach dem Login ab (vor dem
 * Install/Play-Bildschirm). Wird nur gezeigt, wenn sich `clientVersion` im
 * Manifest gegenüber dem zuletzt gesehenen Stand geändert hat (siehe
 * App.jsx). Dezenter Überspringen-Button, wie im Auftrag gefordert.
 */
export default function UpdateVideoScreen({ videoUrl, onDone }) {
  return (
    <div className="erzmark-update-video">
      <video
        src={videoUrl}
        autoPlay
        onEnded={onDone}
        onError={onDone}
        className="erzmark-update-video-player"
      />
      <button className="erzmark-skip-btn" onClick={onDone}>
        Überspringen
      </button>
    </div>
  );
}
