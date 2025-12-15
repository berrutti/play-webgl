# Play WebGL - Architecture & Context for Claude

## Project Overview
Real-time WebGL video effects application with MIDI controller integration. Users can apply shader effects to webcam or video files, control effects via MIDI (Launchkey Mini MK3), and synchronize effects with BPM.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Package Manager**: Yarn (NOT npm - no package-lock.json)
- **Testing**: Vitest + @testing-library/react
- **Styling**: Plain CSS
- **APIs**: WebGL, WebMIDI, MediaStream

## Architecture

### Hooks-Based Architecture
App.tsx (~380 lines) coordinates 6 custom hooks that separate concerns:

1. **useBpmTap** - BPM tap tempo calculation from spacebar
2. **useSettings** - Settings persistence to localStorage (showHelp, isMuted, inputSource, bpm)
3. **useEffectTransitions** - **CRITICAL**: Single source of truth for `activeEffects` state + smooth effect transitions
4. **useVideoPlaylist** - Video playlist management, playback controls
5. **useVideoSource** - Video element source management (webcam vs file)
6. **usePopupWindow** - Popup window for control panel

Plus two more complex hooks:
- **useMidi** - MIDI controller integration (Launchkey Mini MK3)
- **useWebGLRenderer** - WebGL rendering pipeline

### Key State Management Rules

⚠️ **CRITICAL - State Synchronization**:
- `activeEffects` lives ONLY in `useEffectTransitions` - it's the single source of truth
- Never create duplicate `activeEffects` state elsewhere
- Never try to sync `activeEffects` between hooks with useEffect - causes circular dependencies

❌ **NEVER DO THIS**:
```typescript
// BAD - causes infinite loops and UI freezing
useEffect(() => {
  effectTransitions.setActiveEffects(settings.activeEffects);
}, [settings.activeEffects]);
```

### Shader Effects System

**Effects Enum** (src/utils.ts):
```typescript
enum ShaderEffect {
  INVERT, GRAYSCALE, REALITY_GLITCH, KALEIDOSCOPE,
  DISPLACE, SWIRL, CHROMA, PIXELATE, VORONOI, RIPPLE
}
```

**Effect Stages**:
- `mapping` stage: Mutates UV coordinates (distortion effects)
- `color` stage: Mutates color values (color effects)

**Intensity Control**: Some effects have `intensity` property (0-1 range) for user control

**Transitions**: Effects smoothly fade in/out using transition system in `src/transitions.ts`

### Project Structure

```
src/
├── App.tsx                    # Main app component (~380 lines)
├── ControlPanel.tsx           # UI controls component
├── hooks/                     # Custom hooks
│   ├── useBpmTap.ts          # BPM calculation
│   ├── useSettings.ts        # localStorage persistence
│   ├── useEffectTransitions.ts  # Effect state + transitions (SINGLE SOURCE OF TRUTH)
│   ├── useVideoPlaylist.ts  # Video management
│   ├── useVideoSource.ts     # Video element management
│   ├── usePopupWindow.ts     # Popup window
│   ├── useMidi.ts            # MIDI integration
│   ├── useWebGLRenderer.ts   # WebGL rendering
│   └── *.test.ts             # Vitest tests (42 tests total)
├── services/
│   └── settingsService.ts    # localStorage abstraction
├── transitions.ts            # Effect transition system
├── utils.ts                  # ShaderEffect enum + definitions
└── test/
    └── setup.ts              # Vitest setup
```

### Testing

**Test Coverage** (42 tests):
- ✅ useBpmTap (6 tests)
- ✅ useSettings (9 tests)
- ✅ useEffectTransitions (10 tests)
- ✅ useVideoPlaylist (17 tests)
- ❌ useMidi (not tested - complex WebMIDI mocking)
- ❌ useWebGLRenderer (not tested - WebGL mocking)
- ❌ usePopupWindow (not tested - window.open mocking)
- ❌ useVideoSource (not tested - returns void, mostly side effects)

**Run tests**: `yarn test`

### Settings Persistence

**settingsService** (src/services/settingsService.ts):
- Saves/loads to localStorage with key prefix 'play-webgl-'
- Settings: showHelp, isMuted, inputSource, bpm, activeEffects, effectIntensities

