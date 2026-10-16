/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { LaserConfig, SpecimenId } from '../types/lab';
import { labAudio } from '../utils/audio';
import {
  Power,
  Sun,
  Compass,
  ChevronDown,
  ChevronUp,
  Check,
  Shapes,
  Box,
  Flashlight,
  FlashlightOff,
} from 'lucide-react';
import { LabTooltip } from './LabTooltip';

interface Props {
  laser: LaserConfig;
  selectedSpecimen: SpecimenId;
  isBoxVisible?: boolean;
  onToggleBox?: () => void;
  onUpdateLaser: (partial: Partial<LaserConfig>) => void;
  onSelectSpecimen: (id: SpecimenId) => void;
}

interface SpecimenOption {
  id: SpecimenId;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

// Danh mục 6 hình 2D phẳng chuẩn kỹ thuật (không có mô tả phụ, chỉ để tên hình)
const SPECIMENS_2D: SpecimenOption[] = [
  {
    id: 't_2d',
    label: 'Chữ T',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 3h12v3.2h-4v6.8H6V6.2H2V3z"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: 'circle_2d',
    label: 'Hình tròn',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <circle
          cx="8"
          cy="8"
          r="5.5"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: 'trapezoid_2d',
    label: 'Hình thang',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <polygon
          points="5,3.8 11,3.8 14,12.2 2,12.2"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: 'square_2d',
    label: 'Hình vuông',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <rect
          x="3"
          y="3"
          width="10"
          height="10"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: 'rectangle_2d',
    label: 'Hình chữ nhật',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <rect
          x="2"
          y="4.5"
          width="12"
          height="7"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
  {
    id: 'triangle_2d',
    label: 'Tam giác',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <polygon
          points="8,3.5 14,12.5 2,12.5"
          className={active ? 'fill-sky-400/40 stroke-sky-300' : 'fill-slate-600/30 stroke-slate-400'}
          strokeWidth="1.2"
        />
      </svg>
    ),
  },
];

// Danh mục 6 hình 3D khối chuẩn kỹ thuật (đúng hình học không gian, có nét liền thấy và nét đứt khuất)
const SPECIMENS_3D: SpecimenOption[] = [
  {
    id: 't_3d',
    label: 'Khối T',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Mặt trên thanh ngang T */}
        <polygon
          points="2.5,5.5 5.5,2.5 15.5,2.5 12.5,5.5"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/50 stroke-slate-400'}
          strokeWidth="0.8"
        />
        {/* Mặt bên phải thanh ngang T */}
        <polygon
          points="12.5,5.5 15.5,2.5 15.5,5.5 12.5,8.5"
          className={active ? 'fill-cyan-300/30 stroke-cyan-200' : 'fill-slate-500/30 stroke-slate-400'}
          strokeWidth="0.8"
        />
        {/* Mặt bậc phải thanh đứng */}
        <polygon
          points="9.5,8.5 12.5,5.5 15.5,5.5 12.5,8.5"
          className={active ? 'fill-cyan-400/40 stroke-cyan-200' : 'fill-slate-600/40 stroke-slate-400'}
          strokeWidth="0.8"
        />
        {/* Mặt bên phải thân T */}
        <polygon
          points="9.5,8.5 12.5,5.5 12.5,10.5 9.5,13.5"
          className={active ? 'fill-cyan-500/40 stroke-cyan-300' : 'fill-slate-700/40 stroke-slate-500'}
          strokeWidth="0.8"
        />
        {/* Mặt trước chữ T */}
        <path
          d="M2.5 5.5h10v3h-3v5h-3.5v-5h-3.5v-3z"
          className={active ? 'fill-cyan-400/40 stroke-cyan-200' : 'fill-slate-600/40 stroke-slate-400'}
          strokeWidth="0.8"
        />
        {/* Nét khuất (đường nét đứt) đáy sau và thân sau */}
        <line
          x1="6"
          y1="13.5"
          x2="9"
          y2="10.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="9"
          y1="10.5"
          x2="12.5"
          y2="10.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="9"
          y1="10.5"
          x2="9"
          y2="5.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="5.5"
          y1="2.5"
          x2="5.5"
          y2="5.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="2.5"
          y1="8.5"
          x2="5.5"
          y2="5.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
      </svg>
    ),
  },
  {
    id: 'cylinder_3d',
    label: 'Khối hình trụ',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Thân trụ (màu nền mờ) */}
        <path
          d="M3 4.5v7a5 2 0 0 0 10 0v-7a5 2 0 0 1-10 0z"
          className={active ? 'fill-cyan-400/25' : 'fill-slate-600/20'}
        />
        {/* Nét khuất đáy dưới (vòng cung phía sau bị thân trụ che) */}
        <path
          d="M13 11.5a5 2 0 0 0-10 0"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        {/* Hai đường sinh (cạnh bao thân trụ) */}
        <line
          x1="3"
          y1="4.5"
          x2="3"
          y2="11.5"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="1"
        />
        <line
          x1="13"
          y1="4.5"
          x2="13"
          y2="11.5"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="1"
        />
        {/* Cung đáy trước nhìn thấy */}
        <path
          d="M3 11.5a5 2 0 0 0 10 0"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="1"
        />
        {/* Đáy trên nhìn thấy toàn bộ */}
        <ellipse
          cx="8"
          cy="4.5"
          rx="5"
          ry="2"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/40 stroke-slate-400'}
          strokeWidth="1"
        />
      </svg>
    ),
  },
  {
    id: 'trapezoid_3d',
    label: 'Khối hình thang',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Mặt trước hình thang */}
        <polygon
          points="2.5,7 13.5,7 13.5,13 2.5,13"
          className={active ? 'fill-cyan-500/30 stroke-cyan-300' : 'fill-slate-700/30 stroke-slate-500'}
          strokeWidth="0.9"
        />
        {/* Mặt trên hình thang */}
        <polygon
          points="5.5,2.5 10.5,2.5 13.5,7 2.5,7"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/40 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Cạnh thấy hai bên */}
        <line
          x1="2.5"
          y1="7"
          x2="2.5"
          y2="13"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="0.9"
        />
        <line
          x1="13.5"
          y1="7"
          x2="13.5"
          y2="13"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Các cạnh khuất (nét đứt) của khối hình thang */}
        <line
          x1="5.5"
          y1="2.5"
          x2="5.5"
          y2="8.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="10.5"
          y1="2.5"
          x2="10.5"
          y2="8.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="5.5"
          y1="8.5"
          x2="10.5"
          y2="8.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="2.5"
          y1="13"
          x2="5.5"
          y2="8.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
        <line
          x1="13.5"
          y1="13"
          x2="10.5"
          y2="8.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.8"
          strokeDasharray="1.5 1"
        />
      </svg>
    ),
  },
  {
    id: 'cube_3d',
    label: 'Khối lập phương',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Nét khuất phía trong (3 cạnh nét đứt gặp nhau ở góc sau) */}
        <line
          x1="6.5"
          y1="2.5"
          x2="6.5"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="6.5"
          y1="9.5"
          x2="13.5"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="2.5"
          y1="13.5"
          x2="6.5"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        {/* Mặt trên */}
        <polygon
          points="2.5,6.5 6.5,2.5 13.5,2.5 9.5,6.5"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/50 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Mặt bên phải */}
        <polygon
          points="9.5,6.5 13.5,2.5 13.5,9.5 9.5,13.5"
          className={active ? 'fill-cyan-300/30 stroke-cyan-200' : 'fill-slate-500/30 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Mặt trước */}
        <polygon
          points="2.5,6.5 9.5,6.5 9.5,13.5 2.5,13.5"
          className={active ? 'fill-cyan-500/40 stroke-cyan-300' : 'fill-slate-700/40 stroke-slate-500'}
          strokeWidth="0.9"
        />
      </svg>
    ),
  },
  {
    id: 'cuboid_3d',
    label: 'Khối hộp chữ nhật',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Nét khuất phía trong (3 cạnh nét đứt gặp nhau ở góc sau) */}
        <line
          x1="5.5"
          y1="3.5"
          x2="5.5"
          y2="9"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="5.5"
          y1="9"
          x2="14"
          y2="9"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="2"
          y1="13.5"
          x2="5.5"
          y2="9"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        {/* Mặt trên */}
        <polygon
          points="2,8 5.5,3.5 14,3.5 10.5,8"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/50 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Mặt bên phải */}
        <polygon
          points="10.5,8 14,3.5 14,9 10.5,13.5"
          className={active ? 'fill-cyan-300/30 stroke-cyan-200' : 'fill-slate-500/30 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Mặt trước */}
        <polygon
          points="2,8 10.5,8 10.5,13.5 2,13.5"
          className={active ? 'fill-cyan-500/40 stroke-cyan-300' : 'fill-slate-700/40 stroke-slate-500'}
          strokeWidth="0.9"
        />
      </svg>
    ),
  },
  {
    id: 'prism_3d',
    label: 'Khối lăng trụ tam giác',
    icon: (active) => (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        {/* Nét khuất phía trong (3 cạnh nét đứt của lăng trụ tam giác) */}
        <line
          x1="8"
          y1="3"
          x2="8"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="3"
          y1="13"
          x2="8"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        <line
          x1="13"
          y1="13"
          x2="8"
          y2="9.5"
          className={active ? 'stroke-cyan-300' : 'stroke-slate-400'}
          strokeWidth="0.9"
          strokeDasharray="1.5 1"
        />
        {/* Mặt trước lăng trụ */}
        <polygon
          points="3,6.5 13,6.5 13,13 3,13"
          className={active ? 'fill-cyan-500/40 stroke-cyan-300' : 'fill-slate-700/40 stroke-slate-500'}
          strokeWidth="0.9"
        />
        {/* Mặt đáy tam giác trên */}
        <polygon
          points="8,3 13,6.5 3,6.5"
          className={active ? 'fill-cyan-400/50 stroke-cyan-200' : 'fill-slate-600/50 stroke-slate-400'}
          strokeWidth="0.9"
        />
        {/* Cạnh bên trái và phải */}
        <line
          x1="3"
          y1="6.5"
          x2="3"
          y2="13"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="0.9"
        />
        <line
          x1="13"
          y1="6.5"
          x2="13"
          y2="13"
          className={active ? 'stroke-cyan-200' : 'stroke-slate-400'}
          strokeWidth="0.9"
        />
      </svg>
    ),
  },
];

