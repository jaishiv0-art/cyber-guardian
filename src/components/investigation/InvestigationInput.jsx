import { useRef, useState } from 'react'
import { Link2, FileUp, Smartphone, MessageSquare, UploadCloud, X, ScanSearch } from 'lucide-react'
import Button from '../common/Button.jsx'
import PersonalRiskSelect from './PersonalRiskSelect.jsx'
import { investigationTypes } from '../../data/constants.js'
import './InvestigationInput.css'

const ICONS = { url: Link2, file: FileUp, apk: Smartphone, message: MessageSquare }

export default function InvestigationInput({ disabled, onInvestigate }) {
  const [activeType, setActiveType] = useState('url')
  const [urlValue, setUrlValue] = useState('')
  const [messageValue, setMessageValue] = useState('')
  const [file, setFile] = useState(null)
  const [apk, setApk] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [personalContext, setPersonalContext] = useState('general')
  const fileInputRef = useRef(null)
  const apkInputRef = useRef(null)

  const canSubmit = {
    url: urlValue.trim().length > 3,
    file: !!file,
    apk: !!apk,
    message: messageValue.trim().length > 3,
  }[activeType]

  function handleSubmit() {
    if (!canSubmit || disabled) return
    const targetLabel = {
      url: urlValue,
      file: file?.name,
      apk: apk?.name,
      message: messageValue,
    }[activeType]
    const fileObj = { file, apk }[activeType]
    onInvestigate({ type: activeType, target: targetLabel, file: fileObj, personalContext })
  }

  function handleDrop(e, kind) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) kind === 'apk' ? setApk(f) : setFile(f)
  }

  return (
    <div className="g-inv-input">
      <div className="g-inv-tabs" role="tablist">
        {investigationTypes.map(({ id, label }) => {
          const Icon = ICONS[id]
          return (
            <button
              key={id}
              role="tab"
              aria-selected={activeType === id}
              className={`g-inv-tab ${activeType === id ? 'g-inv-tab--active' : ''}`}
              onClick={() => setActiveType(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </div>

      <div className="g-inv-panel">
        {activeType === 'url' && (
          <div className="g-inv-field anim-fade-up">
            <label className="g-inv-label">Paste a link to investigate</label>
            <div className="g-inv-url-row">
              <Link2 size={18} className="g-inv-url-icon" />
              <input
                type="text"
                className="g-inv-url-input mono"
                placeholder="https://example.com/suspicious-link"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <p className="g-inv-hint">Works with shortened links, redirects, and full URLs — Guardian follows the chain.</p>
          </div>
        )}

        {activeType === 'message' && (
          <div className="g-inv-field anim-fade-up">
            <label className="g-inv-label">Paste the message text</label>
            <textarea
              className="g-inv-textarea mono"
              placeholder='e.g. "Your parcel is on hold, pay ₹49 to release it: bit.ly/xyz123"'
              rows={5}
              value={messageValue}
              onChange={(e) => setMessageValue(e.target.value)}
            />
            <p className="g-inv-hint">Paste the full SMS, email or chat message — Guardian reads tone, links and intent.</p>
          </div>
        )}

        {activeType === 'file' && (
          <div
            className={`g-inv-drop anim-fade-up ${dragOver ? 'g-inv-drop--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => handleDrop(e, 'file')}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {!file ? (
              <>
                <UploadCloud size={26} />
                <p><strong>Drop a file</strong> or click to browse</p>
                <span className="g-inv-hint">Documents, images, archives, executables — up to 200MB</span>
              </>
            ) : (
              <div className="g-inv-file-chip" onClick={(e) => e.stopPropagation()}>
                <FileUp size={16} />
                <span className="mono">{file.name}</span>
                <button onClick={() => setFile(null)} aria-label="Remove file"><X size={14} /></button>
              </div>
            )}
          </div>
        )}

        {activeType === 'apk' && (
          <div
            className={`g-inv-drop anim-fade-up ${dragOver ? 'g-inv-drop--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => handleDrop(e, 'apk')}
            onClick={() => apkInputRef.current?.click()}
          >
            <input ref={apkInputRef} type="file" accept=".apk" hidden onChange={(e) => setApk(e.target.files?.[0] || null)} />
            {!apk ? (
              <>
                <Smartphone size={26} />
                <p><strong>Drop an .apk</strong> or click to browse</p>
                <span className="g-inv-hint">Guardian unpacks the manifest, permissions and signing certificate</span>
              </>
            ) : (
              <div className="g-inv-file-chip" onClick={(e) => e.stopPropagation()}>
                <Smartphone size={16} />
                <span className="mono">{apk.name}</span>
                <button onClick={() => setApk(null)} aria-label="Remove APK"><X size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>

      <PersonalRiskSelect value={personalContext} onChange={setPersonalContext} disabled={disabled} />

      <div className="g-inv-submit-row">
        <span className="g-inv-submit-hint">
          {canSubmit ? 'Ready to investigate' : 'Add something to investigate to continue'}
        </span>
        <Button
          variant="primary"
          size="lg"
          disabled={!canSubmit || disabled}
          icon={<ScanSearch size={17} />}
          onClick={handleSubmit}
        >
          {disabled ? 'Investigating…' : 'Investigate'}
        </Button>
      </div>
    </div>
  )
}
