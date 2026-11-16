"use client";

/**
 * 3D sensor map (PLAN §11): 325 columns in ONE InstancedMesh, height + colour = level.
 * Theme changes recolour materials/lights and rebuild only the GridHelper; the Canvas stays.
 * frameloop="demand": frames are requested only while lerping, auto-rotating or interacting.
 *
 * Freeway labels and the hover card are plain DOM in an overlay, moved each frame by projecting
 * their 3D anchor through the camera (drei <Html> would create one React root per label).
 */

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { COLUMN_HEIGHT } from "@/lib/levels";
import { SCENE, type ThemeName } from "@/lib/theme-colors";

import { SensorTooltip } from "./SensorTooltip";
import { MAP_D, MAP_W, type MapSensor, type MapViewProps } from "./types";

// three r155+ uses physical light units; ×π keeps the brightness of the design prototype (r149)
const LIGHT_SCALE = Math.PI;
const LERP = 0.12;
const RESUME_ROTATE_MS = 3000;
const CAM_ANGLE = -0.35;
const CAM_RADIUS = 14.5;
const CAM_HEIGHT = 9.2;
const TARGET: [number, number, number] = [0, 0.2, 0.4];
const MAX_DISTANCE = 22;
const NARROW_ASPECT = 1.3; // below this width/height ratio the camera moves back

type Vec3 = [number, number, number];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

const toScene = (s: { x: number; y: number }): [number, number] => [(s.x / 100 - 0.5) * MAP_W, (s.y / 100 - 0.5) * MAP_D];

/** Each frame: project 3D anchors to pixels and move the matching overlay elements. */
function OverlayProjector({ anchors, els }: { anchors: RefObject<(Vec3 | null)[]>; els: RefObject<(HTMLElement | null)[]> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    anchors.current.forEach((a, i) => {
      const el = els.current[i];
      if (!el) return;
      if (!a) {
        el.style.visibility = "hidden";
        return;
      }
      v.set(a[0], a[1], a[2]).project(camera);
      const behind = v.z > 1;
      el.style.visibility = behind ? "hidden" : "visible";
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    });
  });
  return null;
}

