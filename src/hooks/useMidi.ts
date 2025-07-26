import { useEffect, useRef, useState, useCallback } from 'react';
import { WebMidi, Input, Output } from 'webmidi';
import { ShaderEffect } from '../utils';

export interface MidiConfig {
  onEffectToggle: (effect: ShaderEffect) => void;
  onIntensityChange: (effect: ShaderEffect, intensity: number) => void;
  onMidiConnect?: () => void; // Called when MIDI connection is established
}

export interface MidiState {
  connected: boolean;
  deviceName: string;
}

export const useMidi = (config: MidiConfig): MidiState => {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  const inputRef = useRef<Input | null>(null);
  const outputRef = useRef<Output | null>(null);
  const lastCCValuesRef = useRef<Record<number, number>>({});

  // Launchkey Mini MK3 pad mapping - DRUM MODE
  const PADS = {
    // Top row (40-43, 48-51) - these effects will be controlled by knobs
    40: ShaderEffect.INVERT,
    41: ShaderEffect.REALITY_GLITCH,
    42: ShaderEffect.DISPLACE,
    43: ShaderEffect.CHROMA,
    48: ShaderEffect.PIXELATE,
    49: ShaderEffect.VORONOI,
    50: ShaderEffect.RIPPLE,
    51: null, // Reserved for future effect with intensity
    // Bottom row (36-39, 44-47) - toggle only, no knob control
    36: ShaderEffect.GRAYSCALE,
    37: ShaderEffect.KALEIDOSCOPE,
    38: ShaderEffect.SWIRL,
    // Remove: 47: 'BPM_TAP', - just leave unmapped
  };

  // Direct mapping from CC numbers to effects
  const KNOB_CC_MAPPING = {
    21: ShaderEffect.INVERT,     // Knob 1
    22: ShaderEffect.REALITY_GLITCH,  // Knob 2
    23: ShaderEffect.DISPLACE,   // Knob 3
    24: ShaderEffect.CHROMA,     // Knob 4
    25: ShaderEffect.PIXELATE,   // Knob 5
    26: ShaderEffect.VORONOI,    // Knob 6
    27: ShaderEffect.RIPPLE,     // Knob 7
    28: null,                    // Knob 8 - Reserved for future effect
  };

  const setupEventListeners = useCallback(() => {
    if (!inputRef.current) return;

    // Handle pad presses
    inputRef.current.addListener('noteon', (event) => {
      const note = event.note.number;

      // Check mapped effects
      const effect = PADS[note as keyof typeof PADS];
      if (effect && typeof effect === 'string' && Object.values(ShaderEffect).includes(effect as ShaderEffect)) {
        config.onEffectToggle(effect as ShaderEffect);
        return;
      }

      // Remove BPM tap handling
    });

    // Handle knob turns
    inputRef.current.addListener('controlchange', (event) => {
      const ccNumber = event.controller.number;
      const value = event.rawValue ?? 0;

      // Only process mapped knobs
      const effect = KNOB_CC_MAPPING[ccNumber as keyof typeof KNOB_CC_MAPPING];
      if (effect !== undefined) {
        // More aggressive debounce - only skip if value is identical
        const lastValue = lastCCValuesRef.current[ccNumber] || -1; // Use -1 to ensure first value always processes

        if (value !== lastValue) {
          lastCCValuesRef.current[ccNumber] = value;

          if (effect) {
            // Improved mapping with wider snap zones for better reliability
            let intensity = value / 127;

            // Wider snap zones: 0-2 → 0%, 125-127 → 100%
            if (value <= 2) intensity = 0;
            if (value >= 125) intensity = 1;

            // Clamp to ensure we stay in bounds
            intensity = Math.max(0, Math.min(1, intensity));

            // Log knob values for debugging/adjustment
            console.log(`CC${ccNumber}: raw=${value} intensity=${(intensity * 100).toFixed(1)}%`);

            config.onIntensityChange(effect, intensity);
          }
        }
      }
    });



  }, [config]);

  const initialize = useCallback(async () => {
    try {
      await WebMidi.enable();

      // Find Launchkey Mini MK3
      const launchkeyInput = WebMidi.getInputByName('Launchkey Mini MK3') ||
        WebMidi.getInputByName('Launchkey Mini') ||
        WebMidi.inputs.find(input => input.name.toLowerCase().includes('launchkey'));

      const launchkeyOutput = WebMidi.getOutputByName('Launchkey Mini MK3') ||
        WebMidi.getOutputByName('Launchkey Mini') ||
        WebMidi.outputs.find(output => output.name.toLowerCase().includes('launchkey'));

      if (!launchkeyInput || !launchkeyOutput) {
        throw new Error('Launchkey Mini not found');
      }

      inputRef.current = launchkeyInput;
      outputRef.current = launchkeyOutput;

      // Setup event listeners
      setupEventListeners();

      setConnected(true);
      setDeviceName(launchkeyInput.name);

      // Call the onMidiConnect callback if provided
      // Note: Reading current knob values is not possible with MIDI controllers
      // MIDI knobs only send values when moved, not their current position
      // Alternative: User can move each knob slightly to "sync" the hardware with the app
      if (config.onMidiConnect) {
        config.onMidiConnect();
      }

    } catch (error) {
      setConnected(false);
    }
  }, [setupEventListeners]);

  const disconnect = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.removeListener();
      inputRef.current = null;
    }
    if (outputRef.current) {
      outputRef.current = null;
    }
    setConnected(false);
    setDeviceName('');
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
    return disconnect;
  }, [initialize, disconnect]);

  return {
    connected,
    deviceName,
  };
}; 