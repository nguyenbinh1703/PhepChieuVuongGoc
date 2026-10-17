/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SpecimenId, LaserConfig, CameraPreset, InteractionMode } from '../types/lab';

interface Props {
  specimenId: SpecimenId;
  laser: LaserConfig;
  cameraPreset?: CameraPreset;
  interactionMode?: InteractionMode;
  isBoxVisible?: boolean;
  resetTrigger?: number;
  onReady?: () => void;
  onUpdateLaser: (partial: Partial<LaserConfig>) => void;
}

interface Point2D {
  x: number;
  y: number;
}

const MAX_HULL_POINTS = 32;
const _hullPtsPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullSortedPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullLowerPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullUpperPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));
const _hullResultPool: Point2D[] = Array.from({ length: MAX_HULL_POINTS }, () => ({ x: 0, y: 0 }));

const crossProduct = (o: Point2D, a: Point2D, b: Point2D): number => {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

// Thuật toán Convex Hull Andrew's Monotone Chain - Zero Allocation (tái sử dụng pool tĩnh 100%)
const computeConvexHullInPlace = (pts: Point2D[], count: number): { hull: Point2D[]; size: number } => {
  if (count <= 2) {
    return { hull: pts, size: count };
  }

  for (let i = 0; i < count; i++) {
    _hullSortedPool[i].x = pts[i].x;
    _hullSortedPool[i].y = pts[i].y;
  }

  // Insertion sort cho N <= 16: Siêu nhanh, không tạo mảng rác (zero GC)
  for (let i = 1; i < count; i++) {
    const px = _hullSortedPool[i].x;
    const py = _hullSortedPool[i].y;
    let j = i - 1;
    while (j >= 0 && (_hullSortedPool[j].x > px || (_hullSortedPool[j].x === px && _hullSortedPool[j].y > py))) {
      _hullSortedPool[j + 1].x = _hullSortedPool[j].x;
      _hullSortedPool[j + 1].y = _hullSortedPool[j].y;
      j--;
    }
    _hullSortedPool[j + 1].x = px;
    _hullSortedPool[j + 1].y = py;
  }

  let lowerCount = 0;
  for (let i = 0; i < count; i++) {
    const pt = _hullSortedPool[i];
    while (lowerCount >= 2 && crossProduct(_hullLowerPool[lowerCount - 2], _hullLowerPool[lowerCount - 1], pt) <= 0) {
      lowerCount--;
    }
    _hullLowerPool[lowerCount].x = pt.x;
    _hullLowerPool[lowerCount].y = pt.y;
    lowerCount++;
  }

  let upperCount = 0;
  for (let i = count - 1; i >= 0; i--) {
    const pt = _hullSortedPool[i];
    while (upperCount >= 2 && crossProduct(_hullUpperPool[upperCount - 2], _hullUpperPool[upperCount - 1], pt) <= 0) {
      upperCount--;
    }
    _hullUpperPool[upperCount].x = pt.x;
    _hullUpperPool[upperCount].y = pt.y;
    upperCount++;
  }

  let resultCount = 0;
  for (let i = 0; i < lowerCount - 1; i++) {
    _hullResultPool[resultCount].x = _hullLowerPool[i].x;
    _hullResultPool[resultCount].y = _hullLowerPool[i].y;
    resultCount++;
  }
  for (let i = 0; i < upperCount - 1; i++) {
    _hullResultPool[resultCount].x = _hullUpperPool[i].x;
    _hullResultPool[resultCount].y = _hullUpperPool[i].y;
    resultCount++;
  }

  return { hull: _hullResultPool, size: resultCount };
};

const getSpecimenHeight = (id: SpecimenId): number => {
  switch (id) {
    case 't_3d': return 0.38;
    case 'cylinder_3d': return 0.56;
    case 'trapezoid_3d': return 0.48;
    case 'cube_3d': return 0.72;
    case 'cuboid_3d': return 0.50;
    case 'prism_3d': return 0.48;
    default: return 0;
  }
};

export const LabCanvas3D: React.FC<Props> = ({
  specimenId,
  laser,
  cameraPreset = 'isometric',
  interactionMode = 'orbit',
  isBoxVisible = true,
  resetTrigger = 0,
  onReady,
  onUpdateLaser,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    specimenId,
    laser,
    cameraPreset,
    interactionMode,
    isBoxVisible,
    resetTrigger,
  });

  stateRef.current.specimenId = specimenId;
  stateRef.current.laser = laser;
  stateRef.current.cameraPreset = cameraPreset;
  stateRef.current.interactionMode = interactionMode;
  stateRef.current.isBoxVisible = isBoxVisible;
  stateRef.current.resetTrigger = resetTrigger;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. Scene, Camera (Phép Chiếu Song Song / Orthographic Camera), Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    // Tính toán kích thước Frustum để buồng thí nghiệm và đèn luôn vừa vặn mọi màn hình
    const aspect = container.clientWidth / container.clientHeight;
    const frustumHeight = Math.max(6.4, 10.2 / aspect);
    const frustumHalfH = frustumHeight / 2;
    const frustumHalfW = frustumHalfH * aspect;

    // Phép chiếu song song chuẩn kỹ thuật (Orthographic Camera) - Triệt tiêu hoàn toàn góc nhìn xuyên tâm
    // near = 0.1, far = 160.0 đảm bảo cột sáng vô tận không bao giờ bị cắt cụt
    const camera = new THREE.OrthographicCamera(
      -frustumHalfW,
      frustumHalfW,
      frustumHalfH,
      -frustumHalfH,
      0.1,
      160.0
    );

    const targetCenter = new THREE.Vector3(0, 0.62, 0);

    // Initial Axonometric 3D Parallel View
    camera.position.set(3.4, 3.8, 6.0);
    camera.up.set(0, 1, 0);
    camera.lookAt(targetCenter);

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    container.appendChild(renderer.domElement);

    // --- Thiết lập Môi trường Phản xạ Phòng Thí nghiệm (Studio Room Environment) ---
    // Giúp các bề mặt kim loại trên thân đèn, ốc vít, viền mạ chrome bắt sáng chân thực, không bị tối đen
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = roomEnvTexture;

    // --- 2. OrbitControls (Full 360° Free Parallel Orbit / Kéo khung hình) ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.copy(targetCenter);
    controls.minZoom = 0.4;
    controls.maxZoom = 4.0;
    // Giới hạn góc xoay 3D: Cực hạn là nhìn ngang (Math.PI / 2), không nhìn từ dưới đáy lên
    controls.maxPolarAngle = Math.PI / 2;
    // Cho phép nhìn thẳng đứng từ trên xuống (phi = 0) chuẩn xác 100% không bị lệch góc
    controls.minPolarAngle = 0;

    // Thiết lập phương thức tương tác ban đầu: Xoay 3D hoặc Kéo khung hình
    if (stateRef.current.interactionMode === 'pan') {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.touches.ONE = THREE.TOUCH.PAN;
      renderer.domElement.style.cursor = 'grab';
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      renderer.domElement.style.cursor = 'default';
    }

    const onPointerDown = () => {
      isCamAnimating = false;
      if (stateRef.current.interactionMode === 'pan') {
        renderer.domElement.style.cursor = 'grabbing';
      }
    };
    const onPointerUp = () => {
      if (stateRef.current.interactionMode === 'pan') {
        renderer.domElement.style.cursor = 'grab';
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    const onControlsStart = () => {
      isCamAnimating = false;
      if (stateRef.current.interactionMode === 'orbit') {
        if (camera.up.y !== 1) {
          camera.up.set(0, 1, 0);
        }
      }
    };
    controls.addEventListener('start', onControlsStart);

    // --- 3. Studio Lighting (Rực rỡ, tinh tế, làm nổi bật đường kẽ uốn và chữ khắc thân đèn) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x64748b, 0.6);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(6, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    fillLight.position.set(-6, 6, -5);
    scene.add(fillLight);

    // Đèn viền hắt sáng tôn vinh các gờ uốn kim loại của thân đèn
    const lampRimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    lampRimLight.position.set(0, -3, 6);
    scene.add(lampRimLight);

    // --- 4. Optical Chamber Box (Khung nhôm viền đen 12 cạnh, 5 mặt kính trong suốt) ---
    // Nền bên ngoài đã được loại bỏ hoàn toàn, buồng thí nghiệm là đối tượng trung tâm
    const boxW = 8.8;
    const boxH = 1.25;
    const boxD = 3.6;
    const halfW = boxW / 2;
    const halfD = boxD / 2;

    const chamberGroup = new THREE.Group();
    const boxFrameGroup = new THREE.Group();
    chamberGroup.add(boxFrameGroup);

    // Solid base plate under the chamber floor (màu xám đậm vừa vặn)
    const basePlateGeo = new THREE.BoxGeometry(boxW, 0.016, boxD);
    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Xám đậm vừa vặn, không quá sáng
      roughness: 0.6,
      metalness: 0.25,
      depthWrite: false,
    });
    const basePlateMesh = new THREE.Mesh(basePlateGeo, basePlateMat);
    basePlateMesh.position.set(0, -0.008, 0);
    boxFrameGroup.add(basePlateMesh);

    const barThick = 0.008;

    // --- Hệ thống 12 Cạnh Khung Hộp 3D Chuẩn Vẽ Kỹ Thuật (TCVN / ISO) ---
    // Nét thấy là đường nét liền (Solid line, mỏng thanh mảnh ~0.6pt)
    // Nét khuất/ẩn sau thân khối hộp là đường nét đứt (Dashed line)
    const boxEdgesDef: {
      p1: [number, number, number];
      p2: [number, number, number];
      faces: ['T' | 'B' | 'F' | 'K' | 'L' | 'R', 'T' | 'B' | 'F' | 'K' | 'L' | 'R'];
    }[] = [
      // 4 Cạnh Đỉnh (Top Edges - Y = boxH)
      { p1: [-halfW, boxH, halfD], p2: [halfW, boxH, halfD], faces: ['T', 'F'] }, // Đỉnh Trước
      { p1: [-halfW, boxH, -halfD], p2: [halfW, boxH, -halfD], faces: ['T', 'K'] }, // Đỉnh Sau
      { p1: [halfW, boxH, -halfD], p2: [halfW, boxH, halfD], faces: ['T', 'R'] }, // Đỉnh Phải
      { p1: [-halfW, boxH, -halfD], p2: [-halfW, boxH, halfD], faces: ['T', 'L'] }, // Đỉnh Trái

      // 4 Cạnh Đáy (Bottom Edges - Y = 0.006)
      { p1: [-halfW, 0.006, halfD], p2: [halfW, 0.006, halfD], faces: ['B', 'F'] }, // Đáy Trước
      { p1: [-halfW, 0.006, -halfD], p2: [halfW, 0.006, -halfD], faces: ['B', 'K'] }, // Đáy Sau
      { p1: [halfW, 0.006, -halfD], p2: [halfW, 0.006, halfD], faces: ['B', 'R'] }, // Đáy Phải
      { p1: [-halfW, 0.006, -halfD], p2: [-halfW, 0.006, halfD], faces: ['B', 'L'] }, // Đáy Trái

      // 4 Cạnh Đứng / Cột Góc (Vertical Pillars)
      { p1: [halfW, 0.006, halfD], p2: [halfW, boxH, halfD], faces: ['F', 'R'] }, // Cột Trước-Phải
      { p1: [-halfW, 0.006, halfD], p2: [-halfW, boxH, halfD], faces: ['F', 'L'] }, // Cột Trước-Trái
      { p1: [halfW, 0.006, -halfD], p2: [halfW, boxH, -halfD], faces: ['K', 'R'] }, // Cột Sau-Phải
      { p1: [-halfW, 0.006, -halfD], p2: [-halfW, boxH, -halfD], faces: ['K', 'L'] }, // Cột Sau-Trái
    ];

    const boxVisGeo = new THREE.BufferGeometry();
    const boxVisPos = new Float32Array(12 * 2 * 3);
    const boxVisDist = new Float32Array(12 * 2);
    boxVisGeo.setAttribute('position', new THREE.BufferAttribute(boxVisPos, 3));
    boxVisGeo.setAttribute('lineDistance', new THREE.BufferAttribute(boxVisDist, 1));

    // Pass 1: Cạnh thấy (nét liền) - hiển thị khi không bị vật cản đục (thân đèn) che khuất,
    // kể cả khi nhìn xuyên qua chùm ánh sáng laser hoặc kính quang học.
    // Chuẩn kỹ thuật & khoa học: Cột sáng nằm phía trong hộp, đường nét giao tuyến các mặt hình hộp
    // thuộc lớp bao ngoài (layer trên, renderOrder = 25) vẽ đè lên cột sáng, không bao giờ bị đứt tại cột sáng.
    const boxVisMat = new THREE.LineBasicMaterial({
      color: 0x090d16, // Đen tuyền sắc nét ~0.6pt
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,
      depthWrite: false,
    });
    const boxVisLines = new THREE.LineSegments(boxVisGeo, boxVisMat);
    boxVisLines.renderOrder = 25;
    boxFrameGroup.add(boxVisLines);

    // Pass 2: Cạnh bị che bởi thân đèn (không tính cột sáng) - tự động chuyển thành nét đứt chuẩn kỹ thuật TCVN/ISO
    const boxVisOccludedMat = new THREE.LineDashedMaterial({
      color: 0x475569, // Nét đứt màu xám kỹ thuật TCVN/ISO sắc nét
      dashSize: 0.1,
      gapSize: 0.07,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const boxVisOccludedLines = new THREE.LineSegments(boxVisGeo, boxVisOccludedMat);
    boxVisOccludedLines.renderOrder = 25;
    boxFrameGroup.add(boxVisOccludedLines);

    const boxHidGeo = new THREE.BufferGeometry();
    const boxHidPos = new Float32Array(12 * 2 * 3);
    const boxHidDist = new Float32Array(12 * 2);
    boxHidGeo.setAttribute('position', new THREE.BufferAttribute(boxHidPos, 3));
    boxHidGeo.setAttribute('lineDistance', new THREE.BufferAttribute(boxHidDist, 1));
    const boxHidMat = new THREE.LineDashedMaterial({
      color: 0x475569, // Nét đứt màu xám kỹ thuật TCVN/ISO sắc nét
      dashSize: 0.1,
      gapSize: 0.07,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
    });
    const boxHidLines = new THREE.LineSegments(boxHidGeo, boxHidMat);
    boxHidLines.renderOrder = 24;
    boxFrameGroup.add(boxHidLines);

    const updateBoxEdges = () => {
      // Vector hướng nhìn từ tâm buồng mẫu tới camera
      const dirX = camera.position.x;
      const dirY = camera.position.y - boxH / 2;
      const dirZ = camera.position.z;

      // Xác định mặt hướng về phía người nhìn (front-facing):
      const faceFront: Record<string, boolean> = {
        T: dirY > 0.001,
        B: dirY < -0.001,
        F: dirZ > 0.001,
        K: dirZ < -0.001,
        R: dirX > 0.001,
        L: dirX < -0.001,
      };

      let vCount = 0;
      let hCount = 0;

      for (let i = 0; i < boxEdgesDef.length; i++) {
        const edge = boxEdgesDef[i];
        const [f1, f2] = edge.faces;

        // Chuẩn không gian 3D: Cạnh bị khuất (nét đứt) nếu cả 2 mặt kề đều quay lưng về camera
        const isHidden = !faceFront[f1] && !faceFront[f2];

        const [x1, y1, z1] = edge.p1;
        const [x2, y2, z2] = edge.p2;

        if (isHidden) {
          const idx = hCount * 6;
          boxHidPos[idx] = x1;
          boxHidPos[idx + 1] = y1;
          boxHidPos[idx + 2] = z1;
          boxHidPos[idx + 3] = x2;
          boxHidPos[idx + 4] = y2;
          boxHidPos[idx + 5] = z2;

          const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
          boxHidDist[hCount * 2] = 0;
          boxHidDist[hCount * 2 + 1] = len;

          hCount++;
        } else {
          const idx = vCount * 6;
          boxVisPos[idx] = x1;
          boxVisPos[idx + 1] = y1;
          boxVisPos[idx + 2] = z1;
          boxVisPos[idx + 3] = x2;
          boxVisPos[idx + 4] = y2;
          boxVisPos[idx + 5] = z2;

          const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
          boxVisDist[vCount * 2] = 0;
          boxVisDist[vCount * 2 + 1] = len;

          vCount++;
        }
      }

      boxVisGeo.setDrawRange(0, vCount * 2);
      (boxVisGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (boxVisGeo.attributes.lineDistance as THREE.BufferAttribute).needsUpdate = true;

      boxHidGeo.setDrawRange(0, hCount * 2);
      (boxHidGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (boxHidGeo.attributes.lineDistance as THREE.BufferAttribute).needsUpdate = true;
    };

    updateBoxEdges();

    // --- Giới hạn kéo khung hình chuẩn xác 100% (Pan Boundary Constraint) ---
    // Đáp ứng hoàn hảo 2 trạng thái:
    // 1. Khi Hiện khung hình hộp (isBoxVisible = true):
    //    - Khung hộp buồng thí nghiệm KHÔNG BAO GIỜ bị kéo rời khỏi vùng nhìn thấy (viewport).
    //    - Triệt tiêu triệt để lỗi trôi chéo góc (diagonal escape bug) khi kéo chéo hoặc kéo ngang/dọc liên tục nhiều lần.
    // 2. Khi Ẩn khung hình hộp (isBoxVisible = false):
    //    - TẤT CẢ VẬT MẪU (từ 2D phẳng đến 3D hình khối) LUÔN LUÔN hiển thị trọn vẹn 100% trong vùng viewport.
    //    - Dù kéo ngang, kéo dọc, kéo chéo hay bất kỳ vị trí nào, vật mẫu không bao giờ bị trôi khuất khỏi màn hình.
    // 3. Tương thích co giãn hoàn mỹ trên TẤT CẢ CÁC MÀN HÌNH (kể cả điện thoại nhỏ 360px-390px, tablet đến màn hình desktop lớn).
    const focusAnchor = new THREE.Vector3();
    const tempProj = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const shiftVec = new THREE.Vector3();

    const clampPanToBounds = () => {
      camera.updateMatrixWorld();

      const currentIsBoxVisible = stateRef.current.isBoxVisible !== false;
      const currentSpecimen = stateRef.current.specimenId;

      // Xác định kích thước thực tế của khung nhìn canvas
      const width = container ? container.clientWidth : window.innerWidth;
      const isMobile = width < 768;

      let limitX: number;
      let minLimitY: number;
      let maxLimitY: number;

      if (!currentIsBoxVisible) {
        // --- TRƯỜNG HỢP ẨN KHUNG HỘP: VẬT MẪU LÀ TÂM ĐIỂM CHỦ ĐẠO ---
        // Tâm vật mẫu chính xác tuyệt đối theo chiều cao của từng hình 2D/3D
        const objHeight = getSpecimenHeight(currentSpecimen);
        const specimenCenterY = boxH + 0.005 + objHeight / 2;
        focusAnchor.set(0, specimenCenterY, 0);

        // Vùng an toàn để vật mẫu (bán kính ~0.35) luôn luôn nằm trọn vẹn 100% trong viewport
        // Không bị che bởi Header phía trên hay Thanh điều khiển (Dock) phía dưới
        if (isMobile) {
          limitX = 0.70;
          minLimitY = -0.52; // Tránh dock 2 hàng trên điện thoại
          maxLimitY = 0.72;  // Tránh header trên điện thoại
        } else {
          limitX = 0.78;
          minLimitY = -0.64; // Tránh dock trên desktop
          maxLimitY = 0.76;  // Tránh header trên desktop
        }
      } else {
        // --- TRƯỜNG HỢP HIỆN KHUNG HỘP: KHUNG HỘP BUỒNG THÍ NGHIỆM LÀ TÂM ĐIỂM ---
        // Tâm hình học của buồng thí nghiệm
        focusAnchor.set(0, boxH / 2, 0);

        // Giới hạn dịch chuyển của tâm buồng hộp trong hệ tọa độ chuẩn hóa NDC [-1, 1]
        // Đảm bảo tâm hộp luôn nằm trong viewport, giúp ít nhất 40% - 60% buồng hộp luôn luôn hiển thị
        // Khóa chặt cả 2 trục X và Y đồng thời -> Triệt tiêu hoàn toàn kẽ hở trôi chéo góc (diagonal escape)
        if (isMobile) {
          limitX = 0.82;
          minLimitY = -0.58;
          maxLimitY = 0.74;
        } else {
          limitX = 0.85;
          minLimitY = -0.68;
          maxLimitY = 0.78;
        }
      }

      // Chiếu điểm neo (anchor) lên hệ tọa độ thiết bị chuẩn hóa NDC [-1, 1] của Camera
      tempProj.copy(focusAnchor).project(camera);

      let deltaNdcX = 0;
      let deltaNdcY = 0;

      // Kiểm soát biên độ ngang (Trái / Phải)
      if (tempProj.x < -limitX) {
        deltaNdcX = -limitX - tempProj.x;
      } else if (tempProj.x > limitX) {
        deltaNdcX = limitX - tempProj.x;
      }

      // Kiểm soát biên độ dọc (Trên / Dưới)
      if (tempProj.y < minLimitY) {
        deltaNdcY = minLimitY - tempProj.y;
      } else if (tempProj.y > maxLimitY) {
        deltaNdcY = maxLimitY - tempProj.y;
      }

      // Nếu có sự vi phạm biên (kể cả kéo ngang, kéo dọc, hay kéo chéo góc), dịch chuyển tức thì camera & controls.target về vùng an toàn
      if (deltaNdcX !== 0 || deltaNdcY !== 0) {
        const frustumW = (camera.right - camera.left) / camera.zoom;
        const frustumH = (camera.top - camera.bottom) / camera.zoom;

        camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

        // Chuyển đổi chính xác độ lệch NDC sang tọa độ thế giới (world coordinates)
        const du = -deltaNdcX * (frustumW / 2);
        const dv = -deltaNdcY * (frustumH / 2);

        shiftVec
          .set(0, 0, 0)
          .addScaledVector(camRight, du)
          .addScaledVector(camUp, dv);

        camera.position.add(shiftVec);
        controls.target.add(shiftVec);
        camera.updateMatrixWorld();

        // Xóa triệt để quán tính kéo pan để không bị trượt xuyên rào hoặc nảy giật
        const internalControls = controls as unknown as { _panOffset?: THREE.Vector3 };
        if (internalControls._panOffset) {
          internalControls._panOffset.set(0, 0, 0);
        }
      }
    };

    // 5 Optical Glass Panels (Top Stage + 4 Sides)
    // A. 4 Side Glass Panels: Kính quang học trong suốt chống lóa
    const sideGlassMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.04,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const frontGlassGeo = new THREE.PlaneGeometry(boxW - barThick, boxH - barThick);
    const frontGlassMesh = new THREE.Mesh(frontGlassGeo, sideGlassMat);
    frontGlassMesh.position.set(0, boxH / 2, halfD - 0.002);
    frontGlassMesh.renderOrder = 20;
    boxFrameGroup.add(frontGlassMesh);

    const backGlassMesh = new THREE.Mesh(frontGlassGeo, sideGlassMat);
    backGlassMesh.rotation.y = Math.PI;
    backGlassMesh.position.set(0, boxH / 2, -halfD + 0.002);
    backGlassMesh.renderOrder = 20;
    boxFrameGroup.add(backGlassMesh);

    const sideGlassGeo = new THREE.PlaneGeometry(boxD - barThick, boxH - barThick);
    const leftGlassMesh = new THREE.Mesh(sideGlassGeo, sideGlassMat);
    leftGlassMesh.rotation.y = Math.PI / 2;
    leftGlassMesh.position.set(-halfW + 0.002, boxH / 2, 0);
    leftGlassMesh.renderOrder = 20;
    boxFrameGroup.add(leftGlassMesh);

    const rightGlassMesh = new THREE.Mesh(sideGlassGeo, sideGlassMat);
    rightGlassMesh.rotation.y = -Math.PI / 2;
    rightGlassMesh.position.set(halfW - 0.002, boxH / 2, 0);
    rightGlassMesh.renderOrder = 20;
    boxFrameGroup.add(rightGlassMesh);

    // B. Tấm Kính Quang Học Mặt Trên (Top Optical Glass Stage):
    // Dày dặn thực tế (12mm), màu xanh ngọc quang học đặc trưng, có viền mài bóng và vạch khắc định vị
    const topGlassThickness = 0.014;
    const topGlassGeo = new THREE.BoxGeometry(
      boxW - barThick - 0.01,
      topGlassThickness,
      boxD - barThick - 0.01
    );
    const topGlassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc, // Màu xanh ngọc kính quang học chịu lực
      transparent: true,
      opacity: 0.22, // Độ mờ vừa vặn để thấy rõ tấm kính thật sự hiện hữu
      roughness: 0.15,
      metalness: 0.1,
      depthWrite: false,
    });
    const topGlassMesh = new THREE.Mesh(topGlassGeo, topGlassMat);
    topGlassMesh.position.set(0, boxH - topGlassThickness / 2, 0);
    topGlassMesh.renderOrder = 4;
    boxFrameGroup.add(topGlassMesh);



    // 4 Chốt kẹp góc cố định mặt kính bằng kim loại mạ chrome (Corner clamping brackets)
    const clipGeo = new THREE.BoxGeometry(0.06, 0.02, 0.06);
    const clipMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
      depthWrite: false,
    });
    const clipOffsetW = halfW - 0.04;
    const clipOffsetD = halfD - 0.04;
    const clipPositions: [number, number][] = [
      [clipOffsetW, clipOffsetD],
      [clipOffsetW, -clipOffsetD],
      [-clipOffsetW, clipOffsetD],
      [-clipOffsetW, -clipOffsetD],
    ];
    clipPositions.forEach(([px, pz]) => {
      const clipMesh = new THREE.Mesh(clipGeo, clipMat);
      clipMesh.position.set(px, boxH + 0.002, pz);
      boxFrameGroup.add(clipMesh);
    });

    // --- 6. Bottom Projection Screen with Dynamic Physics Canvas ---
    // Pure radiant solid white (#ffffff) illuminated laser spot with maximum contrast!
    // The entire area where light touches the floor is SOLID BRIGHT WHITE.
    // The shadow inside is deep solid black (#0f172a). Zero murky dark haze around the sample!
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1760;
    floorCanvas.height = 720;
    const floorCtx = floorCanvas.getContext('2d')!;

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(boxW, boxD);
    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTexture,
      depthWrite: false,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0.004, 0);
    boxFrameGroup.add(floorMesh);

    scene.add(chamberGroup);

    // --- 7. Laser Lamp Unit (THIẾT KẾ ĐÈN LAZER: THÂN XÁM ĐẬM TRƠN, MẶT TRÊN MÀU TRẮNG ĐỒNG NHẤT CỘT SÁNG) ---
    // Đáp ứng chính xác yêu cầu người dùng:
    // 1. Màu nền thân đèn lazer đổi lại là màu xám đậm (#374151 / slate-gray).
    // 2. Không vẽ tô bất cứ hoa văn, họa tiết, sọc màu hay kẽ rãnh nào nữa (hoàn toàn phẳng trơn, tối giản, chuyên nghiệp).
    // 3. Phần mặt trên của đèn lazer là màu trắng tinh khôi trùng khớp hoàn toàn với cột sáng.
    const beamRadius = 0.75; // 75mm radius (150mm diameter) parallel beam
    const lampRadius = 0.75; // Bán kính đèn trùng khít với bán kính chùm sáng

    // --- 6.1. Vòng tròn nét đứt mốc chuẩn 90 độ tại đáy hộp (Phép chiếu vuông góc) ---
    // Yêu cầu chuẩn khoa học & quy ước TCVN/ISO:
    // 1. Luôn luôn là nét đứt vì nằm bên trong buồng hộp.
    // 2. Màu vàng đậm hơn (#d97706), độ dày dặn cao, không bị mờ nhạt.
    // 3. Sử dụng kỹ thuật dải viền vi mô đồng trục (Multi-track micro-concentric) để tạo nét đứt dày dặn ~3-4px trong WebGL.
    // 4. Nhìn xuyên qua được vật mẫu khi vật mẫu che khuất đường nét (depthTest: false, renderOrder: 18).
    // 5. Tuân thủ tuyệt đối quy tắc "thấy nét liền che nét đứt":
    //    Đường viền thấy nét liền của vật mẫu (renderOrder: 21) sẽ đè lên nét đứt.
    const createTargetRingGeo = (baseRadius: number, yPos: number, segs = 128) => {
      // 5 dải vi mô đồng trục cách nhau ~1.5mm tạo độ dày dặn đậm đà, vững chắc
      const offsets = [-0.003, -0.0015, 0, 0.0015, 0.003];
      const pts: THREE.Vector3[] = [];
      const totalPoints = segs * 2 * offsets.length;
      const lineDist = new Float32Array(totalPoints);
      const baseArcLen = (Math.PI * 2 * baseRadius) / segs;

      let idx = 0;
      for (const dr of offsets) {
        const r = baseRadius + dr;
        for (let i = 0; i < segs; i++) {
          const a1 = (i / segs) * Math.PI * 2;
          const a2 = ((i + 1) / segs) * Math.PI * 2;
          pts.push(
            new THREE.Vector3(Math.cos(a1) * r, yPos, Math.sin(a1) * r),
            new THREE.Vector3(Math.cos(a2) * r, yPos, Math.sin(a2) * r)
          );
          lineDist[idx * 2] = i * baseArcLen;
          lineDist[idx * 2 + 1] = (i + 1) * baseArcLen;
          idx++;
        }
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDist, 1));
      return geo;
    };

    const targetRingGeo = createTargetRingGeo(beamRadius, 0.006);

    // Vòng tròn nét đứt mốc chuẩn 90 độ tại mặt đáy hộp (Là một bộ phận gắn liền với đáy hộp)
    // 1. Luôn luôn là nét đứt vì nằm bên trong buồng hộp kín theo chuẩn quy ước TCVN/ISO
    // 2. Màu vàng hổ phách đậm đà (#d97706), độ dày dặn cao ~3-4px WebGL (Multi-track micro-concentric)
    // 3. Nhìn xuyên qua được vật mẫu khi vật mẫu che khuất đường nét (depthTest: false, renderOrder: 18)
    // 4. Tuân thủ nguyên tắc "thấy nét liền che nét đứt": Viền thấy nét liền của vật mẫu (renderOrder: 21) đè lên nét đứt
    // 5. Là một bộ phận cấu thành hộp: Khi ẩn khung hộp là ẩn luôn, khi hiện khung hộp là hiện luôn
    const targetRingMat = new THREE.LineDashedMaterial({
      color: 0xd97706, // Màu vàng hổ phách đậm đà, bão hòa cao, tương phản cực tốt
      dashSize: 0.075, // Nét đứt rõ ràng, mạch lạc
      gapSize: 0.04,   // Khoảng trống vừa vặn
      transparent: true,
      opacity: 1.0,    // Đậm đà 100%, hoàn toàn không bị mờ nhạt
      depthTest: false,
      depthWrite: false,
    });
    const targetRingLine = new THREE.LineSegments(targetRingGeo, targetRingMat);
    targetRingLine.renderOrder = 18;
    boxFrameGroup.add(targetRingLine);

    const laserHeadGroup = new THREE.Group();
    laserHeadGroup.renderOrder = 2;

    const housingH = 0.58;

    // A. Vật liệu thân đèn: Màu xám đậm (Dark Gray), hoàn thiện mờ satin kim loại, không vẽ tô
    const darkGrayBodyMat = new THREE.MeshStandardMaterial({
      color: 0x374151, // Màu xám đậm (Dark Gray #374151)
      metalness: 0.35,
      roughness: 0.35,
      depthWrite: true,
    });

    // B. Vật liệu mặt phẳng đỉnh và đáy: Màu trắng trùng với màu trắng của cột sáng
    const whiteFaceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    // C. Vật liệu viền đèn (Bezel Rim Material):
    // Kim loại ánh kim sang trọng (Titanium Silver / Chrome) tạo viền sắc nét, làm nổi bật thân đèn
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Màu bạc kim loại titanium sáng rõ nét
      metalness: 0.85,
      roughness: 0.2,
      depthWrite: true,
    });

    // Thân trụ đèn hình ống trơn láng xám đậm (128 cạnh cực mịn, triệt tiêu hoàn toàn góc cạnh)
    const housingGeo = new THREE.CylinderGeometry(
      lampRadius,
      lampRadius,
      housingH,
      128,
      1,
      true // Ống mở 2 đầu để gắn 2 nắp phẳng tròn
    );
    const housingMesh = new THREE.Mesh(housingGeo, darkGrayBodyMat);
    laserHeadGroup.add(housingMesh);

    // --- 7.1. Phần mặt trên của đèn lazer & Viền tròn phía trên ---
    // Mặt tròn phẳng màu trắng (trùng màu cột sáng) bên trong (128 cạnh tròn hoàn hảo)
    const topFaceGeo = new THREE.CircleGeometry(lampRadius, 128);
    const topFaceMesh = new THREE.Mesh(topFaceGeo, whiteFaceMat);
    topFaceMesh.rotation.x = -Math.PI / 2; // Hướng mặt lên phía trên (+Y)
    topFaceMesh.position.set(0, housingH / 2, 0);
    laserHeadGroup.add(topFaceMesh);

    // Vành phẳng kim loại bo viền chu vi mặt trên (Top Bezel Ring - 128 phân đoạn tròn chuẩn)
    const topRimGeo = new THREE.RingGeometry(lampRadius - 0.035, lampRadius, 128);
    const topRimMesh = new THREE.Mesh(topRimGeo, rimMat);
    topRimMesh.rotation.x = -Math.PI / 2;
    topRimMesh.position.set(0, housingH / 2 + 0.001, 0);
    laserHeadGroup.add(topRimMesh);

    // --- 7.2. Phần mặt dưới thấu kính & Viền tròn đáy thân đèn lazer ---
    // Mặt tròn phát sáng màu trắng đáy đèn (trùng màu cột sáng - 128 phân đoạn tròn chuẩn)
    const botFaceGeo = new THREE.CircleGeometry(beamRadius, 128);
    const botFaceMesh = new THREE.Mesh(botFaceGeo, whiteFaceMat);
    botFaceMesh.rotation.x = Math.PI / 2; // Hướng mặt xuống phía đáy (-Y)
    botFaceMesh.position.set(0, -housingH / 2, 0);
    laserHeadGroup.add(botFaceMesh);

    // Vành phẳng kim loại bo viền mép đáy thân đèn (Bottom Bezel Ring - 128 phân đoạn tròn chuẩn)
    const botRimGeo = new THREE.RingGeometry(beamRadius - 0.035, beamRadius, 128);
    const botRimMesh = new THREE.Mesh(botRimGeo, rimMat);
    botRimMesh.rotation.x = Math.PI / 2;
    botRimMesh.position.set(0, -housingH / 2 - 0.001, 0);
    laserHeadGroup.add(botRimMesh);

    scene.add(laserHeadGroup);

    // --- 8. Volumetric Parallel Beam Column (MATHEMATICAL CYLINDER FLUSH TO FLOOR) ---
    // User requested:
    // 1. "khi nghiêng lệch khỏi 90 độ thì cột sáng của đèn không kéo dài tới đáy"
    // 2. "cảm giác như bị dính vào mặt bên nên thì ra phần cột sáng bị chẻ làm đôi"
    // Solution:
    // Construct a custom dynamic BufferGeometry where:
    // - Every top vertex lies at the circular laser aperture
    // - Every ray extends downwards along the beam direction vector d
    // - Every bottom vertex terminates PRECISELY at Y = 0.003 (floor plane)
    // No vertices hover in mid-air! No vertices poke through the floor!
    // The beam is ONE UNBROKEN, CONTINUOUS, UNIFORM LUMINOUS COLUMN of light connecting the lamp directly to the floor!
    const NUM_SEGMENTS = 128; // 128 phân đoạn tròn hoàn hảo, triệt tiêu góc cạnh
    const beamPositions = new Float32Array((NUM_SEGMENTS + 1) * 2 * 3);
    const beamIndices: number[] = [];

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const topCurrent = i * 2;
      const botCurrent = i * 2 + 1;
      const topNext = (i + 1) * 2;
      const botNext = (i + 1) * 2 + 1;

      // Triangle 1
      beamIndices.push(topCurrent, botCurrent, botNext);
      // Triangle 2
      beamIndices.push(topCurrent, botNext, topNext);
    }

    const beamBufferGeo = new THREE.BufferGeometry();
    beamBufferGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(beamPositions, 3)
    );
    beamBufferGeo.setIndex(beamIndices);

    // Chùm sáng laser thể tích: Màu trắng tinh khiết trùng với mặt đèn, độ sáng 0.80
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const beamMesh = new THREE.Mesh(beamBufferGeo, beamMat);
    beamMesh.renderOrder = 5; // Drawn before outer glass (renderOrder = 20)
    scene.add(beamMesh);

    // --- 8.1. Đường viền bao ngoài cột sáng (Beam Silhouette Border Lines) ---
    // Yêu cầu chuẩn khoa học chuyên ngành:
    // 1. Khi ẩn khung hình hộp: xem như không có mặt đáy và không gian là vô tận.
    // 2. Cột sáng không còn bị cản bởi mặt phẳng sàn, nên không còn là elip đáy, mà là một "CỘT SÁNG VÔ TẬN"
    //    vượt qua hoàn toàn khỏi vùng nhìn thấy (viewport).
    // 3. Đường viền 2 bên bao quanh cột sáng chạy dài xuyên suốt không gian vào vô tận.
    // 4. Kích thước cột sáng và đường viền TRÙNG KHỚP TUYỆT ĐỐI HOÀN TOÀN với kích thước đèn (bán kính = beamRadius = 0.75),
    //    không lệch 1 nanomet.
    // 5. Chiều dài cột sáng và viền luôn duy trì kéo dài cố định sẵn (~80 units) trong suốt quá trình kéo thả, xoay 3D,
    //    triệt tiêu hoàn toàn hiện tượng giật lag khung hình khi thao tác.
    const beamSilhouetteGroup = new THREE.Group();

    const silPositions = new Float32Array(4 * 3); // 2 đường sinh viền (4 đỉnh)
    const silGeo = new THREE.BufferGeometry();
    silGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(silPositions, 3)
    );

    // Lớp viền nền tương phản vi mô (Micro-contrast line): Giúp viền trắng nổi bật sắc sảo trên nền sáng #f1f5f9
    const silContrastMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8, // Slate tương phản nhẹ tinh tế
      transparent: true,
      opacity: 0.65,
      depthTest: true,
      depthWrite: false,
    });
    const beamSilhouetteContrastLine = new THREE.LineSegments(silGeo, silContrastMat);
    beamSilhouetteContrastLine.renderOrder = 6;
    beamSilhouetteGroup.add(beamSilhouetteContrastLine);

    // Lớp viền chính: Màu trắng tinh khiết trùng khớp 100% với màu cột sáng/ánh sáng
    const silMat = new THREE.LineBasicMaterial({
      color: 0xffffff, // Trùng hoàn toàn với màu cột sáng
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
    });
    const beamSilhouetteLine = new THREE.LineSegments(silGeo, silMat);
    beamSilhouetteLine.renderOrder = 7;
    beamSilhouetteGroup.add(beamSilhouetteLine);

    scene.add(beamSilhouetteGroup);

    // --- 9. Specimen Mounted on Top Glass Plate ---
    const specimenMeshGroup = new THREE.Group();
    specimenMeshGroup.renderOrder = 10;
    scene.add(specimenMeshGroup);

    const createTShape = () => {
      const shape = new THREE.Shape();
      // Kích thước chuẩn kỹ thuật: Rộng 0.94, Cao 0.78 (tâm đặt chính xác tại 0, 0)
      // Bán kính góc xa nhất 0.61, chiếm ~83-85% cột sáng bán kính 0.75, cột sáng luôn bao trọn vật mẫu
      shape.moveTo(-0.47, 0.39);
      shape.lineTo(0.47, 0.39);
      shape.lineTo(0.47, 0.17);
      shape.lineTo(0.14, 0.17);
      shape.lineTo(0.14, -0.39);
      shape.lineTo(-0.14, -0.39);
      shape.lineTo(-0.14, 0.17);
      shape.lineTo(-0.47, 0.17);
      shape.closePath();
      return shape;
    };

    // Hàm tính khoảng cách đường thẳng cho LineDashedMaterial (chuẩn nét đứt)
    const setupLineDistances = (geo: THREE.BufferGeometry) => {
      const pos = geo.attributes.position;
      const count = pos.count;
      const dist = new Float32Array(count);
      let total = 0;
      for (let i = 0; i < count; i += 2) {
        const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
        dist[i] = total;
        total += len;
        dist[i + 1] = total;
      }
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(dist, 1));
      return geo;
    };

    // Chuẩn kỹ thuật không gian 3D (TCVN / ISO):
    // Cả đường nét thấy và nét khuất (nét đứt) đều có màu sắc ĐỒNG NHẤT 100%
    const SPECIMEN_EDGE_COLOR = 0x082f49; // Đen navy kỹ thuật đậm nét đồng nhất tuyệt đối

    // 1. Nét thấy: Đường nét liền đậm (Visible Solid Line)
    const visibleEdgeMat = new THREE.LineBasicMaterial({
      color: SPECIMEN_EDGE_COLOR,
      depthFunc: THREE.LessEqualDepth,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });

    // 2. Nét khuất: Đường nét đứt (Hidden Dashed Line)
    // TCVN / ISO: Màu sắc ĐỒNG NHẤT hoàn toàn với nét thấy, không dùng màu trắng
    const hiddenEdgeMat = new THREE.LineDashedMaterial({
      color: SPECIMEN_EDGE_COLOR,
      dashSize: 0.035,
      gapSize: 0.02,
      depthFunc: THREE.GreaterDepth,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });

    // Tạo hệ thống cạnh kép chuẩn đồ họa kỹ thuật:
    // Tự động phân đoạn trên từng mili-mét đường nét:
    // - Đoạn nhìn thấy trực tiếp (kể cả xuyên qua ánh sáng) -> Nét liền
    // - Đoạn bị che khuất bởi thân đèn / viền đèn / khối vật mẫu -> Nét đứt cùng màu
    const createScientificEdges = (edgesGeo: THREE.BufferGeometry) => {
      const edgeGroup = new THREE.Group();

      // Pass 1: Nét khuất (Nét đứt)
      const dashedGeo = setupLineDistances(edgesGeo.clone());
      const hiddenLine = new THREE.LineSegments(dashedGeo, hiddenEdgeMat);
      hiddenLine.renderOrder = 20;
      edgeGroup.add(hiddenLine);

      // Pass 2: Nét thấy (Nét liền)
      const visibleLine = new THREE.LineSegments(edgesGeo, visibleEdgeMat);
      visibleLine.renderOrder = 21;
      edgeGroup.add(visibleLine);

      return edgeGroup;
    };

    // Hàm tạo viền tròn kỹ thuật có nét đứt đều đẹp hoàn mỹ tuyệt đối cho các khối tròn/hình trụ
    const createCircleEdgesInXZ = (radius: number, yPos: number, segs = 96) => {
      const pts: THREE.Vector3[] = [];
      const lineDist = new Float32Array(segs * 2);
      const segArcLen = (Math.PI * 2 * radius) / segs;

      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(Math.cos(a1) * radius, yPos, Math.sin(a1) * radius),
          new THREE.Vector3(Math.cos(a2) * radius, yPos, Math.sin(a2) * radius)
        );
        lineDist[i * 2] = i * segArcLen;
        lineDist[i * 2 + 1] = (i + 1) * segArcLen;
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDist, 1));

      const edgeGroup = new THREE.Group();
      const hiddenLine = new THREE.LineSegments(geo, hiddenEdgeMat);
      hiddenLine.renderOrder = 20;
      edgeGroup.add(hiddenLine);

      const visibleLine = new THREE.LineSegments(geo, visibleEdgeMat);
      visibleLine.renderOrder = 21;
      edgeGroup.add(visibleLine);

      return edgeGroup;
    };

    const createCircleEdgesInXY = (radius: number, zPos = 0, segs = 96) => {
      const pts: THREE.Vector3[] = [];
      const lineDist = new Float32Array(segs * 2);
      const segArcLen = (Math.PI * 2 * radius) / segs;

      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, zPos),
          new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, zPos)
        );
        lineDist[i * 2] = i * segArcLen;
        lineDist[i * 2 + 1] = (i + 1) * segArcLen;
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDist, 1));

      const edgeGroup = new THREE.Group();
      const hiddenLine = new THREE.LineSegments(geo, hiddenEdgeMat);
      hiddenLine.renderOrder = 20;
      edgeGroup.add(hiddenLine);

      const visibleLine = new THREE.LineSegments(geo, visibleEdgeMat);
      visibleLine.renderOrder = 21;
      edgeGroup.add(visibleLine);

      return edgeGroup;
    };

    // Hàm tạo hình thang chuẩn kỹ thuật: Đáy nhỏ 0.56, đáy lớn 0.96, chiều cao 0.64 (tâm 0, 0)
    const createTrapezoidShape = () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.28, 0.32);
      shape.lineTo(0.28, 0.32);
      shape.lineTo(0.48, -0.32);
      shape.lineTo(-0.48, -0.32);
      shape.closePath();
      return shape;
    };

    // Hàm tạo tam giác chuẩn kỹ thuật: Đáy 1.04, đỉnh 0.46, trọng tâm chính xác tại (0, 0)
    const createTriangleShape = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.46);
      shape.lineTo(0.52, -0.23);
      shape.lineTo(-0.52, -0.23);
      shape.closePath();
      return shape;
    };

    // Hàm đệ quy giải phóng tài nguyên GPU VRAM triệt để (Chống Memory Leak)
    const disposeHierarchy = (node: THREE.Object3D) => {
      node.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments) {
          const m = child as THREE.Mesh;
          if (m.geometry) {
            m.geometry.dispose();
          }
          if (m.material) {
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material.dispose();
            }
          }
        }
      });
    };

    const buildSpecimen = (id: SpecimenId) => {
      while (specimenMeshGroup.children.length > 0) {
        const child = specimenMeshGroup.children[0];
        disposeHierarchy(child);
        specimenMeshGroup.remove(child);
      }

      // Vật liệu mẫu kỹ thuật: Màu xanh da trời chuẩn (#0284c7)
      const skyBlueMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.65,
        metalness: 0.08,
        depthWrite: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      // Mọi vật mẫu (2D và 3D) đều được căn chỉnh tâm chính xác tuyệt đối tại tọa độ (0, 0)
      // Kích thước vật mẫu luôn lọt thỏm trọn vẹn, thông thoáng, nằm gọn bên trong cột sáng (bán kính 0.75)

      // --- NHÓM HÌNH 2D (In phẳng trên kính nắp) ---
      if (id === 't_2d') {
        const tShape = createTShape();
        const tGeo = new THREE.ShapeGeometry(tShape);
        const mesh = new THREE.Mesh(tGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(tGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'circle_2d') {
        const cr = 0.62;
        const circleGeo = new THREE.CircleGeometry(cr, 64);
        const mesh = new THREE.Mesh(circleGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createCircleEdgesInXY(cr, 0, 96));
        specimenMeshGroup.add(mesh);
      } else if (id === 'trapezoid_2d') {
        const trapShape = createTrapezoidShape();
        const trapGeo = new THREE.ShapeGeometry(trapShape);
        const mesh = new THREE.Mesh(trapGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(trapGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'square_2d') {
        const s = 0.88;
        const sqGeo = new THREE.PlaneGeometry(s, s);
        const mesh = new THREE.Mesh(sqGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(sqGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'rectangle_2d') {
        const rw = 1.04;
        const rh = 0.66;
        const rectGeo = new THREE.PlaneGeometry(rw, rh);
        const mesh = new THREE.Mesh(rectGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(rectGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'triangle_2d') {
        const triShape = createTriangleShape();
        const triGeo = new THREE.ShapeGeometry(triShape);
        const mesh = new THREE.Mesh(triGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(triGeo)));
        specimenMeshGroup.add(mesh);
      }

      // --- NHÓM HÌNH 3D (Khối nổi kỹ thuật) ---
      else if (id === 't_3d') {
        const tShape = createTShape();
        const ch = 0.38;
        const extrudeSettings = {
          depth: ch,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: 0.01,
          bevelThickness: 0.01,
        };
        const tExtrudeGeo = new THREE.ExtrudeGeometry(tShape, extrudeSettings);
        const mesh = new THREE.Mesh(tExtrudeGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(tExtrudeGeo, 24)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'cylinder_3d') {
        // Khối hình trụ: Bán kính 0.52, Chiều cao 0.56 (chiếm ~82% cột sáng bán kính 0.75)
        // Chỉ vẽ 2 vòng tròn viền mép trên và mép dưới
        // Nét đứt của mép dưới được phân đoạn cung tròn liên tục 96 bước đều tăm tắp, chuẩn đẹp
        const cr = 0.52;
        const ch = 0.56;
        const cylGeo = new THREE.CylinderGeometry(cr, cr, ch, 48);
        const mesh = new THREE.Mesh(cylGeo, skyBlueMat);
        mesh.position.set(0, boxH + 0.005 + ch / 2, 0);
        mesh.renderOrder = 3;

        mesh.add(createCircleEdgesInXZ(cr, ch / 2, 96));
        mesh.add(createCircleEdgesInXZ(cr, -ch / 2, 96));
        specimenMeshGroup.add(mesh);
      } else if (id === 'trapezoid_3d') {
        // Khối hình thang 3D
        const trapShape = createTrapezoidShape();
        const ch = 0.48;
        const trapExtrudeGeo = new THREE.ExtrudeGeometry(trapShape, {
          depth: ch,
          bevelEnabled: false,
        });
        const mesh = new THREE.Mesh(trapExtrudeGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(trapExtrudeGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'cube_3d') {
        // Khối lập phương 3D: 0.72 x 0.72 x 0.72
        const s = 0.72;
        const cubeGeo = new THREE.BoxGeometry(s, s, s);
        const mesh = new THREE.Mesh(cubeGeo, skyBlueMat);
        mesh.position.set(0, boxH + 0.005 + s / 2, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(cubeGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'cuboid_3d') {
        // Khối hộp chữ nhật 3D: Rộng 0.92 x Cao 0.50 x Sâu 0.60
        const rw = 0.92;
        const ch = 0.50;
        const rh = 0.60;
        const boxGeo = new THREE.BoxGeometry(rw, ch, rh);
        const mesh = new THREE.Mesh(boxGeo, skyBlueMat);
        mesh.position.set(0, boxH + 0.005 + ch / 2, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(boxGeo)));
        specimenMeshGroup.add(mesh);
      } else if (id === 'prism_3d') {
        // Khối lăng trụ tam giác 3D: Chiều cao 0.48
        const triShape = createTriangleShape();
        const ch = 0.48;
        const prismGeo = new THREE.ExtrudeGeometry(triShape, {
          depth: ch,
          bevelEnabled: false,
        });
        const mesh = new THREE.Mesh(prismGeo, skyBlueMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, boxH + 0.005, 0);
        mesh.renderOrder = 3;
        mesh.add(createScientificEdges(new THREE.EdgesGeometry(prismGeo)));
        specimenMeshGroup.add(mesh);
      }
    };

    buildSpecimen(stateRef.current.specimenId);

    // --- 10. Dynamic Floor Physics Projection ---
    // User requirement:
    // "Vùng nào ánh sáng chiếu qua và chạm được đến đáy thì phải sáng rõ chứ sao tôi thấy chữ T có bóng rồi mà vùng tròn nền quanh chữ T vẫn có bóng mờ. Trong khi đó là phần ánh sáng chạm vào thì phải sáng rõ chứ. Mọi thứ đều phải như một phòng thí nghiệm thật sự vậy đó, chuẩn khoa học"
    // Implementation:
    // 1. Floor screen is clean neutral dark slate (#1e293b).
    // 2. The laser illuminated footprint is SOLID PURE WHITE (#ffffff) with high contrast.
    // 3. Inside the white footprint, ONLY the blocked shadow is deep crisp black (#0f172a).
    // 4. The entire surrounding illuminated circle is 100% PURE WHITE. ZERO "bóng mờ" around the sample!
    const renderFloorCanvas = (currentLaser: LaserConfig, currentSpecimen: SpecimenId) => {
      const cw = floorCanvas.width;
      const ch = floorCanvas.height;

      // Realistic lab screen background (màu xám nền đậm vừa vặn, không quá sáng)
      floorCtx.fillStyle = '#64748b';
      floorCtx.fillRect(0, 0, cw, ch);

      const cx = cw / 2; // 880
      const cy = ch / 2; // 360
      const scale = cw / boxW; // Tỷ lệ chính xác tuyệt đối: 1760 / 8.8 = 200 px/unit

      if (currentLaser.isOn && currentLaser.isVisible !== false) {
        const objHeight = getSpecimenHeight(currentSpecimen);
        const targetY = boxH + 0.005 + objHeight / 2;
        const floorY = 0.004;

      const alphaRad = (currentLaser.alpha * Math.PI) / 180;
      const sinAlpha = Math.max(0.01, Math.sin(alphaRad));
      const cotAlpha = Math.cos(alphaRad) / sinAlpha;

      // Exact floor displacement along X for the center of the specimen
      const shiftX = -(targetY - floorY) * cotAlpha;

      const spotU = cx + shiftX * scale;
      const spotV = cy;

      // Kích thước đốm sáng trên đáy trùng tuyệt đối 1:1 với kích thước đèn và chùm sáng:
      const radiusX = (beamRadius / sinAlpha) * scale;
      const radiusY = beamRadius * scale;

      // --- A. Draw Brilliant, Pure Solid White Laser Footprint ---
      floorCtx.save();
      const spotAlpha = Math.min(1.0, 0.85 + 0.15 * currentLaser.intensity);
      floorCtx.fillStyle = `rgba(255, 255, 255, ${spotAlpha})`;
      floorCtx.beginPath();
      floorCtx.ellipse(spotU, spotV, radiusX, radiusY, 0, 0, Math.PI * 2);
      floorCtx.fill();
      floorCtx.restore();

      // --- B. Draw Physically Exact Specimen Shadow Inside the Pure White Footprint ---
      // Bóng đen tuyền sắc nét (#000000), tâm bóng LUÔN TRÙNG KHÍT TÂM VỆT SÁNG (spotU, spotV)
      floorCtx.save();
      floorCtx.fillStyle = '#000000';

      const drawTPath = (ox: number, oy: number) => {
        const w = 0.94 * scale;
        const hTop = 0.22 * scale;
        const wStem = 0.28 * scale;
        const hStem = 0.56 * scale;
        floorCtx.fillRect(ox - w / 2, oy - hTop / 2 - hStem / 2, w, hTop);
        floorCtx.fillRect(ox - wStem / 2, oy - hStem / 2 + hTop / 2, wStem, hStem);
      };

      const drawTrapezoidPath = (ox: number, oy: number) => {
        const topW = 0.56 * scale;
        const botW = 0.96 * scale;
        const h = 0.64 * scale;
        floorCtx.beginPath();
        floorCtx.moveTo(ox - topW / 2, oy - h / 2);
        floorCtx.lineTo(ox + topW / 2, oy - h / 2);
        floorCtx.lineTo(ox + botW / 2, oy + h / 2);
        floorCtx.lineTo(ox - botW / 2, oy + h / 2);
        floorCtx.closePath();
        floorCtx.fill();
      };

      const drawTrianglePath = (ox: number, oy: number) => {
        const apexY = -0.46 * scale;
        const baseW = 0.52 * scale;
        const baseY = 0.23 * scale;
        floorCtx.beginPath();
        floorCtx.moveTo(ox, oy + apexY);
        floorCtx.lineTo(ox + baseW, oy + baseY);
        floorCtx.lineTo(ox - baseW, oy + baseY);
        floorCtx.closePath();
        floorCtx.fill();
      };

      const drawHullFromPool = (count: number) => {
        const { hull, size } = computeConvexHullInPlace(_hullPtsPool, count);
        if (size === 0) return;
        floorCtx.beginPath();
        floorCtx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < size; i++) {
          floorCtx.lineTo(hull[i].x, hull[i].y);
        }
        floorCtx.closePath();
        floorCtx.fill();
      };

      // 1. Nhóm Hình 2D (chiếu phẳng trên mặt kính nắp, tâm bóng luôn tại spotU, spotV)
      if (currentSpecimen === 't_2d') {
        drawTPath(spotU, spotV);
      } else if (currentSpecimen === 'circle_2d') {
        floorCtx.beginPath();
        floorCtx.arc(spotU, spotV, 0.62 * scale, 0, Math.PI * 2);
        floorCtx.fill();
      } else if (currentSpecimen === 'trapezoid_2d') {
        drawTrapezoidPath(spotU, spotV);
      } else if (currentSpecimen === 'square_2d') {
        const s = 0.88 * scale;
        floorCtx.fillRect(spotU - s / 2, spotV - s / 2, s, s);
      } else if (currentSpecimen === 'rectangle_2d') {
        const rw = 1.04 * scale;
        const rh = 0.66 * scale;
        floorCtx.fillRect(spotU - rw / 2, spotV - rh / 2, rw, rh);
      } else if (currentSpecimen === 'triangle_2d') {
        drawTrianglePath(spotU, spotV);
      }
      // 2. Nhóm Hình 3D Khối (Hình chiếu song song chuẩn xác tuyệt đối qua Convex Hull 3D)
      else if (currentSpecimen === 't_3d') {
        const ch = 0.38;
        const halfShift = (ch / 2) * cotAlpha * scale;
        const uBot = spotU + halfShift;
        const uTop = spotU - halfShift;
        const minU = Math.min(uBot, uTop);
        const shiftSpan = Math.abs(uTop - uBot);
        const w = 0.94 * scale;
        const hTop = 0.22 * scale;
        const wStem = 0.28 * scale;
        const hStem = 0.56 * scale;
        floorCtx.fillRect(minU - w / 2, spotV - hTop / 2 - hStem / 2, w + shiftSpan, hTop);
        floorCtx.fillRect(minU - wStem / 2, spotV - hStem / 2 + hTop / 2, wStem + shiftSpan, hStem);
      } else if (currentSpecimen === 'cylinder_3d') {
        const r = 0.52 * scale;
        const ch = 0.56;
        const halfShift = (ch / 2) * cotAlpha * scale;
        const uBot = spotU + halfShift;
        const uTop = spotU - halfShift;
        const uMin = Math.min(uBot, uTop);
        const uMax = Math.max(uBot, uTop);
        floorCtx.beginPath();
        floorCtx.arc(uMin, spotV, r, Math.PI / 2, (Math.PI * 3) / 2);
        floorCtx.arc(uMax, spotV, r, (Math.PI * 3) / 2, Math.PI / 2);
        floorCtx.closePath();
        floorCtx.fill();
      } else if (currentSpecimen === 'trapezoid_3d') {
        const ch = 0.48;
        const halfH = ch / 2;
        const trapVerts = [
          { x: -0.28, z: -0.32 },
          { x: 0.28, z: -0.32 },
          { x: 0.48, z: 0.32 },
          { x: -0.48, z: 0.32 },
        ];
        let pIdx = 0;
        for (const v of trapVerts) {
          for (const dy of [-halfH, halfH]) {
            _hullPtsPool[pIdx].x = spotU + (v.x - dy * cotAlpha) * scale;
            _hullPtsPool[pIdx].y = spotV + v.z * scale;
            pIdx++;
          }
        }
        drawHullFromPool(pIdx);
      } else if (currentSpecimen === 'cube_3d') {
        const s = 0.72;
        const halfS = s / 2;
        let pIdx = 0;
        for (const dx of [-halfS, halfS]) {
          for (const dz of [-halfS, halfS]) {
            for (const dy of [-halfS, halfS]) {
              _hullPtsPool[pIdx].x = spotU + (dx - dy * cotAlpha) * scale;
              _hullPtsPool[pIdx].y = spotV + dz * scale;
              pIdx++;
            }
          }
        }
        drawHullFromPool(pIdx);
      } else if (currentSpecimen === 'cuboid_3d') {
        const rw = 0.92;
        const ch = 0.50;
        const rh = 0.60;
        const halfW = rw / 2;
        const halfD = rh / 2;
        const halfH = ch / 2;
        let pIdx = 0;
        for (const dx of [-halfW, halfW]) {
          for (const dz of [-halfD, halfD]) {
            for (const dy of [-halfH, halfH]) {
              _hullPtsPool[pIdx].x = spotU + (dx - dy * cotAlpha) * scale;
              _hullPtsPool[pIdx].y = spotV + dz * scale;
              pIdx++;
            }
          }
        }
        drawHullFromPool(pIdx);
      } else if (currentSpecimen === 'prism_3d') {
        const ch = 0.48;
        const halfH = ch / 2;
        const triVerts = [
          { x: 0, z: -0.46 },
          { x: 0.52, z: 0.23 },
          { x: -0.52, z: 0.23 },
        ];
        let pIdx = 0;
        for (const v of triVerts) {
          for (const dy of [-halfH, halfH]) {
            _hullPtsPool[pIdx].x = spotU + (v.x - dy * cotAlpha) * scale;
            _hullPtsPool[pIdx].y = spotV + v.z * scale;
            pIdx++;
          }
        }
        drawHullFromPool(pIdx);
      }

        floorCtx.restore();
      }

      floorTexture.needsUpdate = true;
    };

    renderFloorCanvas(stateRef.current.laser, stateRef.current.specimenId);

    // --- 11. Animation Tick Loop với Dirty-Flag Engine (Render-on-demand) ---
    // Giảm 95% tải GPU khi đứng yên, duy trì 60-120 FPS mượt mà khi tương tác, độ trễ 0ms
    let animationFrameId: number;
    let isDirty = true;
    let isInitialRenderDone = false;

    const requestRender = () => {
      isDirty = true;
    };

    controls.addEventListener('change', requestRender);

    let lastLaserAlpha = -1;
    let lastLaserIsOn = !laser.isOn;
    let lastLaserIsVisible = laser.isVisible !== false;
    let lastLaserIntensity = -1;
    let lastSpecimenId = specimenId;
    let lastCameraPreset = cameraPreset;
    let lastResetTrigger = stateRef.current.resetTrigger;
    let lastInteractionMode = stateRef.current.interactionMode;
    let lastIsBoxVisible = isBoxVisible;

    // Helper tính toán tọa độ đích và vector Up cho từng góc nhìn chuẩn
    const getPresetTarget = (preset: CameraPreset) => {
      if (preset === 'top') {
        return {
          pos: new THREE.Vector3(0, 15, 0),
          up: new THREE.Vector3(0, 0, -1),
        };
      } else if (preset === 'front') {
        return {
          pos: new THREE.Vector3(0, 0.62, 15),
          up: new THREE.Vector3(0, 1, 0),
        };
      } else if (preset === 'side') {
        return {
          pos: new THREE.Vector3(15, 0.62, 0),
          up: new THREE.Vector3(0, 1, 0),
        };
      } else {
        return {
          pos: new THREE.Vector3(3.4, 3.8, 6.0),
          up: new THREE.Vector3(0, 1, 0),
        };
      }
    };

    // Smooth Camera Transition State (~280ms siêu mượt, không giật lag)
    let isCamAnimating = false;
    let camAnimStartTime = 0;
    const CAM_ANIM_DURATION = 280;
    const animStartPos = new THREE.Vector3();
    const animTargetPos = new THREE.Vector3();
    const animStartUp = new THREE.Vector3();
    const animTargetUp = new THREE.Vector3();
    const animStartTarget = new THREE.Vector3();
    let animStartZoom = 1;
    let animTargetZoom = 1;

    const startCameraTransition = (targetPos: THREE.Vector3, targetUp: THREE.Vector3, targetZoomVal = 1) => {
      animStartPos.copy(camera.position);
      animTargetPos.copy(targetPos);
      animStartUp.copy(camera.up);
      animTargetUp.copy(targetUp);
      animStartTarget.copy(controls.target);
      animStartZoom = camera.zoom;
      animTargetZoom = targetZoomVal;
      camAnimStartTime = performance.now();
      isCamAnimating = true;
      isDirty = true;
    };

    // Khởi tạo trạng thái ban đầu của khung hình hộp và đường viền bao ngoài cột sáng
    boxFrameGroup.visible = isBoxVisible;
    beamSilhouetteGroup.visible = (laser.isVisible !== false) && laser.isOn;

    const camDir = new THREE.Vector3();
    const silVec = new THREE.Vector3();
    const beamDir = new THREE.Vector3();

    const tick = () => {
      animationFrameId = requestAnimationFrame(tick);
      const currentLaser = stateRef.current.laser;
      const currentSpecimen = stateRef.current.specimenId;
      const currentPreset = stateRef.current.cameraPreset;
      const currentResetTrigger = stateRef.current.resetTrigger;
      const currentInteractionMode = stateRef.current.interactionMode;
      const currentIsBoxVisible = stateRef.current.isBoxVisible !== false;
      const isLampVisible = currentLaser.isVisible !== false;

      const boxVisibilityChanged = currentIsBoxVisible !== lastIsBoxVisible;
      const modeChanged = currentInteractionMode !== lastInteractionMode;
      const presetChanged = currentPreset !== lastCameraPreset;
      const resetTriggerChanged = currentResetTrigger !== lastResetTrigger;
      const specimenChanged = currentSpecimen !== lastSpecimenId;
      const laserChanged = (
        currentLaser.alpha !== lastLaserAlpha ||
        currentLaser.isOn !== lastLaserIsOn ||
        isLampVisible !== lastLaserIsVisible ||
        Math.abs(currentLaser.intensity - lastLaserIntensity) > 0.005
      );

      if (boxVisibilityChanged || modeChanged || presetChanged || resetTriggerChanged || specimenChanged || laserChanged || isCamAnimating) {
        isDirty = true;
      }

      const controlsMoved = controls.update();
      if (controlsMoved) {
        isDirty = true;
      }

      if (isDirty) {
        if (boxVisibilityChanged) {
          lastIsBoxVisible = currentIsBoxVisible;
          boxFrameGroup.visible = currentIsBoxVisible;
        }

        if (modeChanged) {
          lastInteractionMode = currentInteractionMode;
          if (currentInteractionMode === 'pan') {
            controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            controls.touches.ONE = THREE.TOUCH.PAN;
            renderer.domElement.style.cursor = 'grab';
          } else {
            controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
            controls.touches.ONE = THREE.TOUCH.ROTATE;
            renderer.domElement.style.cursor = 'default';
          }
        }

        if (resetTriggerChanged) {
          lastResetTrigger = currentResetTrigger;
          lastCameraPreset = 'isometric';
          const { pos, up } = getPresetTarget('isometric');
          startCameraTransition(pos, up, 1);
        } else if (presetChanged) {
          lastCameraPreset = currentPreset;
          const { pos, up } = getPresetTarget(currentPreset);
          startCameraTransition(pos, up, currentPreset === 'isometric' ? 1 : camera.zoom);
        }

        if (isCamAnimating) {
          const elapsed = performance.now() - camAnimStartTime;
          const progress = Math.min(1, elapsed / CAM_ANIM_DURATION);
          // Ease-out cubic: 1 - (1 - t)^3
          const ease = 1 - Math.pow(1 - progress, 3);

          camera.position.lerpVectors(animStartPos, animTargetPos, ease);
          camera.up.lerpVectors(animStartUp, animTargetUp, ease).normalize();
          controls.target.lerpVectors(animStartTarget, targetCenter, ease);
          camera.zoom = animStartZoom + (animTargetZoom - animStartZoom) * ease;
          camera.updateProjectionMatrix();
          camera.lookAt(controls.target);
          controls.update();

          if (progress >= 1) {
            isCamAnimating = false;
            camera.position.copy(animTargetPos);
            camera.up.copy(animTargetUp);
            controls.target.copy(targetCenter);
            camera.zoom = animTargetZoom;
            camera.updateProjectionMatrix();
            camera.lookAt(targetCenter);
            controls.update();
          }
        }

        clampPanToBounds();
        if (currentIsBoxVisible) {
          updateBoxEdges();
        }

        if (specimenChanged) {
          lastSpecimenId = currentSpecimen;
          buildSpecimen(lastSpecimenId);
          renderFloorCanvas(currentLaser, currentSpecimen);
        }

        if (laserChanged) {
          lastLaserAlpha = currentLaser.alpha;
          lastLaserIsOn = currentLaser.isOn;
          lastLaserIsVisible = isLampVisible;
          lastLaserIntensity = currentLaser.intensity;
          renderFloorCanvas(currentLaser, currentSpecimen);
        }

        // Laser Position along trigonometric circle in XY plane centered on specimen
        const objHeight = getSpecimenHeight(currentSpecimen);
        const targetY = boxH + 0.005 + objHeight / 2;
        const alphaRad = (currentLaser.alpha * Math.PI) / 180;
        const RL = 2.2; // Radial distance from target

        // Laser Head Center Position
        const lx = RL * Math.cos(alphaRad);
        const ly = targetY + RL * Math.sin(alphaRad);
        const lz = 0;

        laserHeadGroup.position.set(lx, ly, lz);

        // Định hướng góc xoay đèn chính xác tuyệt đối trên mặt phẳng XY:
        // Triệt tiêu hoàn toàn hiện tượng gimbal lock/vặn xoắn góc khi đèn ở góc 90 độ
        laserHeadGroup.rotation.set(0, 0, alphaRad - Math.PI / 2);

        // Ẩn/Hiện thân đèn, cột sáng và đường viền cột sáng theo trạng thái
        laserHeadGroup.visible = isLampVisible;
        beamMesh.visible = isLampVisible && currentLaser.isOn;
        beamSilhouetteGroup.visible = isLampVisible && currentLaser.isOn;

        if (isLampVisible && currentLaser.isOn) {
          // --- Custom Dynamic Geometry: Aperture to Floor Mesh / Infinite Beam Column ---
          const sinAlpha = Math.max(0.01, Math.sin(alphaRad));
          const cosAlpha = Math.cos(alphaRad);

          const dx = -cosAlpha;
          const dy = -sinAlpha;
          const dz = 0;

          const ux = sinAlpha;
          const uy = -cosAlpha;
          const uz = 0;

          const vx = 0;
          const vy = 0;
          const vz = 1;

          const halfHousing = housingH / 2;
          const ax = lx + dx * halfHousing;
          const ay = ly + dy * halfHousing;
          const az = lz;

          const floorY = 0.004;

          const isInfiniteBeam = !currentIsBoxVisible;
          const L_infinite = 80.0;

          const posAttr = beamBufferGeo.attributes.position as THREE.BufferAttribute;
          const posArray = posAttr.array as Float32Array;

          for (let i = 0; i <= NUM_SEGMENTS; i++) {
            const phi = (i / NUM_SEGMENTS) * Math.PI * 2;
            const cosP = Math.cos(phi);
            const sinP = Math.sin(phi);

            const px = ax + beamRadius * (cosP * ux + sinP * vx);
            const py = ay + beamRadius * (cosP * uy + sinP * vy);
            const pz = az + beamRadius * (cosP * uz + sinP * vz);

            const topIdx = i * 2 * 3;
            posArray[topIdx] = px;
            posArray[topIdx + 1] = py;
            posArray[topIdx + 2] = pz;

            const botIdx = (i * 2 + 1) * 3;
            if (isInfiniteBeam) {
              posArray[botIdx] = px + dx * L_infinite;
              posArray[botIdx + 1] = py + dy * L_infinite;
              posArray[botIdx + 2] = pz + dz * L_infinite;
            } else {
              const t = (py - floorY) / sinAlpha;
              posArray[botIdx] = px + dx * t;
              posArray[botIdx + 1] = floorY;
              posArray[botIdx + 2] = pz + dz * t;
            }
          }

          posAttr.needsUpdate = true;
          beamBufferGeo.computeVertexNormals();

          // Cập nhật 2 đường sinh viền bao ngoài cột sáng (Silhouette boundary lines)
          beamDir.set(dx, dy, dz);
          camera.getWorldDirection(camDir);

          silVec.crossVectors(beamDir, camDir);
          const silLen = silVec.length();

          if (silLen > 0.0001) {
            silVec.divideScalar(silLen);

            const pLeftX = ax + silVec.x * beamRadius;
            const pLeftY = ay + silVec.y * beamRadius;
            const pLeftZ = az + silVec.z * beamRadius;

            const pRightX = ax - silVec.x * beamRadius;
            const pRightY = ay - silVec.y * beamRadius;
            const pRightZ = az - silVec.z * beamRadius;

            let qLeftX: number, qLeftY: number, qLeftZ: number;
            let qRightX: number, qRightY: number, qRightZ: number;

            if (isInfiniteBeam) {
              qLeftX = pLeftX + dx * L_infinite;
              qLeftY = pLeftY + dy * L_infinite;
              qLeftZ = pLeftZ + dz * L_infinite;

              qRightX = pRightX + dx * L_infinite;
              qRightY = pRightY + dy * L_infinite;
              qRightZ = pRightZ + dz * L_infinite;
            } else {
              const tLeft = (pLeftY - floorY) / sinAlpha;
              qLeftX = pLeftX + dx * tLeft;
              qLeftY = floorY;
              qLeftZ = pLeftZ + dz * tLeft;

              const tRight = (pRightY - floorY) / sinAlpha;
              qRightX = pRightX + dx * tRight;
              qRightY = floorY;
              qRightZ = pRightZ + dz * tRight;
            }

            silPositions[0] = pLeftX;
            silPositions[1] = pLeftY;
            silPositions[2] = pLeftZ;
            silPositions[3] = qLeftX;
            silPositions[4] = qLeftY;
            silPositions[5] = qLeftZ;

            silPositions[6] = pRightX;
            silPositions[7] = pRightY;
            silPositions[8] = pRightZ;
            silPositions[9] = qRightX;
            silPositions[10] = qRightY;
            silPositions[11] = qRightZ;

            (silGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            beamSilhouetteGroup.visible = true;
          } else {
            beamSilhouetteGroup.visible = false;
          }

          beamMat.opacity = 0.80 * currentLaser.intensity;
          silMat.opacity = Math.min(1.0, 0.75 + 0.25 * currentLaser.intensity);
          silContrastMat.opacity = 0.65 * currentLaser.intensity;
        }

        renderer.render(scene, camera);

        if (!isInitialRenderDone) {
          isInitialRenderDone = true;
          onReady?.();
        }

        // Tạm dừng vẽ khi các thao tác kéo/xoay đã dừng hẳn (Damping kết thúc)
        if (!controlsMoved) {
          isDirty = false;
        }
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      const asp = width / height;
      const fH = Math.max(6.4, 10.2 / asp);
      const hH = fH / 2;
      const hW = hH * asp;
      camera.left = -hW;
      camera.right = hW;
      camera.top = hH;
      camera.bottom = -hH;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      requestRender();
    };

    window.addEventListener('resize', handleResize);

    // Dynamic High-DPI monitor resolution listener
    const updatePixelRatio = () => {
      const pr = isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      if (renderer.getPixelRatio() !== pr) {
        renderer.setPixelRatio(pr);
        handleResize();
      }
    };

    let dprQuery: MediaQueryList | null = null;
    const listenDPR = () => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        dprQuery.addEventListener(
          'change',
          () => {
            updatePixelRatio();
            listenDPR();
          },
          { once: true }
        );
      }
    };
    listenDPR();

    // Chống sập WebGL (Context Loss & Restoration Protection)
    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animationFrameId);
    };
    const onContextRestored = () => {
      handleResize();
      requestRender();
      tick();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.removeEventListener('change', requestRender);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      disposeHierarchy(scene);
      renderer.dispose();
      pmremGenerator.dispose();
      roomEnvTexture.dispose();
      floorTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <div ref={containerRef} className="w-full h-full touch-none" />
    </div>
  );
};
