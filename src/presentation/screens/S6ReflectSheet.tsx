import React, { useState } from 'react';
import type { CharacterKind, Proposal } from '../../domain/models/islandModels';
import { Avatar, Icon } from '../common/UiParts';

const REFLECT_OPTS: Array<['done' | 'mada' | 'enough', string, string]> = [
  ['done', 'できた', 'sentiment_satisfied'],
  ['mada', 'まだ', 'hourglass_empty'],
  ['enough', 'もういい', 'waves'],
];

const WORDS = ['思ったより簡単', '楽しかった', 'ちょっと大変'];

export const S6ReflectSheet: React.FC<{
  character: CharacterKind;
  proposal: Proposal | null;
  onUploadImage: (file: File) => Promise<{ imageDataUrl: string; stickerDataUrl: string }>;
  onFinishDone: (word: string | null, photoDataUrl: string | null) => void;
  onFinishMada: () => void;
  onFinishRelease: () => void;
}> = ({ character, proposal, onUploadImage, onFinishDone, onFinishMada, onFinishRelease }) => {
  const [pick, setPick] = useState<'done' | 'mada' | 'enough' | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleSelectOpt = (k: 'done' | 'mada' | 'enough') => {
    setPick(k);
    if (k === 'mada') {
      onFinishMada();
    } else if (k === 'enough') {
      onFinishRelease();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await onUploadImage(file);
    setPhotoUrl(processed.imageDataUrl);
  };

  return (
    <>
      <div className="prop__head">
        <Avatar kind={character} size={44} />
        <div className="prop__who">
          <span className="display display--sm">Done?</span>
          <span className="prop__from">
            できた？ · {proposal?.title || '今日の一歩'}
          </span>
        </div>
      </div>

      <div className="row3">
        {REFLECT_OPTS.map(([k, label, ic]) => (
          <button
            key={k}
            className={`big${pick === k ? ' big--on' : ''}`}
            onClick={() => handleSelectOpt(k)}
          >
            <Icon name={ic} className="icon--lg" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {pick === 'done' ? (
        <div className="reflect__more">
          <span className="eyebrow eyebrow--muted">ONE WORD · OPTIONAL</span>
          <div className="row-chips">
            {WORDS.map((w) => (
              <button
                key={w}
                className={`chip${word === w ? ' chip--ink' : ' chip--soft'}`}
                onClick={() => setWord(word === w ? null : w)}
              >
                {w}
              </button>
            ))}
          </div>

          <label className="photo" style={{ cursor: 'pointer', overflow: 'hidden' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="記録写真"
                style={{ maxHeight: '72px', borderRadius: '12px' }}
              />
            ) : (
              <>
                <Icon name="add_a_photo" />
                <span>写真を足す（任意）</span>
              </>
            )}
          </label>

          <button
            className="btn btn--ink btn--pill btn--lg"
            onClick={() => onFinishDone(word, photoUrl)}
          >
            島にもどる（建物を建てる）
          </button>
        </div>
      ) : null}
    </>
  );
};
