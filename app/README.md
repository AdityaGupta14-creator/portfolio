# 3D Brownstone City Portfolio (Modern Stack)

Interactive 3D brownstone avenue portfolio for **Aditya Gupta**, migrated from vanilla Three.js to a modern production stack.

## Tech Stack
* **Build Tool & Framework:** Vite + React 19 + TypeScript (strict mode enabled)
* **3D Engine:** React Three Fiber (R3F) v9 + `@react-three/drei` + Three.js
* **State Management:** Zustand
* **Styling & Tokens:** Tailwind CSS with CSS Variables design tokens
* **Motion & Animation:** GSAP + Framer Motion
* **Icons:** Lucide React

---

## Folder Structure
```
app/
├── src/
│   ├── components/     # UI Overlays, Header, LoadingScreen, Toast
│   ├── scene/          # 3D R3F components (CityCanvas, BasicCityScene)
│   ├── store/          # Zustand global state (useAppStore)
│   ├── data/           # Typed content & portfolio data (content.ts)
│   ├── hooks/          # Custom hooks (useScrollProgress)
│   └── styles/         # Global styles & design tokens (index.css)
├── public/             # Static public assets
├── index.html          # HTML entry point with font preconnects
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript configuration (strict mode)
├── tailwind.config.js  # Tailwind CSS theme extensions
└── vite.config.ts      # Vite configuration
```

---

## Run Instructions

### 1. Install Dependencies
```bash
cd app
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Production Build & Preview
```bash
npm run build
npm run preview
```

---

## Features & Accessibility
* **Dual View Modes:**
  * **Interactive 3D Avenue:** Full WebGL camera scroll descent, dynamic lighting, brownstone blocks, vehicles, walking pedestrians, and articulated host avatar.
  * **Classic 2D View:** Fast, accessible single-page layout with section jumping, reduced motion support, and minimal resource usage.
* **Responsive Bottom Sheet:** On mobile devices, building inspection drawers seamlessly adapt into smooth bottom sheets with grab handles and overscroll protection.
* **Intelligent Performance Auto-Scaling:** Automatically caps DPR to 2 (or 1 on low FPS), monitors render time, and falls back to unshadowed rendering if continuous framerate dips below 40 FPS.
* **Keyboard & Focus Navigation:** Full `Escape` to close drawers/menus, `ArrowLeft`/`ArrowRight` to step through buildings, and accessible focus rings.
* **Atmospheric Theme Switch:** Smooth transitions between daylight street and warm dusk Golden Evening with glowing windows and lanterns.

---

## Content Customization
To customize your personal bio, projects, skills, or resume timeline, edit:
```
src/data/content.ts
```
All fields are strongly typed and annotated with `// TODO:` markers.

