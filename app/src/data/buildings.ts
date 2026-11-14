import { PORTFOLIO_CONTENT } from './content';
import { CITY_CONFIG } from '../config/cityConfig';

export interface BuildingProxyDef {
  id: number;
  number: string;
  name: string;
  storefrontTitle: string;
  subtitle: string;
  trimColor: string;
  xPos: number;
  zPos: number;
  boxSize: [number, number, number]; // [width, height, depth] of invisible click proxy
  labelPos: [number, number, number]; // [x, y, z] for floating label above entrance
  facadeVariant: 1 | 2; // Building 1_3 or Building 2_2
}

export const BUILDING_PROXIES: BuildingProxyDef[] = [
  {
    id: 0,
    number: '101',
    name: 'About Me',
    storefrontTitle: 'THE STUDIO',
    subtitle: '101 Brownstone Ave • Bio & Story',
    trimColor: '#f87171',
    xPos: -52,
    zPos: CITY_CONFIG.NORTH_ROW_Z,
    boxSize: [14.0, 9.0, 6.0],
    labelPos: [-52, 7.8, CITY_CONFIG.NORTH_ROW_Z + 3.5],
    facadeVariant: 2,
  },
  {
    id: 1,
    number: '103',
    name: 'Skills',
    storefrontTitle: 'TECH FOUNDRY',
    subtitle: '103 Brownstone Ave • Engineering Stack',
    trimColor: '#fbbf24',
    xPos: -26,
    zPos: CITY_CONFIG.NORTH_ROW_Z,
    boxSize: [14.0, 9.0, 6.0],
    labelPos: [-26, 7.8, CITY_CONFIG.NORTH_ROW_Z + 3.5],
    facadeVariant: 1,
  },
  {
    id: 2,
    number: '105',
    name: 'Projects',
    storefrontTitle: 'INNOVATION HUB',
    subtitle: '105 Brownstone Ave • Featured Builds',
    trimColor: '#34d399',
    xPos: 0,
    zPos: CITY_CONFIG.NORTH_ROW_Z,
    boxSize: [14.0, 9.0, 6.0],
    labelPos: [0, 7.8, CITY_CONFIG.NORTH_ROW_Z + 3.5],
    facadeVariant: 2,
  },
  {
    id: 3,
    number: '107',
    name: 'Resume',
    storefrontTitle: 'CREDENTIAL ARCHIVE',
    subtitle: '107 Brownstone Ave • Career & Education',
    trimColor: '#60a5fa',
    xPos: 26,
    zPos: CITY_CONFIG.NORTH_ROW_Z,
    boxSize: [14.0, 9.0, 6.0],
    labelPos: [26, 7.8, CITY_CONFIG.NORTH_ROW_Z + 3.5],
    facadeVariant: 1,
  },
  {
    id: 4,
    number: '109',
    name: 'Contact',
    storefrontTitle: 'COMMUNICATION POST',
    subtitle: '109 Brownstone Ave • Get in Touch',
    trimColor: '#c084fc',
    xPos: 52,
    zPos: CITY_CONFIG.NORTH_ROW_Z,
    boxSize: [14.0, 9.0, 6.0],
    labelPos: [52, 7.8, CITY_CONFIG.NORTH_ROW_Z + 3.5],
    facadeVariant: 2,
  },
];

// Re-export content references for consistency
export { PORTFOLIO_CONTENT };