**Initialization Pattern**:
- Hooks use `isInitialized` flag to prevent saving on first mount
- First useEffect sets isInitialized = true
- Subsequent renders save to localStorage

## Development Workflow Rules

### 🚨 CRITICAL RULES - MUST FOLLOW:

1. **NEVER modify logic without explicit permission**
   - Only refactor code structure with user approval
   - Always ask before changing behavior

2. **ALWAYS verify no regressions**
   - Run tests: `yarn test`
   - Ask user to test the app if no tests exist
   - Never mark tasks complete without verification

3. **DO NOT be "smart" about architecture**
   - Don't proactively refactor unless asked
   - Don't make assumptions about improvements
   - Every part is delicate and working - treat with care

### Code Style

- Use TypeScript strict mode
- Prefer explicit types over inference where it aids clarity
- Use React.Dispatch<React.SetStateAction<T>> for setter returns
- Use RefObject<HTMLElement | null> for refs that can be null
- No emojis in code unless explicitly requested

### Git Workflow

⚠️ **CRITICAL - Git Commands**:
- **NEVER run git commands unless explicitly asked by the user**
- **NEVER push, commit, or change the git HEAD**
- User may ask: "what changed between commits?" - you can read git history for analysis only
- User may ask: "create a commit" - only then you can commit (never push)
- **DO NOT** proactively create commits, even when completing tasks
- User uses yarn (not npm)
- Commit messages: Follow existing repo style, use heredoc for multi-line
- No force pushes to main/master

## MIDI Integration

**Supported Controller**: Novation Launchkey Mini MK3

**MIDI Mapping**:
- Pads (top row): Toggle effects on/off
- Knobs (rotary controls): Adjust effect intensities
- Transport controls: Playback, navigation
- Scene buttons: Video playlist management

**Implementation**: `useMidi.ts` handles WebMIDI API integration

## Common Tasks

### Adding a New Effect

1. Add to `ShaderEffect` enum in `src/utils.ts`
2. Define in `shaderEffects` object with stage + GLSL code
3. Update `initialActiveEffects` in hooks that use it
4. Update tests to include new effect
5. **Get user approval before implementing**

### Adding a New Hook

1. Create in `src/hooks/`
2. Export return type interface
3. Write tests in `src/hooks/*.test.ts`
4. Import and use in `App.tsx`
5. **Get user approval for logic changes**

### Modifying Effect Transitions

- Code in `src/transitions.ts`
- Uses requestAnimationFrame for smooth 60fps animations
- Default transition duration: 300ms
- Debounce delay: 50ms (prevents rapid toggles)

## Known Issues & Quirks

1. **Vitest act() warnings**: Async transitions trigger act() warnings in tests - this is expected and harmless
2. **Effect sync bug**: Fixed - activeEffects used to exist in two places, now only in useEffectTransitions
3. **Popup window styling**: Copies all stylesheets to popup but may fail for cross-origin sheets (try/catch)

## Performance Notes

- WebGL rendering: 60fps target
- Effect transitions: Hardware-accelerated when possible
- Video processing: Real-time, no buffering
- State updates: Debounced where appropriate (50ms for effects)

## Deployment

- Build: `yarn build`
- Preview: `yarn preview`
- Deploy: `yarn deploy` (builds + deploys to GitHub Pages via gh-pages)
- Version bump: Automatic with deploy script

## Future Improvements (If Asked)

- [ ] Add tests for useMidi (requires WebMIDI mocking)
- [ ] Add tests for useWebGLRenderer (requires WebGL context mocking)
- [ ] Add more shader effects
- [ ] Add effect presets/combinations
- [ ] Add audio reactivity (frequency analysis)

## Context for Next Session

When you return to this project:
1. Read this file first to understand architecture
2. Check if tests pass: `yarn test`
3. Review recent git history if needed
4. Always ask before modifying logic
5. Remember: activeEffects only lives in useEffectTransitions
6. Clip functionality has been removed - effects are manually toggled only

## Contact & Links

- Author: berrutti (berrutit@gmail.com)
- GitHub: https://github.com/berrutti
- Homepage: https://berrutti.github.io/play-webgl
