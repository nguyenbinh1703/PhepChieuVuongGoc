/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Mail } from 'lucide-react';
import { labAudio } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LabHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEmailHovered, setIsEmailHovered] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleCopyGmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    labAudio.playClick();
    navigator.clipboard.writeText('nguyentrongbinh309@gmail.com').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs select-none pointer-events-auto transition-opacity duration-200"
    >
      {/* Modal Dialog Card: Căn chính giữa viewport, co giãn đa màn hình, thanh cuộn ẩn khi màn hình quá nhỏ */}
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="relative w-[calc(100vw-1.5rem)] max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-auto no-scrollbar bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl rounded-2xl p-4 sm:p-5 transition-all text-slate-800"
      >
        {/* Nút đóng X ở góc trên bên phải */}
        <button
          type="button"
          onClick={() => {
            labAudio.playClick();
            onClose();
          }}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* PHẦN 1: ÁP DỤNG TRÊN MÀN HÌNH CẢM ỨNG */}
        <div>
          <h2 className="text-center font-bold text-xs sm:text-[13px] tracking-wide text-slate-900 uppercase mb-2.5">
            ÁP DỤNG TRÊN MÀN HÌNH CẢM ỨNG
          </h2>
          <ul className="space-y-2.5 text-left text-xs sm:text-[13px] text-slate-700">
            <li className="flex items-start gap-2 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5" />
              <span>
                <strong className="font-semibold text-slate-800">Chạm 1 ngón tay &amp; vuốt:</strong> Xoay 3D
              </span>
            </li>
            <li className="flex items-start gap-2 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5" />
              <span>
                <strong className="font-semibold text-slate-800">Chạm 2 ngón tay &amp; kéo:</strong> Kéo khung hình
              </span>
            </li>
            <li className="flex items-start gap-2 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5" />
              <span>
                <strong className="font-semibold text-slate-800">Chụm hoặc mở 2 ngón tay:</strong> Phóng to hoặc thu nhỏ
              </span>
            </li>
            <li className="flex items-start gap-2 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5" />
              <span>
                <strong className="font-semibold text-slate-800">Chạm vào thanh trượt:</strong> Thay đổi góc chiếu và độ sáng
              </span>
            </li>
          </ul>
        </div>

        {/* Khoảng cách giữa các phần chuẩn xác = 2x khoảng cách dòng (10px trên + 10px dưới qua vạch kẻ) */}
        <div className="w-full h-px bg-slate-200/80 my-2.5" />

        {/* PHẦN 2: THÔNG TIN LIÊN HỆ */}
        <div>
          <h2 className="text-center font-bold text-xs sm:text-[13px] tracking-wide text-slate-900 uppercase mb-2.5">
            THÔNG TIN LIÊN HỆ
          </h2>

          {/* 2 dòng căn đều trái, khoảng cách dòng 10px đồng nhất */}
          <div className="space-y-2.5 text-xs sm:text-[13px] text-left">
            {/* Dòng 1: Tác giả */}
            <div className="flex items-center gap-2.5">
              <div className="w-5.5 h-5.5 rounded-full bg-sky-50 border border-sky-200/80 flex items-center justify-center shadow-2xs shrink-0">
                <User className="w-3 h-3 text-sky-600" />
              </div>
              <span className="font-semibold text-slate-800 leading-snug">
                Nguyễn Trọng Bình
              </span>
            </div>

            {/* Dòng 2: Gmail */}
            <div className="flex items-center gap-2.5">
              <div className="w-5.5 h-5.5 rounded-full bg-rose-50 border border-rose-200/80 flex items-center justify-center shadow-2xs shrink-0">
                <Mail className="w-3 h-3 text-rose-600" />
              </div>
              <div className="relative inline-flex items-center min-w-0">
                <button
                  type="button"
                  onClick={handleCopyGmail}
                  onMouseEnter={() => setIsEmailHovered(true)}
                  onMouseLeave={() => setIsEmailHovered(false)}
                  className="font-medium text-slate-800 hover:text-sky-600 transition-colors cursor-pointer text-left focus:outline-hidden leading-snug truncate"
                >
                  nguyentrongbinh309@gmail.com
                </button>

                {/* Tooltip tùy chỉnh: "Sao chép" / "Đã sao chép" */}
                {isEmailHovered && (
                  <div className="absolute bottom-full left-0 mb-1.5 z-60 pointer-events-none select-none transition-all duration-150 ease-out">
                    <div className="relative px-2 py-0.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-md shadow-lg shadow-black/25 whitespace-nowrap flex items-center justify-center">
                      <span className="text-[11px] font-medium text-sky-300 tracking-wide leading-none">
                        {copied ? 'Đã sao chép' : 'Sao chép'}
                      </span>
                      <div className="absolute left-4 -bottom-1 w-1.5 h-1.5 bg-slate-900 border-b border-r border-slate-700/80 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
