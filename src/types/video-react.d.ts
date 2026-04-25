// ./src/types/video-react.d.ts
declare module 'video-react' {
  import * as React from 'react';

  export interface PlayerProps {
    src?: string;
    poster?: string;
    playsInline?: boolean;
    className?: string;
    children?: React.ReactNode;
    // ไม่ต้องประกาศ ref ที่นี่
  }

  export class Player extends React.Component<PlayerProps> {}
}
