/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LaserConfig, SpecimenId, CameraPreset, InteractionMode } from './types/lab';
import { LabCanvas3D } from './components/LabCanvas3D';
import { LabHeader } from './components/LabHeader';
import { LabControlDock } from './components/LabControlDock';
import { labAudio } from './utils/audio';

const VALID_SPECIMENS: SpecimenId[] = [
  't_2d', 'circle_2d', 'trapezoid_2d', 'square_2d', 'rectangle_2d', 'triangle_2d',
  't_3d', 'cylinder_3d', 'trapezoid_3d', 'cube_3d', 'cuboid_3d', 'prism_3d',
];

const parseInitialHash = () => {
  if (typeof window === 'undefined' || !window.location.hash) {
    return null;
  }
  try {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const p = new URLSearchParams(raw);
    const alphaNum = parseInt(p.get('alpha') || '', 10);
    const alpha = (!isNaN(alphaNum) && alphaNum >= 30 && alphaNum <= 150) ? alphaNum : 30;
    const intensityNum = parseFloat(p.get('intensity') || '');
    const intensity = (!isNaN(intensityNum) && intensityNum >= 0.2 && intensityNum <= 1.0)
      ? Math.round(intensityNum * 100) / 100
      : 1.0;
    const lampStr = p.get('lamp');
    const isVisible = lampStr !== '0';
    const powerStr = p.get('power');
    const isOn = powerStr !== '0';
    const spec = p.get('specimen') as SpecimenId;
    const selectedSpecimen: SpecimenId = (spec && VALID_SPECIMENS.includes(spec)) ? spec : 't_2d';
    const boxStr = p.get('box');
    const isBoxVisible = boxStr !== '0';
    const cam = p.get('cam') as CameraPreset;
    const cameraPreset: CameraPreset = (cam && ['isometric', 'top', 'front', 'side'].includes(cam)) ? cam : 'isometric';
    const mode = p.get('mode') as InteractionMode;
    const interactionMode: InteractionMode = (mode && ['orbit', 'pan'].includes(mode)) ? mode : 'orbit';

    return {
      laser: {
        isOn,
        alpha,
        intensity,
        beamRadius: 0.75,
        isVisible,
      },
      selectedSpecimen,
      isBoxVisible,
      cameraPreset,
      interactionMode,
    };
  } catch (_) {
    return null;
  }
};

