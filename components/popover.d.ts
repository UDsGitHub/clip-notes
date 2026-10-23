import 'react';

// React 18's types predate the Popover API; React passes these lowercase attributes through.
// The type parameters must match React's own declarations to merge.
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'auto' | 'manual' | '';
  }
  interface ButtonHTMLAttributes<T> {
    popovertarget?: string;
  }
}