function Columns({
  sensors,
  theme,
  reduceMotion,
  hovered,
  setHovered,
  onSelect,
  anchors,
}: {
  sensors: MapSensor[];
  theme: ThemeName;
  reduceMotion: boolean;
  hovered: number | null;
  setHovered: (i: number | null) => void;
  onSelect: (id: number) => void;
  anchors: RefObject<(Vec3 | null)[]>;
}) {
  const cols = useRef<THREE.InstancedMesh>(null);
  const pads = useRef<THREE.InstancedMesh>(null);
  const padMat = useRef<THREE.MeshBasicMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  const n = sensors.length;

  const pos = useMemo(() => sensors.map(toScene), [sensors]);
  const targets = useMemo(() => sensors.map((s) => (s.level == null ? 0.02 : COLUMN_HEIGHT[s.level])), [sensors]);
  const heights = useRef<Float32Array>(new Float32Array(0));
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const color = useMemo(() => new THREE.Color(), []);
  // unit column with its base at y=0, so scale.y = height (PLAN §11.2)
  const colGeo = useMemo(() => new THREE.BoxGeometry(0.12, 1, 0.12).translate(0, 0.5, 0), []);
  // invisible, wider "hit box" per column: a 0,12-wide column is only a few pixels on screen
  const hitGeo = useMemo(() => new THREE.BoxGeometry(0.32, 1, 0.32).translate(0, 0.5, 0), []);
  const hits = useRef<THREE.InstancedMesh>(null);
  useEffect(
    () => () => {
      colGeo.dispose();
      hitGeo.dispose();
    },
    [colGeo, hitGeo],
  );

  const writeMatrices = () => {
    const mesh = cols.current;
    const hit = hits.current;
    if (!mesh || !hit) return;
    for (let i = 0; i < n; i++) {
      const h = heights.current[i];
      m4.makeScale(1, Math.max(0.02, h), 1);
      m4.setPosition(pos[i][0], 0, pos[i][1]);
      mesh.setMatrixAt(i, m4);
      m4.makeScale(1, Math.max(0.35, h + 0.1), 1); // short (Lancar) columns still get a usable target
      m4.setPosition(pos[i][0], 0, pos[i][1]);
      hit.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    hit.instanceMatrix.needsUpdate = true;
    hit.computeBoundingSphere();
  };

  // pads + first heights (start at the target: no grow-in animation on first paint)
  useLayoutEffect(() => {
    if (heights.current.length !== n) heights.current = Float32Array.from(targets);
    const p = pads.current;
    if (p) {
      pos.forEach(([x, z], i) => p.setMatrixAt(i, m4.makeTranslation(x, 0.005, z)));
      p.instanceMatrix.needsUpdate = true;
    }
    writeMatrices();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, n]);

  // colours follow level + theme; reduced motion jumps straight to the target height
  useLayoutEffect(() => {
    const mesh = cols.current;
    if (!mesh) return;
    const pal = SCENE[theme];
    sensors.forEach((s, i) => {
      color.setHex(s.level == null ? pal.pad : pal.columns[s.level]);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    padMat.current?.color.setHex(pal.pad);
    if (reduceMotion) {
      heights.current = Float32Array.from(targets);
      writeMatrices();
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors, targets, theme, reduceMotion]);

  useFrame(() => {
    let moving = false;
    const h = heights.current;
    for (let i = 0; i < n; i++) {
      const d = targets[i] - h[i];
      if (Math.abs(d) > 0.002) {
        h[i] += d * LERP;
        moving = true;
      } else {
        h[i] = targets[i];
      }
    }
    if (moving) {
      writeMatrices();
      invalidate(); // keep animating until every column settles
    }
    // the hover card is the last overlay anchor (OverlayProjector runs after this component)
    anchors.current[anchors.current.length - 1] = hovered != null ? [pos[hovered][0], h[hovered] + 0.2, pos[hovered][1]] : null;
  });

  const pick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId != null && e.instanceId !== hovered) {
      setHovered(e.instanceId);
      invalidate();
    }
  };
  const leave = () => {
    setHovered(null);
    invalidate();
  };
  // Click = pointerdown + pointerup on the same column with < 5 px movement. R3F's onClick never
  // fires here because OrbitControls captures the pointer on pointerdown.
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    press.current = e.instanceId != null ? { id: e.instanceId, x: e.clientX, y: e.clientY } : null;
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = press.current;
    press.current = null;
    if (!p || e.instanceId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) return; // a drag
    onSelect(sensors[p.id].id);
  };

  return (
    <>
      <instancedMesh ref={pads} args={[undefined, undefined, n]} raycast={() => null}>
        <cylinderGeometry args={[0.1, 0.1, 0.01, 12]} />
        <meshBasicMaterial ref={padMat} />
      </instancedMesh>
      <instancedMesh ref={cols} args={[colGeo, undefined, n]} raycast={() => null}>
        <meshStandardMaterial roughness={0.55} metalness={0.05} />
      </instancedMesh>
      {/* pointer events only on the invisible hit boxes (drawn with colour & depth writes off) */}
      <instancedMesh
        ref={hits}
        args={[hitGeo, undefined, n]}
        onPointerMove={pick}
        onPointerOut={leave}
        onPointerDown={down}
        onPointerUp={up}
      >
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

function Scene({
  sensors,
  theme,
  reduceMotion,
  hovered,
  setHovered,
  onSelect,
  anchors,
  els,
}: {
  sensors: MapSensor[];
  theme: ThemeName;
  reduceMotion: boolean;
  hovered: number | null;
  setHovered: (i: number | null) => void;
  onSelect: (id: number) => void;
  anchors: RefObject<(Vec3 | null)[]>;
  els: RefObject<(HTMLElement | null)[]>;
}) {
  const pal = SCENE[theme];
  const [rotating, setRotating] = useState(!reduceMotion);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  // pause while a column is hovered, so it doesn't slide out from under the cursor before the click
  const spin = rotating && hovered == null;

  useFrame(() => {
    if (spin) invalidate(); // keep frames flowing while auto-rotating (frameloop="demand")
  });

  // Narrow panels (phones): the vertical FOV is fixed, so pull the camera back to keep the whole
  // network in view, within the zoom limits of PLAN §11.2 (distance 10–22).
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    const base = Math.hypot(CAM_RADIUS, CAM_HEIGHT - TARGET[1]);
    const want = Math.min(MAX_DISTANCE, base * Math.max(1, NARROW_ASPECT / aspect));
    const t = new THREE.Vector3(...TARGET);
    const offset = camera.position.clone().sub(t);
    camera.position.copy(t.add(offset.setLength(want)));
    invalidate();
  }, [aspect, camera, invalidate]);

  useEffect(() => setRotating(!reduceMotion), [reduceMotion]);
  useEffect(() => () => clearTimeout(resume.current), []);
  useEffect(() => {
    gl.domElement.style.cursor = hovered != null ? "pointer" : "grab";
  }, [hovered, gl]);
  useEffect(() => invalidate(), [theme, invalidate]);

  return (
    <>
      <hemisphereLight args={[pal.sky, pal.gnd, pal.hemi * LIGHT_SCALE]} />
      <directionalLight position={[5, 10, 6]} intensity={pal.sun * LIGHT_SCALE} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[MAP_W + 1.2, MAP_D + 1.2]} />
        <meshStandardMaterial color={pal.ground} roughness={1} />
      </mesh>
      {/* GridHelper colours live in its vertices: rebuild it (and only it) when the theme changes */}
      <gridHelper key={theme} args={[12, 24, pal.gridA, pal.gridB]} position-y={0.002} />
      <Columns
        sensors={sensors}
        theme={theme}
        reduceMotion={reduceMotion}
        hovered={hovered}
        setHovered={setHovered}
        onSelect={onSelect}
        anchors={anchors}
      />
      <OverlayProjector anchors={anchors} els={els} />
      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping={false}
        minPolarAngle={0.6}
        maxPolarAngle={1.2}
        minDistance={10}
        maxDistance={MAX_DISTANCE}
        autoRotate={spin}
        // ~0.0018 rad/frame at 60 fps, same pace as the design prototype
        autoRotateSpeed={1}
        onStart={() => {
          clearTimeout(resume.current);
          setRotating(false);
        }}
        onEnd={() => {
          if (reduceMotion) return;
          resume.current = setTimeout(() => setRotating(true), RESUME_ROTATE_MS);
        }}
      />
    </>
  );
}

