/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SpecimenCategory = '2d' | '3d';

export type SpecimenId =
  // Nhóm Hình 2D (phẳng in trên kính nắp)
  | 't_2d'              // Hình chữ T
  | 'circle_2d'         // Hình tròn
  | 'trapezoid_2d'      // Hình thang
  | 'square_2d'         // Hình vuông
  | 'rectangle_2d'      // Hình chữ nhật
  | 'triangle_2d'       // Hình tam giác
  // Nhóm Hình 3D (khối nổi kỹ thuật)
  | 't_3d'              // Khối hình chữ T
  | 'cylinder_3d'       // Khối hình trụ
  | 'trapezoid_3d'      // Khối hình thang
  | 'cube_3d'           // Khối lập phương
  | 'cuboid_3d'         // Khối hộp chữ nhật
  | 'prism_3d';         // Khối lăng trụ tam giác


export interface LaserConfig {
  isOn: boolean;
  alpha: number; // Góc nghiêng theo vòng tròn lượng giác (30° đến 150°, 90° = chiếu thẳng đứng vuông góc)
  intensity: number; // 0.2 đến 1.0
  beamRadius: number; // bán kính chùm tia song song
  isVisible?: boolean; // Trạng thái ẩn/hiện thân đèn laser
}

export type CameraPreset = 'isometric' | 'top' | 'front' | 'side';

export type InteractionMode = 'orbit' | 'pan';
