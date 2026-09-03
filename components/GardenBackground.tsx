"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GardenAudio } from "./gardenAudio";

/**
 * GardenBackground
 * ----------------------------------------------------------------------
 * A full-viewport, interactive, animated garden scene rendered on
 * <canvas>, meant to sit behind your page content (position: fixed,
 * z-index: -1). Pure client-side, no external images or audio files —
 * safe to use with `next build && next export` (static Next.js sites).
 *
 * Interactions:
 *  - Move the mouse: butterflies flee, grass leans away, birds startle.
 *  - Click on the grass: plants a new flower where you clicked.
 *  - Sound toggle button: starts/stops a procedurally generated
 *    birdsong + cricket + wind soundscape (Web Audio API).
 *
 * Props let you tune density and disable the built-in sound button if
 * you'd rather control audio from your own UI.
 */

type GardenBackgroundProps = {
  className?: string;
  birdCount?: number;
  butterflyCount?: number;
  showSoundToggle?: boolean;
};

type Butterfly = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  flap: number;
  speed: number;
  hue: number;
};

type Bird = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseY: number;
  amp: number;
  phase: number;
  flap: number;
  size: number;
  spooked: number;
};

type Flower = {
  x: number;
  y: number;
  hue: number;
  size: number;
  swayPhase: number;
};

type Blade = {
  x: number;
  height: number;
  phase: number;
  hue: number;
};

const GROUND_RATIO = 0.82; // grass line as a fraction of canvas height

