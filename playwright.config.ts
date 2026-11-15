import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:120000,workers:1,use:{baseURL:process.env.TEST_URL||'http://127.0.0.1:4321/rendering-lab/',channel:'chromium',headless:true,launchOptions:{args:['--enable-unsafe-webgpu']}},reporter:'list'});
