/**
 * PORTFOLIO DATA CONTENT & TYPE DEFINITIONS
 * All UI panels, 3D signage, and overlays read from this typed configuration.
 * Look for "TODO:" markers to update with your personalized information.
 */

export interface SkillCategory {
  title: string;
  icon: string; // Lucide icon identifier or FA equivalent
  skills: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  desc: string;
  role: string;
  stack: string;
  problem: string;
  result: string;
  tags: string[];
  live?: string;
  code?: string;
  image?: string;
}

export interface ExperienceItem {
  year: string;
  role: string;
  company: string;
  desc: string;
}

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  twitter?: string;
  email: string;
}

export interface BuildingMeta {
  id: number;
  number: string;
  name: string;
  storefrontTitle: string;
  subtitle: string;
  awningColor: number; // Hex color for 3D awning
  trimColor: string;   // Hex string for UI accents
  icon: string;
  xPos: number;        // Street X coordinate in 3D scene
}

export interface PortfolioContent {
  personal: {
    name: string;
    tagline: string;
    role: string;
    bioIntro: string;
    bioDetails: string[];
    isOpenToWork: boolean;
    avatarUrl?: string;
  };
  socials: SocialLinks;
  buildings: BuildingMeta[];
  skills: SkillCategory[];
  projects: ProjectItem[];
  experiences: ExperienceItem[];
}

export const PORTFOLIO_CONTENT: PortfolioContent = {
  personal: {
    // TODO: Update your full display name
    name: 'Aditya Gupta',
    // TODO: Update your professional title
    role: 'Full-Stack Developer & Creative Engineer',
    // TODO: Update your headline tagline
    tagline: 'I build fast, beautiful 3D web experiences.',
    // TODO: Update your bio intro text
    bioIntro:
      'Welcome to The Studio. I specialize in turning complex ideas into intuitive, high-performance digital products. With a strong foundation in both system architecture and visual design, I build experiences that are completely immersive.',
    bioDetails: [
      "When I'm not writing code, you'll usually find me experimenting with 3D motion graphics or exploring the intersection of web performance and creative storytelling.",
      'Deeply committed to accessibility, clean code architecture, and 60 FPS silky smooth web interactions.',
    ],
    // TODO: Toggle Open to Work badge in the About panel
    isOpenToWork: true,
    // TODO: Add an avatar image path (e.g., '/images/avatar.jpg') if desired
    avatarUrl: '',
  },

  socials: {
    // TODO: Add your personal GitHub URL
    github: 'https://github.com',
    // TODO: Add your LinkedIn profile URL
    linkedin: 'https://linkedin.com',
    // TODO: Add your X / Twitter handle URL (or leave empty)
    twitter: '',
    // TODO: Add your direct contact email address
    email: 'aditya.gupta.dev@portfolio.io',
  },

  buildings: [
    {
      id: 0,
      number: '101',
      name: 'About Me',
      storefrontTitle: 'THE STUDIO',
      subtitle: '101 Brownstone Ave • Bio & Story',
      awningColor: 0x991f2e,
      trimColor: '#f87171',
      icon: 'User',
      xPos: -52,
    },
    {
      id: 1,
      number: '103',
      name: 'Skills',
      storefrontTitle: 'TECH FOUNDRY',
      subtitle: '103 Brownstone Ave • Engineering Stack',
      awningColor: 0xe6dac1,
      trimColor: '#fbbf24',
      icon: 'Zap',
      xPos: -26,
    },
    {
      id: 2,
      number: '105',
      name: 'Projects',
      storefrontTitle: 'INNOVATION HUB',
      subtitle: '105 Brownstone Ave • Featured Builds',
      awningColor: 0x991f2e,
      trimColor: '#34d399',
      icon: 'FolderGit2',
      xPos: 0,
    },
    {
      id: 3,
      number: '107',
      name: 'Resume',
      storefrontTitle: 'CAREER ARCHIVE',
      subtitle: '107 Brownstone Ave • Experience & CV',
      awningColor: 0xe6dac1,
      trimColor: '#38bdf8',
      icon: 'FileText',
      xPos: 26,
    },
    {
      id: 4,
      number: '109',
      name: 'Contact',
      storefrontTitle: 'CONNECT LOUNGE',
      subtitle: "109 Brownstone Ave • Let's Connect",
      awningColor: 0x991f2e,
      trimColor: '#c084fc',
      icon: 'Send',
      xPos: 52,
    },
  ],

  skills: [
    // TODO: Add, remove or customize your skills and categories
    {
      title: 'Frontend & UI',
      icon: 'Layout',
      skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'HTML5 / CSS3'],
    },
    {
      title: '3D Web & Motion',
      icon: 'Box',
      skills: ['Three.js', 'WebGL', 'React Three Fiber', 'GSAP', 'Framer Motion'],
    },
    {
      title: 'Backend & Cloud',
      icon: 'Server',
      skills: ['Node.js', 'Python', 'PostgreSQL', 'REST APIs', 'GraphQL'],
    },
    {
      title: 'DevOps & Tools',
      icon: 'Wrench',
      skills: ['Git', 'Docker', 'AWS', 'Vercel', 'Figma'],
    },
  ],

  projects: [
    // TODO: Replace with your actual project portfolio highlights
    {
      id: 'p1',
      title: 'Brownstone Metropolis',
      desc: 'Photorealistic 3D City Portfolio with procedural street choreography',
      role: 'Sole Developer & Creative Engineer',
      stack: 'React, Three.js, R3F, TypeScript, Tailwind',
      problem:
        'Standard scrolling portfolios lack visual memorability and spatial immersion for creative engineering roles.',
      result:
        'Built a 60fps responsive 3D brownstone environment with procedural textures, articulated pedestrians, traffic, and scroll-linked camera choreography.',
      tags: ['Three.js', 'R3F', 'Creative', 'TypeScript'],
      live: 'https://example.com/demo1',
      code: 'https://github.com/example/brownstone-metropolis',
    },
    {
      id: 'p2',
      title: 'NeuroCanvas',
      desc: 'Multiplayer infinite collaborative canvas workspace',
      role: 'Full-Stack Technical Lead',
      stack: 'React, Node.js, WebSockets, Canvas API',
      problem:
        'Remote engineering and design teams lacked a frictionless real-time whiteboard with low latency cursor presence.',
      result:
        'Engineered an MVP with sub-50ms operational transform synchronization handling 100+ concurrent editors per canvas.',
      tags: ['React', 'WebSockets', 'SaaS', 'Real-time'],
      live: '',
      code: 'https://github.com/example/neuro-canvas',
    },
  ],

  experiences: [
    // TODO: Add your past work experience timeline
    {
      year: '2024 — PRESENT',
      role: 'Senior Frontend & Creative Engineer',
      company: 'NovaStack Digital Labs',
      desc: 'Spearheaded interactive 3D product launches and migrated legacy monolith to micro-frontend architecture with zero downtime.',
    },
    {
      year: '2022 — 2024',
      role: 'Full-Stack Developer',
      company: 'Vertex Cloud Systems',
      desc: 'Engineered scalable React & Node.js SaaS modules and managed automated CI/CD deployment pipelines on AWS.',
    },
    {
      year: '2020 — 2022',
      role: 'UI/UX Developer',
      company: 'Creative Synergies',
      desc: 'Designed and developed responsive component libraries and design systems for enterprise clients.',
    },
  ],
};