export default function GardenBackground({
  className,
  birdCount = 3,
  butterflyCount = 7,
  showSoundToggle = true,
}: GardenBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<GardenAudio | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const stateRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    mouse: { x: -9999, y: -9999 },
    butterflies: [] as Butterfly[],
    birds: [] as Bird[],
    flowers: [] as Flower[],
    blades: [] as Blade[],
    clouds: [] as { x: number; y: number; scale: number; speed: number }[],
  });

  const initScene = useCallback(
    (width: number, height: number) => {
      const s = stateRef.current;
      const groundY = height * GROUND_RATIO;

      s.butterflies = Array.from({ length: butterflyCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * groundY * 0.8,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        angle: 0,
        flap: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        hue: [330, 45, 200, 20][Math.floor(Math.random() * 4)],
      }));

      s.birds = Array.from({ length: birdCount }, (_, i) => ({
        x: Math.random() * width,
        y: 40 + Math.random() * (groundY * 0.35),
        vx: 0.8 + Math.random() * 0.9,
        vy: 0,
        baseY: 0,
        amp: 10 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        flap: Math.random() * Math.PI * 2,
        size: 8 + Math.random() * 5,
        spooked: 0,
      })).map((b) => ({ ...b, baseY: b.y }));

      s.flowers = Array.from({ length: Math.floor(width / 70) }, () => ({
        x: Math.random() * width,
        y: groundY + Math.random() * (height - groundY) * 0.6,
        hue: [340, 50, 280, 10, 200][Math.floor(Math.random() * 5)],
        size: 5 + Math.random() * 5,
        swayPhase: Math.random() * Math.PI * 2,
      }));

      s.blades = Array.from({ length: Math.floor(width / 8) }, (_, i) => ({
        x: (i / Math.floor(width / 8)) * width + (Math.random() - 0.5) * 8,
        height: 18 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        hue: 95 + Math.random() * 30,
      }));

      s.clouds = Array.from({ length: 4 }, () => ({
        x: Math.random() * width,
        y: 30 + Math.random() * (height * 0.25),
        scale: 0.6 + Math.random() * 1,
        speed: 0.08 + Math.random() * 0.1,
      }));
    },
    [birdCount, butterflyCount]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      s.width = width;
      s.height = height;
      s.dpr = dpr;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initScene(width, height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      s.mouse.x = e.clientX;
      s.mouse.y = e.clientY;
    };
    const handlePointerLeave = () => {
      s.mouse.x = -9999;
      s.mouse.y = -9999;
    };
    const handleClick = (e: MouseEvent) => {
      const groundY = s.height * GROUND_RATIO;
      if (e.clientY > groundY - 10) {
        s.flowers.push({
          x: e.clientX,
          y: Math.max(e.clientY, groundY + 6),
          hue: Math.random() * 360,
          size: 6 + Math.random() * 5,
          swayPhase: Math.random() * Math.PI * 2,
        });
        if (s.flowers.length > 120) s.flowers.shift();
      } else {
        // clicking the sky startles a nearby butterfly into a little burst
        s.butterflies.forEach((b) => {
          const d = Math.hypot(b.x - e.clientX, b.y - e.clientY);
          if (d < 120) {
            b.vx += ((b.x - e.clientX) / (d || 1)) * 2;
            b.vy += ((b.y - e.clientY) / (d || 1)) * 2;
          }
        });
      }
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseleave", handlePointerLeave);
    window.addEventListener("click", handleClick);

    let raf = 0;

    const draw = () => {
      const { width, height } = s;
      const groundY = height * GROUND_RATIO;
      s.time += 1;
      const t = s.time * 0.016;

      // ---- sky ----
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#8fd3f4");
      sky.addColorStop(0.6, "#c7ecee");
      sky.addColorStop(1, "#eafff0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, groundY + 2);

      // sun
      const sunX = width * 0.86;
      const sunY = height * 0.14;
      const sunPulse = 46 + Math.sin(t * 0.6) * 3;
      const sunGlow = ctx.createRadialGradient(
        sunX,
        sunY,
        0,
        sunX,
        sunY,
        sunPulse * 2.4
      );
      sunGlow.addColorStop(0, "rgba(255, 244, 190, 0.9)");
      sunGlow.addColorStop(1, "rgba(255, 244, 190, 0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunPulse * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff2b0";
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunPulse * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // clouds
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      s.clouds.forEach((c) => {
        c.x += c.speed;
        if (c.x - 90 * c.scale > width) c.x = -90 * c.scale;
        drawCloud(ctx, c.x, c.y, c.scale);
      });

      // ---- ground ----
      const ground = ctx.createLinearGradient(0, groundY, 0, height);
      ground.addColorStop(0, "#6fbf73");
      ground.addColorStop(1, "#3f8f4f");
      ctx.fillStyle = ground;
      ctx.fillRect(0, groundY, width, height - groundY);

      // flowers (behind grass tips so blades slightly overlap stems)
      s.flowers.forEach((f) => {
        const sway = Math.sin(t * 1.2 + f.swayPhase) * 3;
        drawFlower(ctx, f.x + sway, f.y, f.size, f.hue);
      });

      // grass blades, extra sway near the mouse (wind push)
      s.blades.forEach((b) => {
        const distToMouse = Math.abs(b.x - s.mouse.x);
        const mouseWind =
          distToMouse < 160 ? (1 - distToMouse / 160) * 26 : 0;
        const sway =
          Math.sin(t * 1.6 + b.phase) * 6 +
          mouseWind * Math.sign(b.x - s.mouse.x || 1);
        drawBlade(ctx, b.x, groundY, b.height, sway, b.hue);
      });

      // ---- birds ----
      s.birds.forEach((bird) => {
        const dMouse = Math.hypot(bird.x - s.mouse.x, bird.y - s.mouse.y);
        if (dMouse < 140) bird.spooked = 1;
        bird.spooked *= 0.96;

        const speedMul = 1 + bird.spooked * 2.2;
        bird.x += bird.vx * speedMul;
        bird.y =
          bird.baseY +
          Math.sin(t * 1.4 + bird.phase) * bird.amp -
          bird.spooked * 40;
        bird.flap += 0.35 + bird.spooked * 0.4;

        if (bird.x - 40 > width) {
          bird.x = -40;
          bird.baseY = 40 + Math.random() * (groundY * 0.35);
        }
        drawBird(ctx, bird.x, bird.y, bird.size, bird.flap);
      });

      // ---- butterflies ----
      s.butterflies.forEach((b) => {
        // gentle wander
        b.vx += (Math.random() - 0.5) * 0.15;
        b.vy += (Math.random() - 0.5) * 0.15;

        // flee the cursor
        const dx = b.x - s.mouse.x;
        const dy = b.y - s.mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < 110) {
          const force = (1 - d / 110) * 1.8;
          b.vx += (dx / (d || 1)) * force;
          b.vy += (dy / (d || 1)) * force;
        }

        // keep roughly within the sky area, above the grass
        if (b.y > groundY - 20) b.vy -= 0.3;
        if (b.y < 10) b.vy += 0.3;
        if (b.x < 0) b.vx += 0.3;
        if (b.x > width) b.vx -= 0.3;

        const speed = Math.hypot(b.vx, b.vy);
        const maxSpeed = b.speed * 3.2;
        if (speed > maxSpeed) {
          b.vx = (b.vx / speed) * maxSpeed;
          b.vy = (b.vy / speed) * maxSpeed;
        }
        // damping back toward cruising speed
        b.vx *= 0.98;
        b.vy *= 0.98;

        b.x += b.vx;
        b.y += b.vy;
        b.angle = Math.atan2(b.vy, b.vx);
        b.flap += 0.4 + Math.min(speed, 3) * 0.15;

        drawButterfly(ctx, b);
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("click", handleClick);
    };
  }, [initScene]);

  useEffect(() => {
    audioRef.current = new GardenAudio();
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const on = audioRef.current?.toggle();
    setSoundOn(!!on);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
          pointerEvents: "none",
          display: "block",
        }}
        aria-hidden="true"
      />
      {showSoundToggle && (
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Mute garden sounds" : "Play garden sounds"}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: soundOn ? "#3f8f4f" : "rgba(0,0,0,0.35)",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
          title={soundOn ? "Mute garden sounds" : "Play garden sounds"}
        >
          {soundOn ? "🔊" : "🔈"}
        </button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// drawing helpers
// ---------------------------------------------------------------------

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.arc(24, -8, 18, 0, Math.PI * 2);
  ctx.arc(46, 0, 22, 0, Math.PI * 2);
  ctx.arc(22, 10, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlade(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  sway: number,
  hue: number
) {
  ctx.strokeStyle = `hsl(${hue}, 55%, 35%)`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, groundY + 4);
  ctx.quadraticCurveTo(x + sway * 0.5, groundY - height * 0.5, x + sway, groundY - height);
  ctx.stroke();
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hue: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "hsl(110, 40%, 30%)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, size * 1.6);
  ctx.stroke();

  ctx.fillStyle = `hsl(${hue}, 80%, 65%)`;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(angle) * size * 0.6,
      Math.sin(angle) * size * 0.6,
      size * 0.55,
      size * 0.32,
      angle,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = "hsl(50, 90%, 60%)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flap: number
) {
  const wing = Math.sin(flap) * size * 0.9;
  ctx.strokeStyle = "rgba(40,40,50,0.85)";
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - size, y - wing);
  ctx.quadraticCurveTo(x, y + size * 0.3, x + size, y - wing);
  ctx.stroke();
}

function drawButterfly(ctx: CanvasRenderingContext2D, b: Butterfly) {
  const wingSpan = 7 + Math.sin(b.flap) * 5;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);

  ctx.fillStyle = `hsla(${b.hue}, 85%, 65%, 0.9)`;
  ctx.beginPath();
  ctx.ellipse(-3, -wingSpan * 0.4, 5, wingSpan, Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, -wingSpan * 0.4, 5, wingSpan, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(40,30,20,0.8)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