export default function App() {
  const initial = useRef(parseInitialHash()).current;

  const [laser, setLaser] = useState<LaserConfig>(
    initial?.laser ?? {
      isOn: true,
      alpha: 30, // Mặc định ban đầu là 30 độ ngay vị trí đầu tiên
      intensity: 1.0,
      beamRadius: 0.75,
      isVisible: true,
    }
  );

  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenId>(
    initial?.selectedSpecimen ?? 't_2d'
  );
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(
    initial?.cameraPreset ?? 'isometric'
  );
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(
    initial?.interactionMode ?? 'orbit'
  );
  const [resetKey, setResetKey] = useState(0);
  const [isBoxVisible, setIsBoxVisible] = useState<boolean>(
    initial?.isBoxVisible ?? true
  );
  const [is3DReady, setIs3DReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    labAudio.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Đồng bộ hóa trạng thái Toàn màn hình giữa F11, Esc và Nút bấm Header
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Tự động đồng bộ hóa trạng thái thí nghiệm vào URL Hash với Debounce 600ms
  // Chống nghẽn IPC, chống giật lag và chống lỗi bảo mật WebKit trên iPhone (SecurityError: Attempt to use history.replaceState() more than 100 times per 30 seconds)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      try {
        const params = new URLSearchParams();
        params.set('alpha', Math.round(laser.alpha).toString());
        params.set('specimen', selectedSpecimen);
        if (!isBoxVisible) params.set('box', '0');
        if (laser.isVisible === false) params.set('lamp', '0');
        if (!laser.isOn) params.set('power', '0');
        if (laser.intensity < 0.99) params.set('intensity', (Math.round(laser.intensity * 100) / 100).toString());
        if (cameraPreset !== 'isometric') params.set('cam', cameraPreset);
        if (interactionMode !== 'orbit') params.set('mode', interactionMode);

        const hashStr = '#' + params.toString();
        if (window.location.hash !== hashStr) {
          window.history.replaceState(null, '', hashStr);
        }
      } catch (_) {
        // Nuốt lỗi an toàn nếu WebKit hoặc trình duyệt chặn replaceState
      }
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [laser, selectedSpecimen, isBoxVisible, cameraPreset, interactionMode]);

  const handleUpdateLaser = (partial: Partial<LaserConfig>) => {
    setLaser((prev) => ({ ...prev, ...partial }));
  };

  const handleToggleBox = () => {
    labAudio.playClick();
    setIsBoxVisible((prev) => !prev);
  };

  const handleResetView = () => {
    labAudio.playClick();
    setCameraPreset('isometric');
    setResetKey((prev) => prev + 1);
  };

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
  };

  // Hệ thống Phím tắt Bàn phím Công thái học (Keyboard Shortcuts cho Giảng dạy & Thực hành)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Khóa phím F12 (DevTools / Console)
      const k = (e.key || '').toLowerCase();
      const c = e.code || '';
      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.keyCode === 123 || k === 'f12' || c === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 2. Khóa các tổ hợp phím xem nguồn, tải trang web, in ấn, hoặc mở công cụ kiểm tra
      if (isCtrl) {
        if (
          k === 'u' || c === 'KeyU' || // Xem mã nguồn (View Source)
          k === 's' || c === 'KeyS' || // Tải / Lưu trang web về máy (Save Page)
          k === 'p' || c === 'KeyP' || // In ấn / Xuất file PDF (Print Page)
          k === 'a' || c === 'KeyA' || // Bôi đen toàn trang (Select All)
          (e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || c === 'KeyI' || c === 'KeyJ' || c === 'KeyC' || c === 'KeyS'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 3. Khóa phím tắt MacOS: Cmd + Option + I/J/C/U
      if (e.metaKey && e.altKey) {
        if (k === 'i' || k === 'j' || k === 'c' || k === 'u' || c === 'KeyI' || c === 'KeyJ' || c === 'KeyC' || c === 'KeyU') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Bắt phím F11 ngay cả khi không có modifier để đồng bộ với HTML5 Fullscreen API
      if (e.key === 'F11' || e.code === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          if (laser.isVisible !== false) {
            const nextPower = !laser.isOn;
            labAudio.playSwitch(nextPower);
            labAudio.updateLaserHum(nextPower, laser.intensity);
            setLaser((prev) => ({ ...prev, isOn: nextPower }));
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          setLaser((prev) => {
            const currentA = Math.round(prev.alpha);
            const newAlpha = Math.max(30, currentA - step);
            return { ...prev, alpha: newAlpha };
          });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          setLaser((prev) => {
            const currentA = Math.round(prev.alpha);
            const newAlpha = Math.min(150, currentA + step);
            return { ...prev, alpha: newAlpha };
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const step = e.shiftKey ? 0.1 : 0.05;
          setLaser((prev) => {
            const newIntensity = Math.min(1.0, Math.round((prev.intensity + step) * 100) / 100);
            if (prev.isOn && prev.isVisible !== false) {
              labAudio.updateLaserHum(true, newIntensity);
            }
            return { ...prev, intensity: newIntensity };
          });
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const step = e.shiftKey ? 0.1 : 0.05;
          setLaser((prev) => {
            const newIntensity = Math.max(0.2, Math.round((prev.intensity - step) * 100) / 100);
            if (prev.isOn && prev.isVisible !== false) {
              labAudio.updateLaserHum(true, newIntensity);
            }
            return { ...prev, intensity: newIntensity };
          });
          break;
        }
        case 'KeyB': {
          e.preventDefault();
          handleToggleBox();
          break;
        }
        case 'KeyL': {
          e.preventDefault();
          labAudio.playClick();
          setLaser((prev) => {
            const nextVis = prev.isVisible === false;
            if (!nextVis) {
              labAudio.updateLaserHum(false, prev.intensity);
              return { ...prev, isVisible: false, isOn: false };
            } else {
              return { ...prev, isVisible: true, isOn: false };
            }
          });
          break;
        }
        case 'KeyM': {
          e.preventDefault();
          labAudio.playClick();
          setInteractionMode((prev) => (prev === 'orbit' ? 'pan' : 'orbit'));
          break;
        }
        case 'KeyR': {
          e.preventDefault();
          handleResetView();
          break;
        }
        case 'Digit1':
        case 'Numpad1': {
          e.preventDefault();
          labAudio.playClick();
          handleSelectCameraPreset('isometric');
          break;
        }
        case 'Digit2':
        case 'Numpad2': {
          e.preventDefault();
          labAudio.playClick();
          handleSelectCameraPreset('top');
          break;
        }
        case 'Digit3':
        case 'Numpad3': {
          e.preventDefault();
          labAudio.playClick();
          handleSelectCameraPreset('front');
          break;
        }
        case 'Digit4':
        case 'Numpad4': {
          e.preventDefault();
          labAudio.playClick();
          handleSelectCameraPreset('side');
          break;
        }
        default: {
          // Bổ sung dự phòng kiểm tra e.key để hỗ trợ mọi cấu hình bàn phím Numpad / Layout quốc tế
          if (e.key === '1') {
            e.preventDefault();
            labAudio.playClick();
            handleSelectCameraPreset('isometric');
          } else if (e.key === '2') {
            e.preventDefault();
            labAudio.playClick();
            handleSelectCameraPreset('top');
          } else if (e.key === '3') {
            e.preventDefault();
            labAudio.playClick();
            handleSelectCameraPreset('front');
          } else if (e.key === '4') {
            e.preventDefault();
            labAudio.playClick();
            handleSelectCameraPreset('side');
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [laser.isVisible, laser.isOn, laser.intensity]);

  // Tự động tạm dừng âm thanh máy phát laser khi ẩn tab trình duyệt và tiếp tục khi quay lại
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        labAudio.updateLaserHum(false, laser.intensity);
      } else if (laser.isOn && laser.isVisible !== false) {
        labAudio.updateLaserHum(true, laser.intensity);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [laser.isOn, laser.isVisible, laser.intensity]);

  // Hệ thống Bảo Mật Lớp 2: Chặn menu ngữ cảnh chuột phải và kéo thả tài nguyên
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, []);

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-slate-100 flex flex-col font-sans select-none overscroll-none">
      {/* Màn hình Loading tối giản, hiện đại và tinh tế */}
      {!is3DReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/95 backdrop-blur-xs pointer-events-none transition-opacity duration-300">
          <div className="w-9 h-9 rounded-full border-[3px] border-slate-200 border-t-sky-600 animate-spin mb-3.5" />
          <span className="text-[15px] font-semibold text-slate-700 tracking-tight">
            Đang tải...
          </span>
        </div>
      )}


      {/* 1. Header Navigation Bar (Phép chiếu song song kỹ thuật) */}
      <LabHeader
        cameraPreset={cameraPreset}
        interactionMode={interactionMode}
        isFullscreen={isFullscreen}
        onSelectCameraPreset={handleSelectCameraPreset}
        onSelectInteractionMode={setInteractionMode}
        onResetView={handleResetView}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* 2. Main 3D Simulation Viewport (True Parallel Projection) */}
      <main className="absolute inset-0 w-full h-full">
        <LabCanvas3D
          resetTrigger={resetKey}
          specimenId={selectedSpecimen}
          laser={laser}
          cameraPreset={cameraPreset}
          interactionMode={interactionMode}
          isBoxVisible={isBoxVisible}
          onReady={() => setIs3DReady(true)}
          onUpdateLaser={handleUpdateLaser}
        />
      </main>

      {/* 3. Collapsible Laboratory Workbench Dock (Bottom-Pinned) */}
      <LabControlDock
        laser={laser}
        selectedSpecimen={selectedSpecimen}
        isBoxVisible={isBoxVisible}
        onToggleBox={handleToggleBox}
        onUpdateLaser={handleUpdateLaser}
        onSelectSpecimen={(id) => setSelectedSpecimen(id)}
      />
    </div>
  );
}
