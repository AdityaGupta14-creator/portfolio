/**
 * PORTFOLIO DATA CONTENT & TYPE DEFINITIONS
 * All UI panels, 3D signage, and overlays read from this typed configuration.
 * Real credentials and project details for Aditya Gupta.
 */

export interface SkillCategory {
  title: string;
  icon: string;
  skills: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  desc: string; // One-line summary
  badge?: string;
  bullets: string[]; // Role bullets
  tags: string[]; // Tech tags
  repoUrl?: string; // Code button shown only when set
  liveUrl?: string; // Live button shown only when set
  image?: string; // Project screenshot or banner
  // Compatibility fields
  role?: string;
  stack?: string;
  problem?: string;
  result?: string;
  code?: string;
  live?: string;
}

export interface EducationItem {
  degree: string;
  institution: string;
  period: string;
  cgpa: string;
  details: string;
}

export interface AchievementItem {
  title: string;
  category: 'Competition' | 'Hackathon' | 'Simulation' | 'Course';
  badge?: string;
}

export interface ExperienceItem {
  year: string;
  role: string;
  company: string;
  desc: string;
}

export interface SocialLinks {
  github: string;
  linkedin: string;
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
  trimColor: string; // Hex string for UI accents
  icon: string;
  xPos: number; // Street X coordinate in 3D scene
}

export interface HeroContent {
  headlinePrefix: string;
  headlineHighlight: string;
  subline: string;
  supporting: string;
  primaryButtonText: string;
  secondaryLinkText: string;
  scrollHintText: string;
}

export interface PortfolioContent {
  hero: HeroContent;
  personal: {
    name: string;
    tagline: string;
    role: string;
    subline: string;
    statusTag: string;
    bioIntro: string;
    bioDetails: string[];
    highlights: string[];
    isOpenToWork: boolean;
    avatarUrl?: string;
  };
  socials: SocialLinks;
  buildings: BuildingMeta[];
  skills: SkillCategory[];
  projects: ProjectItem[];
  education: EducationItem[];
  achievements: AchievementItem[];
  experiences: ExperienceItem[];
}

