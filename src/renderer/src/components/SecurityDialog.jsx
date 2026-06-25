import React, { useState } from 'react';
import { NotificationSystem } from '../utils/notifications.js';

export default function SecurityDialog({ isOpen, onClose, onExecute }) {
  const [openPassword, setOpenPassword] = useState('');
  const [confirmOpenPassword, setConfirmOpenPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [encryptionStrength, setEncryptionStrength] = useState('AES-256'); // 'RC4-40' | 'RC4-128' | 'AES-128' | 'AES-256'
  
  // Permissions states
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowModifying, setAllowModifying] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);

  const [showPasswords, setShowPasswords] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (openPassword && openPassword !== confirmOpenPassword) {
      NotificationSystem.warning('Validation Error', 'Open passwords do not match.');
      return;
    }

    if (ownerPassword && ownerPassword !== confirmOwnerPassword) {
      NotificationSystem.warning('Validation Error', 'Owner passwords do not match.');
      return;
    }

    if (!openPassword && !ownerPassword) {
      NotificationSystem.warning('Validation Error', 'Please enter at least an Open Password or an Owner Password.');
      return;
    }

    onExecute({
      openPassword,
      ownerPassword,
      encryptionStrength,
      permissions: {
        printing: allowPrinting,
        modifying: allowModifying,
        copying: allowCopying
      }
    });
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog-window" style={{ width: '480px' }}>
        <div className="dialog-header">
          <h3>Document Security Settings</h3>
          <button className="dialog-close-btn" onClick={onClose} title="Close dialog">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Show Passwords</span>
              </label>
            </div>

            {/* Document Open Password */}
            <div className="form-group" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <label style={{ fontWeight: '600', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                Open Password (User Password)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="form-group">
                  <label htmlFor="sec-open-pw" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Password to Open PDF</label>
                  <input
                    id="sec-open-pw"
                    type={showPasswords ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Require password to open document"
                    value={openPassword}
                    onChange={(e) => setOpenPassword(e.target.value)}
                  />
                </div>
                {openPassword && (
                  <div className="form-group">
                    <label htmlFor="sec-open-pw-confirm" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confirm Open Password</label>
                    <input
                      id="sec-open-pw-confirm"
                      type={showPasswords ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Confirm open password"
                      value={confirmOpenPassword}
                      onChange={(e) => setConfirmOpenPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Permissions / Owner Password */}
            <div className="form-group" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <label style={{ fontWeight: '600', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                Owner Password & Permissions
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="form-group">
                  <label htmlFor="sec-owner-pw" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Permissions Password</label>
                  <input
                    id="sec-owner-pw"
                    type={showPasswords ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Require password to change settings"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                  />
                </div>
                {ownerPassword && (
                  <div className="form-group">
                    <label htmlFor="sec-owner-pw-confirm" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confirm Permissions Password</label>
                    <input
                      id="sec-owner-pw-confirm"
                      type={showPasswords ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Confirm permissions password"
                      value={confirmOwnerPassword}
                      onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Permissions checkboxes */}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>Allow High-Resolution Printing</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={allowModifying}
                    onChange={(e) => setAllowModifying(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>Allow Document Modifying (Annotations, Form Fields)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={allowCopying}
                    onChange={(e) => setAllowCopying(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>Allow Text & Graphics Content Copying</span>
                </label>
              </div>
            </div>

            {/* Encryption Level Selection */}
            <div className="form-group">
              <label htmlFor="sec-encryption-level">Encryption Strength</label>
              <select
                id="sec-encryption-level"
                className="form-control"
                value={encryptionStrength}
                onChange={(e) => setEncryptionStrength(e.target.value)}
              >
                <option value="AES-256">AES 256-bit (Acrobat 9.0 and later - Recommended)</option>
                <option value="AES-128">AES 128-bit (Acrobat 7.0 and later)</option>
                <option value="RC4-128">RC4 128-bit (Acrobat 5.0 and later)</option>
                <option value="RC4-40">RC4 40-bit (Legacy / Unsecure)</option>
              </select>
            </div>

          </div>
          <div className="dialog-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Encrypt & Apply Security</button>
          </div>
        </form>
      </div>
    </div>
  );
}