export default function SensorMap3D({
  sensors,
  fwys,
  horizon,
  onSelect,
  theme,
  showLabels = true,
}: MapViewProps & { theme: ThemeName; showLabels?: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);
  const labels = showLabels ? fwys : [];
  // overlay anchors: one per freeway label, plus the hover card at the end
  const anchors = useRef<(Vec3 | null)[]>([]);
  const els = useRef<(HTMLElement | null)[]>([]);
  anchors.current = [
    ...labels.map((f) => {
      const [x, z] = toScene(f);
      return [x, 0.05, z] as Vec3;
    }),
    anchors.current[labels.length] ?? null,
  ];
  const hs = hovered != null ? sensors[hovered] : null;

  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        flat
        gl={{ antialias: true, alpha: true }}
        camera={{
          fov: 32,
          near: 0.1,
          far: 200,
          position: [Math.sin(CAM_ANGLE) * CAM_RADIUS, CAM_HEIGHT, Math.cos(CAM_ANGLE) * CAM_RADIUS],
        }}
        aria-label="Peta 3D sensor: setiap sensor berupa kolom, makin tinggi dan makin merah berarti makin macet. Geser untuk memutar."
        role="img"
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene
          sensors={sensors}
          theme={theme}
          reduceMotion={reduceMotion}
          hovered={hovered}
          setHovered={setHovered}
          onSelect={onSelect}
          anchors={anchors}
          els={els}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {labels.map((f, i) => (
          <span
            key={f.label}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="absolute top-0 left-0 invisible"
          >
            <span className="mono inline-block -translate-x-1/2 -translate-y-1/2 rounded-md border border-border-strong bg-panel px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text-2 opacity-90">
              {f.label}
            </span>
          </span>
        ))}
        <div
          ref={(el) => {
            els.current[labels.length] = el;
          }}
          className="absolute top-0 left-0 z-20 invisible"
        >
          {hs && (
            <div className="-translate-x-1/2 -translate-y-[calc(100%+8px)]">
              <SensorTooltip s={hs} horizon={horizon} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
