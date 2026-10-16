/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { labAudio } from '../utils/audio';
import { CameraPreset, InteractionMode } from '../types/lab';
import { LabTooltip } from './LabTooltip';
import {
  RotateCcw,
  Sparkles,
  Orbit,
  Move,
  ChevronDown,
  ChevronUp,
  Eye,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';
import { LabHelpModal } from './LabHelpModal';

interface Props {
  cameraPreset: CameraPreset;
  interactionMode: InteractionMode;
  isFullscreen?: boolean;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onSelectInteractionMode: (mode: InteractionMode) => void;
  onResetView: () => void;
  onToggleFullscreen?: () => void;
}

const CAMERA_PRESETS: { id: CameraPreset; label: string; shortcut: string }[] = [
  { id: 'isometric', label: 'Mặc định', shortcut: '(1)' },
  { id: 'top', label: 'Chiếu bằng', shortcut: '(2)' },
  { id: 'front', label: 'Chiếu đứng', shortcut: '(3)' },
  { id: 'side', label: 'Chiếu cạnh', shortcut: '(4)' },
];

export const LabHeader: React.FC<Props> = ({
  cameraPreset,
  interactionMode,
  isFullscreen: controlledFullscreen,
  onSelectCameraPreset,
  onSelectInteractionMode,
  onResetView,
  onToggleFullscreen,
}) => {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = controlledFullscreen ?? internalFullscreen;
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Theo dõi trạng thái Toàn màn hình (Fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setInternalFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      labAudio.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Tự động khôi phục thanh điều hướng khi mở rộng màn hình lên desktop (>= 768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileNavCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Đóng dropdown khi click bên ngoài hoặc bấm Escape; trên mobile (<768px) tự động ẩn thanh điều hướng nổi khi bấm ra ngoài
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // 1. Đóng dropdown Góc nhìn khi click ra ngoài dropdown
      if (
        isViewMenuOpen &&
        viewMenuRef.current &&
        !viewMenuRef.current.contains(target)
      ) {
        setIsViewMenuOpen(false);
      }

      // 2. Trên màn hình nhỏ (<768px): Tự động ẩn thanh điều hướng nổi khi bấm ra bên ngoài
      if (
        !isMobileNavCollapsed &&
        window.innerWidth < 768 &&
        mobileNavRef.current &&
        !mobileNavRef.current.contains(target)
      ) {
        setIsViewMenuOpen(false);
        setIsMobileNavCollapsed(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        labAudio.playClick();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === 'Escape') {
        if (isHelpOpen) {
          setIsHelpOpen(false);
        } else if (isViewMenuOpen) {
          setIsViewMenuOpen(false);
        } else if (window.innerWidth < 768 && !isMobileNavCollapsed && !document.fullscreenElement) {
          setIsMobileNavCollapsed(true);
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewMenuOpen, isMobileNavCollapsed]);

  const currentPresetObj = CAMERA_PRESETS.find((p) => p.id === cameraPreset);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-6 py-2 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs pointer-events-auto">
      {/* 1. Left: Tiêu đề mô hình thí nghiệm căn giữa theo chiều dọc với logo */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-transparent flex items-center justify-center text-white shadow-xs shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-5 h-5 object-contain" />
        </div>
        <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap leading-none">
          MÔ HÌNH THÍ NGHIỆM
        </h1>
      </div>

      {/* Nút Hiện thanh điều hướng: CHỈ HIỂN THỊ TRÊN MÀN HÌNH NHỎ (<768px) KHI THANH ĐANG ẨN */}
      {isMobileNavCollapsed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            labAudio.playClick();
            setIsMobileNavCollapsed(false);
          }}
          className="md:hidden fixed top-12.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/95 hover:bg-slate-900 text-white rounded-full shadow-lg border border-slate-700/60 text-[11px] font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 pointer-events-auto"
        >
          <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
          <span>Hiện thanh điều hướng</span>
        </button>
      )}

      {/* 2. Center: Vùng hợp nhất 3 nút điều hướng (Tự động căn giữa header trên máy tính/tablet, và nổi gọn gàng trên điện thoại) */}
      <div
        ref={mobileNavRef}
        className={`${
          isMobileNavCollapsed ? 'hidden md:flex' : 'flex'
        } fixed top-12.5 md:top-1/2 md:absolute left-1/2 -translate-x-1/2 md:-translate-y-1/2 z-30 flex-col md:flex-row items-center pointer-events-auto select-none`}
      >
        <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-slate-100/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-2xs max-w-[calc(100vw-1rem)]">
        {/* Nút 1: Góc nhìn (Icon con mắt + Tên góc nhìn căn trái, Chevron bên phải) */}
        <div ref={viewMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              labAudio.playClick();
              setIsViewMenuOpen((prev) => !prev);
            }}
            className={`w-28 sm:w-36 h-7.5 flex items-center justify-between px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isViewMenuOpen
                ? 'bg-white text-sky-900 border-sky-300 shadow-2xs ring-1 ring-sky-100'
                : 'bg-white/80 hover:bg-white text-slate-700 border-slate-200/80 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <Eye
                className={`w-3.5 h-3.5 shrink-0 ${
                  isViewMenuOpen ? 'text-sky-600' : 'text-slate-500'
                }`}
              />
              <span className="font-semibold text-slate-900 text-xs truncate block max-w-[58px] sm:max-w-[84px] text-left">
                {currentPresetObj?.label || 'Mặc định'}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
                isViewMenuOpen ? 'rotate-180 text-sky-600' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown Xổ Xuống (Hiển thị phím tắt số tương ứng) */}
          {isViewMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full left-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50 pointer-events-auto"
            >
              <div className="flex flex-col gap-0.5">
                {CAMERA_PRESETS.map((item) => {
                  const isActive = cameraPreset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        labAudio.playClick();
                        onSelectCameraPreset(item.id);
                        setIsViewMenuOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 text-sky-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold leading-none shrink-0 ml-1.5">
                        {item.shortcut}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Đường chia mỏng thanh nhã */}
        <div className="w-[1px] h-4 bg-slate-300/80 mx-0.5 shrink-0" />

        {/* Nút 2 & 3: Xoay 3D / Kéo khung hình (Phím M) */}
        <LabTooltip shortcut="(M)" position="bottom">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                labAudio.playClick();
                onSelectInteractionMode('orbit');
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 h-7.5 ${
                interactionMode === 'orbit'
                  ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Orbit
                className={`w-3.5 h-3.5 ${
                  interactionMode === 'orbit' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <span>Xoay 3D</span>
            </button>

            <button
              type="button"
              onClick={() => {
                labAudio.playClick();
                onSelectInteractionMode('pan');
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 h-7.5 ${
                interactionMode === 'pan'
                  ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Move
                className={`w-3.5 h-3.5 ${
                  interactionMode === 'pan' ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">Kéo khung hình</span>
              <span className="inline sm:hidden">Kéo hình</span>
            </button>
          </div>
        </LabTooltip>
        </div>

        {/* Nút Ẩn thanh điều hướng: CHỈ HIỂN THỊ TRÊN MÀN HÌNH NHỎ (<768px), TUYỆT ĐỐI ẨN TRÊN DESKTOP (md:hidden) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            labAudio.playClick();
            setIsViewMenuOpen(false);
            setIsMobileNavCollapsed(true);
          }}
          className="md:hidden flex items-center gap-1 px-2.5 py-0.5 bg-white/95 hover:bg-white text-slate-500 hover:text-slate-800 text-[10px] font-semibold rounded-full border border-slate-200/90 shadow-2xs mt-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          <ChevronUp className="w-3 h-3 text-slate-400" />
          <span>Ẩn thanh điều hướng</span>
        </button>
      </div>

      {/* 3. Right: Đặt lại góc nhìn (+ Quy ước TCVN/ISO trên màn hình rộng) */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">

        <LabTooltip shortcut="(R)" position="bottom">
          <button
            onClick={onResetView}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span className="hidden sm:inline">Đặt lại góc nhìn</span>
            <span className="inline sm:hidden">Đặt lại</span>
          </button>
        </LabTooltip>

        {/* Nút Toàn màn hình (Fullscreen) phục vụ Trình chiếu và Bảng tương tác */}
        <LabTooltip shortcut="(F11)" position="bottom">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="flex items-center justify-center w-8 h-8 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 shrink-0 text-sky-600" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            )}
          </button>
        </LabTooltip>

        {/* Nút Trợ năng & Hướng dẫn thao tác (?) */}
        <LabTooltip shortcut="(?)" position="bottom">
          <button
            type="button"
            onClick={() => {
              labAudio.playClick();
              setIsHelpOpen(true);
            }}
            className="flex items-center justify-center w-8 h-8 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0"
          >
            <HelpCircle className="w-4 h-4 text-slate-600" />
          </button>
        </LabTooltip>
      </div>

      {/* Cửa sổ Trợ năng & Thông tin liên hệ */}
      <LabHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </header>
  );
};
