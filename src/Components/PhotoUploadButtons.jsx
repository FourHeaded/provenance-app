// Reusable photo picker. Renders two buttons side by side:
//   • Take Photo       — opens the device camera directly (capture="environment")
//   • Choose from Library — opens the standard file picker
//
// Each button has its own hidden <input type="file"> that's clicked
// programmatically via a ref. Both inputs forward the selected file
// to the same `onFileSelected(file)` callback prop.
//
// Props:
//   onFileSelected(file)  — required, called with the File object
//   label                 — optional string shown above the buttons
//   disabled              — optional boolean
//   className             — optional extra class on the wrapper

import { useRef } from 'react'

const CameraIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const LibraryIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

function PhotoUploadButtons({ onFileSelected, label, disabled = false, className = '' }) {
  const cameraRef  = useRef(null)
  const libraryRef = useRef(null)

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    // Reset so selecting the same file twice still triggers onChange
    e.target.value = ''
    if (file) onFileSelected(file)
  }

  return (
    <div className={`photo-upload-buttons ${className}`}>
      {label && <div className="photo-upload-buttons-label">{label}</div>}

      <div className="photo-upload-buttons-row">
        <button
          type="button"
          className="btn-ghost photo-upload-btn-camera"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
        >
          <CameraIcon />
          Take Photo
        </button>
        <button
          type="button"
          className="btn-ghost photo-upload-btn-library"
          onClick={() => libraryRef.current?.click()}
          disabled={disabled}
        >
          <LibraryIcon />
          Choose from Library
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default PhotoUploadButtons