export const LabControlDock: React.FC<Props> = ({
  laser,
  selectedSpecimen,
  isBoxVisible = true,
  onToggleBox,
  onUpdateLaser,
  onSelectSpecimen,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<'2d' | '3d' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSnapAngleRef = useRef<number | null>(null);

  const handleAngleChange = (newAngle: number) => {
    onUpdateLaser({ alpha: newAngle });

    // Khấc rung phản hồi xúc giác (Haptic) & âm thanh cơ học tinh tế khi chạm mốc góc chuẩn
    const SNAP_ANGLES = [30, 45, 60, 90, 120, 135, 150];
    if (SNAP_ANGLES.includes(newAngle)) {
      if (lastSnapAngleRef.current !== newAngle) {
        lastSnapAngleRef.current = newAngle;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(8);
          } catch (_) {}
        }
        labAudio.playClick();
      }
    } else {
      lastSnapAngleRef.current = null;
    }
  };

  // Lắng nghe sự kiện click ra ngoài khi bảng đang mở để tự động ẩn bảng điều khiển
  useEffect(() => {
    if (isCollapsed) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
        setIsCollapsed(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openMenu) {
          setOpenMenu(null);
        } else if (!document.fullscreenElement) {
          setIsCollapsed(true);
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCollapsed, openMenu]);

  const isLampVisible = laser.isVisible !== false;

  const handleToggleLampVisibility = () => {
    labAudio.playClick();
    if (isLampVisible) {
      // Khi đèn pin ẩn -> ánh sáng đèn tự động tắt ngay, âm thanh hum dừng
      labAudio.updateLaserHum(false, laser.intensity);
      onUpdateLaser({ isVisible: false, isOn: false });
    } else {
      // Khi hiện lại đèn pin -> chỉ hiện thân đèn, đèn vẫn ở trạng thái tắt cho đến khi người dùng bấm BẬT
      onUpdateLaser({ isVisible: true });
    }
  };

  const handleTogglePower = () => {
    if (!isLampVisible) return; // Vô hiệu hoá hoàn toàn khi đèn pin đang ẩn
    const newState = !laser.isOn;
    labAudio.playSwitch(newState);
    labAudio.updateLaserHum(newState, laser.intensity);
    onUpdateLaser({ isOn: newState });
  };

  const handleSelect = (id: SpecimenId) => {
    labAudio.playClick();
    onSelectSpecimen(id);
    setOpenMenu(null);
  };

  // Xác định vật mẫu hiện tại đang thuộc nhóm nào
  const current2D = SPECIMENS_2D.find((s) => s.id === selectedSpecimen);
  const current3D = SPECIMENS_3D.find((s) => s.id === selectedSpecimen);
  const is2DSelected = Boolean(current2D);
  const is3DSelected = Boolean(current3D);

  // Khi đang ẩn bảng điều khiển: Hiển thị nút bấm gọn gàng ở góc dưới để mở lại
  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          labAudio.playClick();
          setIsCollapsed(false);
        }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-slate-900/95 hover:bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700/60 text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 pointer-events-auto"
      >
        <ChevronUp className="w-4 h-4 text-sky-400" />
        <span>Hiện bảng điều khiển</span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto overflow-visible select-none w-[calc(100vw-1.25rem)] max-w-fit lg:w-auto"
    >
      {/* Nút Ẩn bảng điều khiển tinh tế trên mép dock */}
      <button
        type="button"
        onClick={() => {
          labAudio.playClick();
          setOpenMenu(null);
          setIsCollapsed(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-[11px] font-semibold rounded-full border border-slate-200/90 shadow-2xs mb-1.5 cursor-pointer transition-all hover:scale-105"
      >
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        <span>Ẩn bảng điều khiển</span>
      </button>

      {/* Main Control Dock: Co giãn thông minh trên điện thoại / máy tính bảng và trải dài ngang chuẩn mực trên màn hình lớn */}
      <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-2xl rounded-2xl p-2 sm:p-2.5 transition-all relative overflow-visible w-full lg:w-auto">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-2.5 py-0.5 overflow-visible">
          {/* Nhóm 1: Nguồn Laser + Góc chiếu + Độ sáng đèn */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 overflow-visible">
            {/* Nút Ẩn/Hiện Đèn pin (Icon tròn hiện đại, tinh tế) */}
            <LabTooltip shortcut="(L)" position="top">
              <button
                type="button"
                onClick={handleToggleLampVisibility}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs border ${
                  isLampVisible
                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-600 border-sky-200 ring-2 ring-sky-100/80 hover:scale-105 active:scale-95'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-300/80 hover:scale-105 active:scale-95'
                }`}
              >
                {isLampVisible ? (
                  <Flashlight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-sky-600" />
                ) : (
                  <FlashlightOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-400" />
                )}
              </button>
            </LabTooltip>

            {/* Nút Ẩn/Hiện Khung Hình Hộp chứa vật mẫu (Icon tròn hiện đại, tinh tế) */}
            <LabTooltip shortcut="(B)" position="top">
              <button
                type="button"
                onClick={() => {
                  if (onToggleBox) {
                    onToggleBox();
                  }
                }}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs border ${
                  isBoxVisible
                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-600 border-sky-200 ring-2 ring-sky-100/80 hover:scale-105 active:scale-95'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-300/80 hover:scale-105 active:scale-95'
                }`}
              >
                {isBoxVisible ? (
                  <Box className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-sky-600" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <Box className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-400" />
                    <div className="absolute w-5 h-0.5 bg-slate-400 rotate-45 rounded-full" />
                  </div>
                )}
              </button>
            </LabTooltip>

            {/* Ô 1: Nguồn Laser (Kích thước co giãn linh hoạt, tự động vô hiệu hóa và làm mờ khi đèn pin bị ẩn) */}
            <LabTooltip shortcut="(Space)" position="top">
              <button
                type="button"
                disabled={!isLampVisible}
                onClick={handleTogglePower}
                className={`w-13 sm:w-16 lg:w-[72px] h-9 sm:h-10 flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 ${
                  !isLampVisible
                    ? 'bg-slate-200/90 text-slate-400 border border-slate-300/60 opacity-40 cursor-not-allowed pointer-events-none'
                    : laser.isOn
                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200 cursor-pointer active:scale-95'
                    : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
                }`}
              >
                <Power className="w-3.5 h-3.5 shrink-0" />
                <span className="tracking-wide text-[10px] sm:text-xs">{laser.isOn ? 'BẬT' : 'TẮT'}</span>
              </button>
            </LabTooltip>

            {/* Ô 2: Góc chiếu (Tự co giãn trên điện thoại, cố định trên màn hình rộng) */}
            <LabTooltip shortcut="(←|→)" position="top" className="flex-1 sm:w-44 lg:w-44">
              <div className="w-full h-10 flex flex-col justify-center gap-1 shrink-0 bg-slate-50/80 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200/70 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 flex items-center gap-1 truncate">
                    <Compass className="w-3 h-3 text-sky-600 shrink-0" />
                    <span className="truncate">Góc chiếu</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 leading-tight shrink-0">
                    {Math.round(laser.alpha)}°
                  </span>
                </div>

                {/* Thanh trượt góc chiếu trơn tru với bước nhảy 1 độ (30, 31, 32...) */}
                <input
                  type="range"
                  min="30"
                  max="150"
                  step="1"
                  value={Math.round(laser.alpha)}
                  onChange={(e) =>
                    handleAngleChange(parseInt(e.target.value, 10))
                  }
                  onMouseUp={(e) => (e.target as HTMLElement).blur()}
                  onTouchEnd={(e) => (e.target as HTMLElement).blur()}
                  onKeyUp={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      (e.target as HTMLElement).blur();
                    }
                  }}
                  className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </LabTooltip>

            {/* Ô 3: Độ sáng đèn (Tự co giãn trên điện thoại, cố định trên màn hình rộng) */}
            <LabTooltip shortcut="(↑|↓)" position="top" className="flex-1 sm:w-40 lg:w-40">
              <div className="w-full h-10 flex flex-col justify-center gap-1 shrink-0 bg-slate-50/80 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200/70 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 flex items-center gap-1 truncate">
                    <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">Độ sáng đèn</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded leading-tight shrink-0">
                    {(laser.intensity * 100).toFixed(0)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={laser.intensity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    labAudio.updateLaserHum(laser.isOn && laser.isVisible !== false, val);
                    onUpdateLaser({ intensity: val });
                  }}
                  onMouseUp={(e) => (e.target as HTMLElement).blur()}
                  onTouchEnd={(e) => (e.target as HTMLElement).blur()}
                  onKeyUp={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      (e.target as HTMLElement).blur();
                    }
                  }}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </LabTooltip>
          </div>

          {/* Nhóm 2: Dropdowns Hình 2D & Hình 3D */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 overflow-visible">
            {/* Ô 4: Dropdown Hình 2D */}
            <div className={`relative flex-1 lg:flex-initial lg:w-36 shrink-0 overflow-visible ${openMenu === '2d' ? 'z-50' : 'z-20'}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  labAudio.playClick();
                  setOpenMenu((prev) => (prev === '2d' ? null : '2d'));
                }}
                className={`w-full lg:w-36 h-10 shrink-0 flex items-center justify-between px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  is2DSelected || openMenu === '2d'
                    ? 'bg-sky-50 text-sky-900 border-sky-300 ring-2 ring-sky-100 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <Shapes
                    className={`w-3.5 h-3.5 shrink-0 ${
                      is2DSelected || openMenu === '2d' ? 'text-sky-600' : 'text-slate-400'
                    }`}
                  />
                  <div className="flex flex-col text-left leading-tight min-w-0 overflow-hidden">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                      Hình 2D
                    </span>
                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[80px] sm:max-w-[78px] block">
                      {is2DSelected ? current2D?.label : 'Chọn hình'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                    openMenu === '2d' ? 'rotate-180 text-sky-600' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Popover Menu Xổ Lên (Hình 2D - Hiển thị sắc nét, không bị che khuất) */}
              {openMenu === '2d' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full mb-2 sm:mb-3 left-0 lg:left-auto lg:right-0 w-60 max-w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 pointer-events-auto"
                  style={{ minWidth: '220px' }}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Hình 2D
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {SPECIMENS_2D.map((item) => {
                      const active = selectedSpecimen === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.id);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-sky-600 text-white font-semibold shadow-xs'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.icon(active)}
                            <span className="truncate leading-tight font-medium">
                              {item.label}
                            </span>
                          </div>
                          {active && (
                            <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Ô 5: Dropdown Hình 3D (Kích thước tự co giãn linh hoạt) */}
            <div className={`relative flex-1 lg:flex-initial lg:w-38 shrink-0 overflow-visible ${openMenu === '3d' ? 'z-50' : 'z-20'}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  labAudio.playClick();
                  setOpenMenu((prev) => (prev === '3d' ? null : '3d'));
                }}
                className={`w-full lg:w-38 h-10 shrink-0 flex items-center justify-between px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  is3DSelected || openMenu === '3d'
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-2 ring-indigo-100 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <Box
                    className={`w-3.5 h-3.5 shrink-0 ${
                      is3DSelected || openMenu === '3d' ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  <div className="flex flex-col text-left leading-tight min-w-0 overflow-hidden">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                      Hình 3D
                    </span>
                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[85px] block">
                      {is3DSelected ? current3D?.label : 'Chọn khối'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                    openMenu === '3d' ? 'rotate-180 text-indigo-600' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Popover Menu Xổ Lên (Hình 3D - Hiển thị sắc nét, không bị che khuất) */}
              {openMenu === '3d' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full mb-2 sm:mb-3 right-0 w-60 max-w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 pointer-events-auto"
                  style={{ minWidth: '220px' }}
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Hình 3D
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {SPECIMENS_3D.map((item) => {
                      const active = selectedSpecimen === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.id);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.icon(active)}
                            <span className="truncate leading-tight font-medium">
                              {item.label}
                            </span>
                          </div>
                          {active && (
                            <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