export const PORTFOLIO_CONTENT: PortfolioContent = {
  hero: {
    headlinePrefix: 'I build software that shows up when it ',
    headlineHighlight: 'matters.',
    subline: 'Aditya Gupta · Full-Stack Developer · B.Tech Electronics & Computer Science',
    supporting: "Winner of E-Cell Eureka 2026. Walk down my street to see what I've built.",
    primaryButtonText: 'Walk the street',
    secondaryLinkText: 'Skip to projects',
    scrollHintText: 'Scroll to enter the street',
  },
  personal: {
    name: 'Aditya Gupta',
    role: 'Full-Stack Developer',
    tagline: 'Second-year B.Tech ECS Student • Open to internships',
    subline: 'Aditya Gupta · Full-Stack Developer · B.Tech Electronics & Computer Science',
    statusTag: 'Open to internships',
    bioIntro:
      'Second-year B.Tech Electronics and Computer Science student at Vidyalankar Institute of Technology, Mumbai (expected graduation 2029, CGPA 9.38 first year).',
    bioDetails: [
      'Builds full-stack web and mobile apps with React, Next.js, Node.js, TypeScript and Python (FastAPI).',
      'Actively seeking a software internship where I can apply strong fundamentals in system architecture, modern frontend frameworks, and cloud-backed services.',
    ],
    highlights: [
      'E-Cell Eureka 2026 Winner',
      'AI-Prompt Night Winner',
      'Top 8 TCS College Hackathon',
    ],
    isOpenToWork: true,
    // TODO: Add your avatar image path (e.g. '/images/avatar.jpg') if desired
    avatarUrl: '',
  },

  socials: {
    github: 'https://github.com/AdityaGupta14-creator',
    linkedin: 'https://www.linkedin.com/in/aditya-gupta-3735a5400/',
    // TODO: Add your Twitter / X URL if desired
    twitter: '',
    email: 'ag4034967@gmail.com',
  },

  buildings: [
    {
      id: 0,
      number: '101',
      name: 'About Me',
      storefrontTitle: 'THE STUDIO',
      subtitle: '101 Brownstone Ave • Bio & Profile',
      awningColor: 0x991f2e,
      trimColor: '#f87171',
      icon: 'User',
      xPos: -38.469,
    },
    {
      id: 1,
      number: '103',
      name: 'Skills',
      storefrontTitle: 'TECH FOUNDRY',
      subtitle: '103 Brownstone Ave • Core Toolkit',
      awningColor: 0xe6dac1,
      trimColor: '#fbbf24',
      icon: 'Zap',
      xPos: -19.234,
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
      subtitle: '107 Brownstone Ave • Education & CV',
      awningColor: 0xe6dac1,
      trimColor: '#38bdf8',
      icon: 'FileText',
      xPos: 19.234,
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
      xPos: 38.469,
    },
  ],

  skills: [
    {
      title: 'Languages',
      icon: 'Code2',
      skills: ['JavaScript', 'TypeScript', 'Python', 'Java'],
    },
    {
      title: 'Frontend',
      icon: 'Layout',
      skills: [
        'React.js',
        'Next.js',
        'TanStack Start',
        'React Native',
        'HTML',
        'CSS',
        'Tailwind CSS',
      ],
    },
    {
      title: 'Backend',
      icon: 'Server',
      skills: ['Node.js', 'Express.js', 'FastAPI', 'REST APIs'],
    },
    {
      title: 'Database',
      icon: 'Database',
      skills: ['MongoDB', 'PostgreSQL', 'Supabase', 'Firebase Authentication'],
    },
    {
      title: 'AI/ML',
      icon: 'Brain',
      skills: ['Machine learning fundamentals', 'PennyLane (Quantum ML)'],
    },
    {
      title: 'Tools',
      icon: 'Wrench',
      skills: ['Git', 'GitHub', 'Postman', 'VS Code'],
    },
  ],

  projects: [
    {
      id: 'resqnet',
      title: 'ResQNet — Emergency Response Mobile App',
      badge: 'Winner, E-Cell Eureka 2026',
      desc: 'Emergency response mobile app with automated offline SMS dispatch to the nearest hospitals upon accident detection.',
      role: 'Frontend & UI Lead',
      stack: 'React Native, Offline SMS Automation',
      bullets: [
        'Built the app frontend (core screens, navigation, reusable UI components, user flows).',
        'Implemented an automated alert workflow that sends SMS to the five nearest hospitals when an accident is detected.',
        'Integrated with accident-detection and location services with the team.',
      ],
      tags: ['React Native', 'Offline SMS Automation', 'Location Services', 'Mobile UI'],
      // TODO: Add ResQNet GitHub repoUrl when ready
      repoUrl: '',
      // TODO: Add ResQNet liveUrl/demo link when ready
      liveUrl: '',
      // TODO: Add ResQNet screenshot image path when ready
      image: '',
      code: '',
      live: '',
    },
    {
      id: 'verity',
      title: 'VERITY — Academic Integrity / Plagiarism Detection Engine',
      badge: '270/270 Tests Passing',
      desc: 'Offline-first platform analysing document similarity with exact, fuzzy and semantic signals.',
      role: 'Full-Stack Lead',
      stack: 'React 19, TypeScript, TanStack Start, Tailwind CSS, Node.js',
      bullets: [
        'Offline-first platform analysing document similarity with exact, fuzzy and semantic signals.',
        'Faculty review workflows and student reports with role-specific access.',
        '270/270 passing tests and a clean TypeScript check.',
      ],
      tags: ['React 19', 'TypeScript', 'TanStack Start', 'Tailwind CSS', 'Node.js'],
      // TODO: Add VERITY GitHub repoUrl when ready
      repoUrl: '',
      // TODO: Add VERITY liveUrl when ready
      liveUrl: '',
      // TODO: Add VERITY screenshot image path when ready
      image: '',
      code: '',
      live: '',
    },
    {
      id: 'kaktus',
      title: 'Kaktus — Browser-Based Hardware IDE',
      badge: 'In Development',
      desc: 'Browser-based IDE concept for electronics prototyping with Supabase-backed workspace and chat sync.',
      role: 'Full-Stack Developer',
      stack: 'React, TypeScript, Firebase Authentication, Supabase',
      bullets: [
        'Browser-based IDE concept for electronics prototyping.',
        'Authentication and role-based access.',
        'Supabase-backed workspace and chat sync with server-side authorization.',
      ],
      tags: ['React', 'TypeScript', 'Firebase Authentication', 'Supabase'],
      repoUrl: 'https://github.com/AdityaGupta14-creator/final-kaktus',
      code: 'https://github.com/AdityaGupta14-creator/final-kaktus',
      // TODO: Add Kaktus liveUrl demo when ready
      liveUrl: '',
      live: '',
      // TODO: Add Kaktus screenshot image path when ready
      image: '',
    },
    {
      id: 'q-sentinel',
      title: 'Q-Sentinel — Quantum ML for Tuberculosis Diagnostics',
      badge: 'Quantum ML',
      desc: 'Hybrid quantum-classical diagnostic platform coupling variational quantum circuits with clinical biomarker workflows.',
      role: 'Backend & ML Engineer',
      stack: 'Python, FastAPI, PennyLane',
      bullets: [
        'Backend services for patient-data processing and quantum/classical ML analysis.',
        'An 8-qubit variational quantum circuit for experimental TB risk assessment.',
        'API workflows linking biomarkers, model outputs and advisory responses, with fallback handling when model components are unavailable.',
      ],
      tags: ['Python', 'FastAPI', 'PennyLane', 'Quantum ML', 'REST APIs'],
      // TODO: Add Q-Sentinel GitHub repoUrl when ready
      repoUrl: '',
      // TODO: Add Q-Sentinel liveUrl demo when ready
      liveUrl: '',
      // TODO: Add Q-Sentinel screenshot image path when ready
      image: '',
      code: '',
      live: '',
    },
  ],

  education: [
    {
      degree: 'B.Tech in Electronics and Computer Science',
      institution: 'Vidyalankar Institute of Technology, Mumbai',
      period: 'Expected Graduation: 2029 (Second-Year Student)',
      cgpa: '9.38 / 10.0 (First Year)',
      details:
        'Focus on full-stack software development, distributed systems, web architectures, and machine learning.',
    },
  ],

  achievements: [
    {
      title: 'Winner — E-Cell Eureka 2026',
      category: 'Competition',
      badge: 'Winner',
    },
    {
      title: 'Winner — AI-Prompt Night',
      category: 'Competition',
      badge: 'Winner',
    },
    {
      title: 'Top 8 — TCS College Hackathon',
      category: 'Hackathon',
      badge: 'Top 8',
    },
    {
      title: 'Top 30 — NeoFuture Hackathon',
      category: 'Hackathon',
      badge: 'Top 30',
    },
    {
      title: 'Deloitte Technology Job Simulation',
      category: 'Simulation',
      badge: 'Completed',
    },
    {
      title: 'Siemens Research Intern Job Simulation',
      category: 'Simulation',
      badge: 'Completed',
    },
    {
      title: 'TCS Soft Skills Course (2025–26)',
      category: 'Course',
      badge: 'Completed',
    },
  ],

  experiences: [
    {
      year: '2025 — 2029',
      role: 'B.Tech Electronics & Computer Science',
      company: 'Vidyalankar Institute of Technology, Mumbai',
      desc: 'Second-year undergraduate (expected graduation 2029, CGPA 9.38 first year). Builds full-stack apps with React, Next.js, Node.js, TypeScript and Python (FastAPI).',
    },
    {
      year: '2026',
      role: 'Hackathon & Innovation Awards',
      company: 'E-Cell Eureka 2026 & AI-Prompt Night',
      desc: 'Winner at E-Cell Eureka 2026 (ResQNet), Winner at AI-Prompt Night, and Top 8 at TCS College Hackathon.',
    },
  ],
};

