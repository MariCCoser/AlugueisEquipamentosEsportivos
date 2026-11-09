import type { ApiExposta } from '../shared/api';

declare global {
  interface Window {
    api: ApiExposta;
  }
}
