import React, { useState } from 'react';
import type { CharacterKind } from '../../domain/models/islandModels';
import type { SaveDraft } from '../types/uiTypes';
import { Avatar, Icon } from '../common/UiParts';

export const S3SaveSheet: React.FC<{
  character: CharacterKind;
  step: 'input' | 'confirm';
  draft: SaveDraft;
  analyzing: boolean;
  resolvingMode: boolean;
  onChangeDraft: (patch: Partial<SaveDraft>) => void;
  onUploadImage: (file: File) => Promise<{
    imageDataUrl: string;
    stickerDataUrl: string;
    aspect: number;
  }>;
  onAnalyze: () => void;
  onConfirmIntent: (intentText: string) => void;
  onSaveLater: () => void;
  onBackToInput: () => void;
}> = ({
  character,
  step,
  draft,
  analyzing,
  resolvingMode,
  onChangeDraft,
  onUploadImage,
  onAnalyze,
  onConfirmIntent,
  onSaveLater,
  onBackToInput,
}) => {
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [uploadingImg, setUploadingImg] = useState<boolean>(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const processed = await onUploadImage(file);
      onChangeDraft({
        imageDataUrl: processed.imageDataUrl,
        stickerDataUrl: processed.stickerDataUrl,
        aspect: processed.aspect,
        fileName: file.name,
      });
    } finally {
      setUploadingImg(false);
    }
  };

  // Step 1: 自分のスクショ・URL・テキストメモを入力する画面
  if (step === 'input') {
    const canSubmit =
      Boolean(draft.url.trim() || draft.rawText.trim() || draft.imageDataUrl) &&
      !analyzing &&
      !uploadingImg;

    return (
      <div className="save-input">
        <div className="save__ask">
          <Avatar kind={character} size={34} />
          <div>
            <span className="eyebrow eyebrow--accent" style={{ display: 'block' }}>
              NEW INSPIRATION
            </span>
            <span>気になったものを島に浮かべよう</span>
          </div>
        </div>

        <label className="photo save-input__drop">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {draft.stickerDataUrl ? (
            <div className="save-input__preview">
              <img src={draft.stickerDataUrl} alt="プレビュー" />
              <span>タップして画像を変更（ステッカー切り抜き済み）</span>
            </div>
          ) : (
            <>
              <Icon name="add_a_photo" />
              <span>
                {uploadingImg
                  ? 'ステッカーに切り抜き中...'
                  : 'スクショ・写真を選ぶ（または画面へドロップ）'}
              </span>
            </>
          )}
        </label>

        <div className="save-input__field">
          <span className="eyebrow eyebrow--muted">URL · リンク</span>
          <div className="inputpill">
            <input
              type="url"
              placeholder="https://... (Instagram / note / Web記事など)"
              value={draft.url}
              onChange={(e) => onChangeDraft({ url: e.target.value })}
            />
          </div>
        </div>

        <div className="save-input__field">
          <span className="eyebrow eyebrow--muted">MEMO · メモ</span>
          <div className="inputpill">
            <input
              type="text"
              placeholder="気になったことやメモを入力"
              value={draft.rawText}
              onChange={(e) => onChangeDraft({ rawText: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) onAnalyze();
              }}
            />
          </div>
        </div>

        <button
          className="btn btn--ink btn--pill btn--lg"
          disabled={!canSubmit}
          onClick={onAnalyze}
        >
          <Icon name="auto_awesome" />
          <span>{analyzing ? 'Gemini が読み取り中...' : '次へ（やりたいことの候補を出す）'}</span>
        </button>
      </div>
    );
  }

  // Step 2: Gemini が出した 3 つの「やりたいことの 1 文」候補からタップで確定する画面（F3）
  const analyzed = draft.analyzed || {
    kind: 'NOTE' as const,
    title: draft.rawText || draft.url || '保存したアイテム',
    source: 'メモ',
    note: '内容からやりたいことの候補を出したよ',
    color: '#f7a6d6',
    c2: '#f9c6e4',
    intents: ['実際に試してみる', '15分だけ調べてみる', '参考として取っておく'],
  };

  const handlePick = (idx: number, text: string) => {
    setPickedIdx(idx);
    setTimeout(() => {
      onConfirmIntent(text);
    }, 320);
  };

  return (
    <>
      <div className="save__item">
        <div
          className="save__thumb"
          style={{ background: analyzed.color || 'var(--bubble)' }}
        >
          {draft.stickerDataUrl ? <img src={draft.stickerDataUrl} alt="" /> : null}
        </div>
        <div className="save__meta">
          <span className="eyebrow eyebrow--accent">
            {analyzed.kind} · {analyzed.source}
          </span>
          <span className="save__title">{analyzed.title}</span>
          <span className="save__note">{analyzed.note}</span>
        </div>
      </div>

      <div className="save__ask">
        <Avatar kind={character} size={30} />
        <span>これ、どうしたい？</span>
      </div>

      <div className="opts">
        {analyzed.intents.map((intentText, i) => (
          <button
            key={i}
            className={`opt${pickedIdx === i ? ' opt--on' : ''}`}
            onClick={() => handlePick(i, intentText)}
          >
            <span>{intentText}</span>
            <Icon name="check" className={pickedIdx === i ? '' : 'icon--hidden'} />
          </button>
        ))}
      </div>

      {customOpen ? (
        <div className="inputpill">
          <input
            type="text"
            placeholder="〜してみる、の形で"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customText.trim()) {
                onConfirmIntent(customText.trim());
              }
            }}
          />
          <button
            className="iconbtn iconbtn--ink iconbtn--sm"
            onClick={() => onConfirmIntent(customText.trim() || analyzed.intents[0])}
            aria-label="決定"
          >
            <Icon name="check" />
          </button>
        </div>
      ) : null}

      <div className="save__foot">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!resolvingMode ? (
            <button className="linkish" onClick={onBackToInput}>
              <Icon name="arrow_back" />
              入力を直す
            </button>
          ) : null}
          <button className="linkish" onClick={() => setCustomOpen((v) => !v)}>
            <Icon name="edit" />
            自分で書きなおす
          </button>
        </div>
        <button className="btn btn--ghost btn--pill btn--sm" onClick={onSaveLater}>
          あとで
        </button>
      </div>
    </>
  );
};
