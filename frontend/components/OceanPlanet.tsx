'use client';

import { useEffect, useRef } from 'react';

export default function OceanPlanet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const setSize = () => {
      const size = Math.min(window.innerWidth * 0.4, window.innerHeight * 0.8);
      canvas.width = size;
      canvas.height = size;
    };
    setSize();
    window.addEventListener('resize', setSize);

    let animationId: number;
    let rotation = 0;

    const drawPlanet = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = canvas.width / 2.5;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Outer glow/atmosphere
      const atmosphereGradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.95,
        centerX, centerY, radius * 1.3
      );
      atmosphereGradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
      atmosphereGradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
      atmosphereGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = atmosphereGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Main planet sphere
      const planetGradient = ctx.createRadialGradient(
        centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.1,
        centerX, centerY, radius
      );
      planetGradient.addColorStop(0, '#0ea5e9');
      planetGradient.addColorStop(0.3, '#0284c7');
      planetGradient.addColorStop(0.6, '#0369a1');
      planetGradient.addColorStop(0.85, '#075985');
      planetGradient.addColorStop(1, '#0c4a6e');

      ctx.fillStyle = planetGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Swirling water patterns
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 8; i++) {
        const angle = (rotation + i * 45) * Math.PI / 180;
        const x = centerX + Math.cos(angle) * radius * 0.6;
        const y = centerY + Math.sin(angle) * radius * 0.6;
        const size = radius * (0.3 + Math.sin(rotation * 0.01 + i) * 0.1);

        const swirlGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        swirlGradient.addColorStop(0, 'rgba(125, 211, 252, 0.6)');
        swirlGradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.3)');
        swirlGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = swirlGradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Surface highlights (liquid reflections)
      const highlightGradient = ctx.createLinearGradient(
        centerX - radius * 0.5, centerY - radius * 0.5,
        centerX + radius * 0.5, centerY + radius * 0.5
      );
      highlightGradient.addColorStop(0, 'rgba(125, 211, 252, 0.4)');
      highlightGradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.6)');
      highlightGradient.addColorStop(1, 'rgba(125, 211, 252, 0.3)');

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = highlightGradient;
      ctx.beginPath();
      ctx.ellipse(
        centerX - radius * 0.2,
        centerY - radius * 0.3,
        radius * 0.6,
        radius * 0.3,
        -30 * Math.PI / 180,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;

      // Planet rim/edge darkening
      ctx.strokeStyle = 'rgba(2, 8, 23, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle scan lines overlay
      ctx.globalAlpha = 0.05;
      for (let y = 0; y < canvas.height; y += 2) {
        ctx.strokeStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Update rotation
      rotation += 0.2;

      animationId = requestAnimationFrame(drawPlanet);
    };

    drawPlanet();

    return () => {
      window.removeEventListener('resize', setSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="drop-shadow-2xl"
        style={{
          filter: 'drop-shadow(0 0 40px rgba(0, 240, 255, 0.3))',
        }}
      />
      
      {/* Planet Scanning Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[60%] h-[60%] border border-neon-cyan rounded-full opacity-20 animate-ping" style={{ animationDuration: '3s' }}></div>
        <div className="absolute w-[70%] h-[70%] border border-aqua-glow rounded-full opacity-15 animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
        <div className="absolute w-[80%] h-[80%] border border-ice-blue rounded-full opacity-10 animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>
    </div>
  );
}
