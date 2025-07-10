import React from "react";
import { ShaderEffect } from "../utils";

interface MidiTabProps {
  midiConnected: boolean;
  midiDeviceName: string;
  showHelp: boolean;
  onToggleHelp: () => void;
  isPopupMode?: boolean;
}

export const MidiTab: React.FC<MidiTabProps> = ({
  midiConnected,
  midiDeviceName,
  showHelp,
  onToggleHelp,
  isPopupMode = false,
}) => {
  // Knob mapping from CC numbers to effects
  const knobMapping = [
    { cc: 21, effect: ShaderEffect.INVERT },
    { cc: 22, effect: ShaderEffect.SINE_WAVE },
    { cc: 23, effect: ShaderEffect.DISPLACE },
    { cc: 24, effect: ShaderEffect.CHROMA },
    { cc: 25, effect: ShaderEffect.PIXELATE },
    { cc: 26, effect: ShaderEffect.VORONOI },
    { cc: 27, effect: ShaderEffect.RIPPLE },
    { cc: 28, effect: null }, // Reserved
  ];

  // Top row pads (knob-controlled effects)
  const topRowPads = [
    { note: 40, effect: ShaderEffect.INVERT },
    { note: 41, effect: ShaderEffect.SINE_WAVE },
    { note: 42, effect: ShaderEffect.DISPLACE },
    { note: 43, effect: ShaderEffect.CHROMA },
    { note: 48, effect: ShaderEffect.PIXELATE },
    { note: 49, effect: ShaderEffect.VORONOI },
    { note: 50, effect: ShaderEffect.RIPPLE },
    { note: 51, effect: null }, // Reserved
  ];

  // Bottom row pads (toggle-only effects)
  const bottomRowPads = [
    { note: 36, effect: ShaderEffect.GRAYSCALE },
    { note: 37, effect: ShaderEffect.KALEIDOSCOPE },
    { note: 38, effect: ShaderEffect.SWIRL },
    { note: 39, effect: null }, // Unused
    { note: 44, effect: null }, // Unused
    { note: 45, effect: null }, // Unused
    { note: 46, effect: null }, // Unused
    { note: 47, effect: 'BPM_TAP' }, // Special function
  ];

  return (
    <div className="tab-content">
      {/* Connection Status */}
      <div className="control-group">
        <label className="control-label">MIDI Controller Status</label>
        <div style={{
          padding: "10px",
          borderRadius: "4px",
          backgroundColor: midiConnected ? "#d4edda" : "#f8d7da",
          border: `1px solid ${midiConnected ? "#c3e6cb" : "#f5c6cb"}`,
          color: midiConnected ? "#155724" : "#721c24"
        }}>
          {midiConnected ? (
            <>
              ✅ Connected to: <strong>{midiDeviceName}</strong>
            </>
          ) : (
            <>
              ❌ Not connected. Please connect your Launchkey Mini and refresh the page.
            </>
          )}
        </div>
        {!midiConnected && (
          <p className="control-description" style={{ marginTop: "10px" }}>
            Make sure your Launchkey Mini is connected via USB and try refreshing the page.
            Your browser may also ask for MIDI permissions.
          </p>
        )}
      </div>

      {/* Knobs Section */}
      <div className="keyboard-section">
        <h3>🎛️ KNOBS (Intensity Control)</h3>
        <div className={isPopupMode ? "knobs-grid" : "knobs-list"}>
          {knobMapping.map((knob, index) => (
            <div key={knob.cc} className={`knob-item ${knob.effect ? 'active' : ''} ${isPopupMode ? '' : 'list-item'}`}>
              <div>Knob {index + 1}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>CC{knob.cc}</div>
              <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>
                {knob.effect ? knob.effect.toUpperCase() : 'Reserved'}
              </div>
            </div>
          ))}
        </div>
        <p className="control-description">
          🎛️ Knobs 1-7 control intensity (0-100%) of top row effects. Knob 8 reserved for future use.
        </p>
      </div>

      {/* Top Row Pads */}
      <div className="keyboard-section">
        <h3>🟨 TOP ROW PADS (Toggle + Knob Control)</h3>
        <div className={isPopupMode ? "pads-grid" : "pads-list"}>
          {topRowPads.map((pad, index) => (
            <div key={pad.note} className={`pad-item ${pad.effect ? 'top-row' : 'unused'} ${isPopupMode ? '' : 'list-item'}`}>
              <div className="pad-note">Pad {index + 9}</div>
              <div className="pad-note">Note {pad.note}</div>
              <div className="pad-effect">
                {pad.effect ? pad.effect.toUpperCase() : 'Reserved'}
              </div>
            </div>
          ))}
        </div>
        <p className="control-description">
          🟨 Top row pads toggle effects on/off AND have knob intensity control (0-100%)
        </p>
      </div>

      {/* Bottom Row Pads */}
      <div className="keyboard-section">
        <h3>🟦 BOTTOM ROW PADS (Toggle Only)</h3>
        <div className={isPopupMode ? "pads-grid" : "pads-list"}>
          {bottomRowPads.map((pad, index) => (
            <div key={pad.note} className={`pad-item ${pad.effect === 'BPM_TAP' ? 'special' :
              pad.effect ? 'bottom-row' : 'unused'
              } ${isPopupMode ? '' : 'list-item'}`}>
              <div className="pad-note">Pad {index + 1}</div>
              <div className="pad-note">Note {pad.note}</div>
              <div className="pad-effect">
                {pad.effect === 'BPM_TAP' ? 'BPM TAP' :
                  pad.effect ? pad.effect.toUpperCase() : 'Unused'}
              </div>
            </div>
          ))}
        </div>
        <p className="control-description">
          🟦 Bottom row pads toggle effects on/off only (no intensity control) • 🟥 Special functions
        </p>
      </div>

      {/* Usage Tips */}
      <div className="control-group">
        <label className="control-label">Usage Tips</label>
        <div style={{
          fontSize: "12px",
          lineHeight: "1.6",
          backgroundColor: "#f8f9fa",
          padding: "12px",
          borderRadius: "4px",
          border: "1px solid #e9ecef"
        }}>
          <div><strong>🎛️ Knobs:</strong> Directly control intensity of top row effects (0-100%)</div>
          <div><strong>🟨 Top row:</strong> Toggle effects + knob intensity control</div>
          <div><strong>🟦 Bottom row:</strong> Toggle effects only (no intensity)</div>
          <div><strong>🟥 BPM Tap:</strong> Located at pad 8 (note 47) - far away from other controls</div>
          <div style={{ marginTop: "8px", fontStyle: "italic" }}>
            • When MIDI is connected, intensity sliders are disabled to prevent desync<br />
            • Effect toggles remain available with both pads and mouse clicks<br />
            • Move knobs slightly after connecting to sync hardware with app
          </div>
        </div>
      </div>

      {/* Help Toggle */}
      <div className="control-group">
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="showHelp-midi"
            className="control-checkbox"
            checked={showHelp}
            onChange={onToggleHelp}
          />
          <label htmlFor="showHelp-midi" className="checkbox-label">
            Show help overlay
          </label>
        </div>
      </div>
    </div>
  );
}; 