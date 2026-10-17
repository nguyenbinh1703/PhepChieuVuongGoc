/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class LabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Lỗi không xác định' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lab 3D ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-50 p-4 font-sans select-none">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 flex flex-col items-center text-center">
            {/* Warning Icon Halo */}
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 mb-4 shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-2">
              Mô hình thí nghiệm gặp sự cố
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Không thể khởi tạo hoặc tiếp tục thí nghiệm. Điều này thường xảy ra khi card đồ họa (GPU) bị tạm dừng, hoặc trình duyệt chưa bật{' '}
              <strong className="text-slate-800">Tăng tốc phần cứng (Hardware Acceleration)</strong>.
            </p>

            <div className="w-full bg-slate-50 rounded-xl p-3 mb-5 text-left border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Chi tiết chẩn đoán
              </div>
              <div className="text-xs font-mono text-slate-700 truncate">
                {this.state.errorMessage}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Về mặc định
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-98 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
