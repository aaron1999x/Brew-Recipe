import { useEffect, useState } from 'react';

export interface Route {
  path: string; // e.g. /brews/abc
  parts: string[];
  query: URLSearchParams;
}

const parse = (): Route => {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return { path: clean, parts: clean.split('/').filter(Boolean), query: new URLSearchParams(qs) };
};

export const navigate = (to: string) => {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
};

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
