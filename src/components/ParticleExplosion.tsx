import { useEffect, useRef } from "react";

interface ParticleExplosionProps {
  x: number;
  y: number;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: "circle" | "square" | "cross" | "dash";
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
}

export default function ParticleExplosion({ x, y, onComplete }: ParticleExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fixed sizing matching full screen so position is direct viewport coordinate
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const colors = ["#121212", "#4E4E4E", "#8E8E8E", "#3A3A3A", "#D1D1D0"];
    const shapes: ("circle" | "square" | "cross" | "dash")[] = ["circle", "square", "cross", "dash"];

    // Spawn 28 high-fidelity crisp particles
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slightly drifting upward
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
        decay: 0.025 + Math.random() * 0.02,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let animationId: number;
    
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle gravity
        p.vx *= 0.96; // friction
        p.vy *= 0.96;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.strokeStyle = p.color;
          ctx.fillStyle = p.color;
          ctx.lineWidth = 1.2;

          if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === "square") {
            ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
          } else if (p.shape === "cross") {
            ctx.beginPath();
            ctx.moveTo(-p.size / 2, 0);
            ctx.lineTo(p.size / 2, 0);
            ctx.moveTo(0, -p.size / 2);
            ctx.lineTo(0, p.size / 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(-p.size / 2, -p.size / 4);
            ctx.lineTo(p.size / 2, p.size / 4);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      if (alive) {
        animationId = requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [x, y, onComplete]);

  return (
    <canvas
      id={`particle_canvas_${Date.now()}`}
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 mix-blend-difference"
    />
  );
}
