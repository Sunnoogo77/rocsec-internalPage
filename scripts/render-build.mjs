import { execFileSync } from 'node:child_process';
const api = process.env.VITE_API_BASE_URL;
if (!api || !/^https:\/\/[^/]+\/api\/v1\/?$/.test(api)) throw new Error('Configure VITE_API_BASE_URL as an explicit HTTPS API URL ending in /api/v1.');
if (!process.env.VITE_PUBLIC_SITE_URL?.startsWith('https://')) throw new Error('Configure VITE_PUBLIC_SITE_URL.');
execFileSync('npm', ['ci', '--include=dev'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
