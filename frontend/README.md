# Vyom Interface

> The web interface for **DRISHTI** (Deep Remote-sensing Intelligence System for Holistic Task Integration)

Vyom Interface is the frontend component of Drishti, a scalable Remote Sensing Vision-Language Model (RS-VLM) that unifies image-, region-, and pixel-level tasks. Built with **Next.js 16**, it provides an intuitive interface for interacting with the Drishti ML pipeline for remote sensing image analysis.

## Features

- **Remote Sensing Image Analysis** - Upload and analyze ultra-high-resolution satellite/aerial imagery
- **Interactive Chat Interface** - Natural language queries for VQA and captioning via EarthMind
- **Precise Localization** - RemoteSAM guided localization using oriented bounding boxes
- **Multimodal Support** - Handle heterogeneous modalities including optical and SAR imagery
- **Efficient Processing** - Powered by Spatial Token Pruning (STP) for up to 50% visual compute reduction

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI**: React 19
- **Markdown**: react-markdown with remark-gfm

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main application page
│   ├── globals.css         # Global styles
│   └── landing/            # Landing page
│       ├── page.tsx
│       └── landing.css
├── components/             # React components
│   ├── ChatbotPanel.tsx    # Chat interface component
│   ├── ImagePanel.tsx      # Image display/upload component
│   ├── OceanPlanet.tsx     # Visual component
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── Starfield.tsx       # Background visual effect
│   └── lib/                # Component utilities
├── lib/                    # Shared utilities
│   └── api.ts              # API client for backend communication
├── types/                  # TypeScript type definitions
│   └── api.ts              # API types
├── public/                 # Static assets
├── Dockerfile              # Docker configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── next.config.ts          # Next.js configuration
├── postcss.config.mjs      # PostCSS configuration
└── eslint.config.mjs       # ESLint configuration
```

## Setup Instructions

### Prerequisites

- Node.js 20 or higher
- pnpm (recommended) or npm

### Using pnpm (Recommended)

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The application will be available at `http://localhost:3000`.

## Docker Setup (Recommended for Production)

Docker provides the most consistent and reliable way to run the Vyom Interface.

### Build and Run with Docker

```bash
# Navigate to the frontend directory
cd frontend

# Build the Docker image
docker build -t vyom-interface .

# Run the container
docker run -p 3000:3000 vyom-interface
```

### Using Docker Compose (with Backend)

If running the full Drishti stack, use the docker-compose from the backend:

```bash
# From the project root
cd backend
docker-compose up --build
```

### Docker Image Details

The Dockerfile uses a multi-stage build for optimal image size:

1. **Builder stage**: Installs dependencies and builds the Next.js application
2. **Runner stage**: Minimal Node.js runtime with only production artifacts

```dockerfile
# Key features:
# - Node.js 20 base image
# - pnpm for fast, efficient package management
# - Production-optimized build
# - Exposed on port 3000
```

### Environment Variables

Create a `.env.local` file for local development or set environment variables in your Docker configuration:

```env
# Backend API URL (adjust based on your setup)
NEXT_PUBLIC_API_URL=http://localhost:8000
```
