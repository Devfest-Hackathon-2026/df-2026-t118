import React from 'react';
import { AVATAR_PARTS } from '../../domain/constants/islandConstants';
import type { CharacterKind } from '../../domain/models/islandModels';

export const Icon: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <span className={`icon${className ? ` ${className}` : ''}`}>{name}</span>
);

export const Avatar: React.FC<{ kind: CharacterKind; size: number }> = ({ kind, size }) => {
  const count = AVATAR_PARTS[kind] || 8;
  return (
    <span
      className={`avatar avatar--${kind}`}
      style={{ '--s': `${size}px` } as React.CSSProperties}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <i key={idx} />
      ))}
    </span>
  );
};

export const SayBubble: React.FC<{
  character: CharacterKind;
  name: string;
  text: string;
  tag?: string | null;
}> = ({ character, name, text, tag }) => (
  <div className="say">
    <Avatar kind={character} size={44} />
    <div className="say__body">
      <div className="say__head">
        <span className="say__name">{name}</span>
        {tag ? <span className="tag">{tag}</span> : null}
      </div>
      <p className="say__text">{text}</p>
    </div>
  </div>
);
