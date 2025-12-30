# Sci-Fi Landing Page

A futuristic, space-themed landing page with HUD-style interface inspired by sci-fi terminals and holographic displays.

## Features

### 🎨 Visual Elements

1. **Animated Starfield Background**
   - 200 particles moving dynamically
   - Pulsating opacity for depth effect
   - Canvas-based animation for performance

2. **Space Gradient**
   - Deep space colors (black to teal)
   - Multiple radial gradients for depth
   - Animated gradient shifting

3. **Scanline Effect**
   - Retro CRT monitor aesthetic
   - Subtle opacity for authenticity
   - Animated movement

4. **HUD Frame**
   - Cyan glowing corner brackets (#2ED1C7)
   - Four corners with pulsing animation
   - Thin border lines connecting brackets
   - Staggered animation timing for visual interest

5. **HUD Information Panels**
   - Top-left: System codes and protocols
   - Top-right: Status indicators
   - Bottom-left: Version info
   - Bottom-right: Terminal access
   - Interactive hover effects

### 🎯 Main Content

1. **Title Section**
   - "SATELLITE AI PLATFORM" in large Orbitron font
   - Gradient text effect (cyan to teal)
   - Glowing drop shadow
   - Decorative lines with diamond accents
   - Staggered slide-in animation

2. **Subtitle**
   - Three key features with separators
   - Hover effects on each item
   - Responsive wrapping on mobile

3. **Info Panel**
   - Mission brief description
   - Three statistics with icons:
     - 99.9% Accuracy
     - <2s Response Time
     - 24/7 Uptime
   - Glassmorphism effect
   - Hover animations on stats

4. **GET STARTED Button**
   - Large, prominent call-to-action
   - Glowing cyan border
   - Multiple hover effects:
     - Scale up (1.05x)
     - Glow expansion
     - Border animation
     - Icon movement
   - Routes to main application (/)

5. **Additional Info**
   - "DRISHTI POWERED" and "VYOMA INTERFACE" badges
   - Subtle styling

6. **Pulse Ring**
   - Animated expanding ring from center
   - Adds dynamic movement

## Technical Details

### Files
- `/app/landing/page.tsx` - Main React component
- `/app/landing/landing.css` - Complete styling

### Key Technologies
- **Next.js 14+** with App Router
- **TypeScript**
- **CSS3 Animations**
- **HTML5 Canvas** for particle effects
- **Orbitron Font** from Google Fonts

### CSS Features
- Custom keyframe animations
- Glassmorphism effects
- Box shadows and glows
- Gradient effects
- Responsive breakpoints
- Hover transitions

### Animations
1. **Fade-in animations** - Staggered entrance for all elements
2. **Glow pulse** - Breathing effect on borders and text
3. **Scanline movement** - Continuous vertical scroll
4. **Particle animation** - Canvas-based star movement
5. **Hover effects** - Scale, glow, and transform transitions
6. **Button interactions** - Multi-layered hover state

## Navigation

The "GET STARTED" button navigates to the main application:
```typescript
const handleGetStarted = () => {
  router.push('/');
};
```

To change the destination, modify the path in `page.tsx`.

## Customization

### Colors
Primary color scheme uses cyan/teal:
- `#2ED1C7` - Main cyan
- `#14b8a6` - Secondary teal
- `#0d9488` - Dark teal

To change colors, search and replace these hex values in `landing.css`.

### Typography
Uses **Orbitron** font family. To change:
1. Update the `@import` URL in `landing.css`
2. Replace `font-family: 'Orbitron'` with your chosen font

### Content
Edit text in `page.tsx`:
- Title: Line 137-140
- Subtitle: Line 146-152
- Mission brief: Line 161-164
- Stats: Line 166-180

## Responsive Breakpoints

- **Desktop**: 1024px+
- **Tablet**: 768px - 1024px
- **Mobile**: 480px - 768px
- **Small Mobile**: < 480px

All elements are fully responsive with appropriate scaling.

## Performance

- Canvas animation runs at 60fps
- CSS animations use GPU acceleration
- No external dependencies beyond Next.js
- Lightweight (< 100KB total)

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- High contrast text
- ARIA labels (can be enhanced)
- Responsive touch targets

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Usage

1. Navigate to `/landing` in your browser
2. View the sci-fi interface
3. Click "GET STARTED" to enter the main application
4. Hover over elements to see interactive effects

## Future Enhancements

Potential additions:
- Audio effects on interactions
- More particle types (debris, comets)
- Parallax scrolling effects
- Video background option
- Data stream animations
- Terminal typing effect
- More HUD elements
- Loading progress indicator
