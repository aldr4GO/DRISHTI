'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import './landing.css';

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Earth rotation parameters - positioned on right side
    let rotation = 0;
    const earthRadius = 200;
    const centerX = window.innerWidth * 0.75; // 75% from left (right side)
    const centerY = window.innerHeight / 2;

    // Create stars
    const stars: { x: number; y: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5,
        opacity: Math.random() * 0.5 + 0.5,
      });
    }

    const drawEarth = () => {
      // Draw background glow for better contrast
      const bgGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        earthRadius * 0.8,
        centerX,
        centerY,
        earthRadius * 1.5
      );
      bgGradient.addColorStop(0, 'rgba(0, 60, 55, 0.3)');
      bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, earthRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw Earth sphere - better visibility with subtle dark glow
      const gradient = ctx.createRadialGradient(
        centerX - 50,
        centerY - 50,
        0,
        centerX,
        centerY,
        earthRadius
      );
      gradient.addColorStop(0, 'rgba(16, 230, 182, 0.25)');
      gradient.addColorStop(0.4, 'rgba(16, 230, 182, 0.15)');
      gradient.addColorStop(0.7, 'rgba(0, 80, 70, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 40, 35, 0.1)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw orbit lines - more visible
      ctx.strokeStyle = 'rgba(16, 230, 182, 0.15)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + rotation;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          earthRadius + 40,
          earthRadius + 40,
          angle,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // Draw grid lines on Earth - more visible
      ctx.strokeStyle = 'rgba(16, 230, 182, 0.25)';
      ctx.lineWidth = 0.5;

      // Latitude lines
      for (let lat = -90; lat <= 90; lat += 30) {
        ctx.beginPath();
        const y = centerY + (lat / 90) * (earthRadius * 0.9);
        const width = Math.sqrt(earthRadius * earthRadius - Math.pow(lat / 90 * earthRadius, 2)) * 2;
        ctx.ellipse(centerX, y, width / 2, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < 360; lon += 30) {
        const angle = ((lon + rotation * 50) * Math.PI) / 180;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, earthRadius * Math.abs(Math.cos(angle)), earthRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach((star) => {
        ctx.fillStyle = `rgba(73, 225, 200, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw rotating Earth
      drawEarth();
      rotation += 0.002; // Slow rotation

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleGetStarted = () => {
    router.push('/');
  };

  return (
    <div className="landing-container-split">
      {/* Rotating Earth Background - Right Side */}
      <canvas ref={canvasRef} className="earth-canvas-right" />
      
      {/* Gradient Overlay */}
      <div className="gradient-overlay-split" />
      
      {/* Main Content - Left Side Centered */}
      <div className="content-wrapper-left-center">
        {/* Header Section */}
        <header className="header-section-compact">
          <h1 className="main-title-compact">DRISHTI</h1>
          <p className="subtitle-compact">
            Deep Remote-sensing Intelligence System for Holistic Task Integration
          </p>
          <div className="divider-line-compact"></div>
        </header>

        {/* Description Section */}
        <div className="description-section-compact">
          <p className="description-text-compact">
            A next-gen geospatial intelligence platform enabling fast, accurate interpretation of satellite imagery.
          </p>
          <p className="description-text-compact">
            From object detection to large-scale analysis, DRISHTI provides a powerful, intuitive way to observe and understand complex environments.
          </p>
          <p className="description-text-compact highlight-compact">
            Transform satellite data into insight—instantly.
          </p>
        </div>

        {/* Call to Action */}
        <div className="cta-section-compact">
          <button className="get-started-btn-compact" onClick={handleGetStarted}>
            <span className="btn-text-compact">Get Started</span>
            <svg className="btn-icon-compact" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Footer */}
        <footer className="footer-section-compact">
          <div className="footer-badges-compact">
            <span className="badge-compact">Powered by Vyoma Interface</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
