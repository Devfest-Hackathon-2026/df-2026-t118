import React, { useState } from 'react';
import type {
  AreaEntity,
  CharacterKind,
  ProjectEntity,
} from '../../domain/models/islandModels';
import type { SaveDraft } from '../types/uiTypes';
import { Avatar, Icon } from '../common/UiParts';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB (F02)

export const S3SaveSheet: React.FC<{
  character: CharacterKind;
  step: 'input' | 'confirm';
  draft: SaveDraft;
  analyzing: boolean;
  resolvingMode: boolean;
  aiConsentGranted?: boolean;
  projects?: ProjectEntity[];
  areas?: AreaEntity[];
  onToggleAiConsent?: (granted: boolean) => void;
  onChangeDraft: (patch: Partial<SaveDraft>) => void;
  onUploadImage: (file: File) => Promise<{
    imageDataUrl: string;
    stickerDataUrl: string;
    aspect: number;
  }>;
  onAnalyze: () => void;
  onConfirmIntent: (intentText: string) => void;
  onSaveReference?: () => void;
  onSaveLater: () => void;
  onBackToInput: () => void;
}> = ({
  character,
  step,
  draft,
  analyzing,
  resolvingMode,
  aiConsentGranted = true,
  projects = [],
  areas = [],
  onToggleAiConsent,
  onChangeDraft,
  onUploadImage,
  onAnalyze,
  onConfirmIntent,
  onSaveReference,
  onSaveLater,
  onBackToInput,
}) => {
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [uploadingImg, setUploadingImg] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeAreas = areas.filter((a) => a.status === 'active');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    if (file.size > MAX_IMAGE_BYTES) {
      setFileError('画像サイズが上限（10 MB）を超えています。別の画像を選んでください。');
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
      setFileError(
        'HEIC形式はブラウザによって表示できない場合があります。PNG / JPEG / WebP 画像を選んでください。'
      );
      return;
    }

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
            accept="image/png,image/jpeg,image/webp,image/*"
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
                  : 'スクショ・写真を選ぶ（PNG/JPEG/WebP・10MBまで）'}
              </span>
            </>
          )}
        </label>

        {fileError ? (
          <span style={{ fontSize: '12px', color: '#c0392b' }}>{fileError}</span>
        ) : null}

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

        {onToggleAiConsent ? (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={aiConsentGranted}
              onChange={(e) => onToggleAiConsent(e.target.checked)}
            />
            <span>
              Gemini AI に入力内容を送信して意図候補を提案してもらう（オフ時は手動保存）
            </span>
          </label>
        ) : null}

        <button
          className="btn btn--ink btn--pill btn--lg"
          disabled={!canSubmit}
          onClick={onAnalyze}
        >
          <Icon name="auto_awesome" />
          <span>
            {analyzing
              ? 'Gemini が読み取り中...'
              : aiConsentGranted
                ? '次へ（やりたいことの候補を出す）'
                : '次へ（手動で意図と保存先を選ぶ）'}
          </span>
        </button>
      </div>
    );
  }

  // Step 2: Gemini が出した 3 つの「やりたいことの 1 文」候補 + Project/Area 即時紐づけ（F02 / F03）
  const analyzed = draft.analyzed || {
    kind: 'NOTE' as const,
    title: draft.rawText || draft.url || '保存したアイテム',
    source: 'メモ',
    note: '内容からやりたいことの候補を出したよ',
    color: '#f7a6d6',
    c2: '#f9c6e4',
    intents: ['実際に試してみる', '自分の制作に取り入れる', '参考資料として残しておく'],
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
            {analyzed.resourceTopic ? ` · テーマ: ${analyzed.resourceTopic}` : ''}
          </span>
          <span className="save__title">{analyzed.title}</span>
          <span className="save__note">{analyzed.note}</span>
        </div>
      </div>

      {draft.url && analyzed.urlFetched === false ? (
        <div
          className="card"
          style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted)' }}
        >
          ※リンク先の本文は自動取得できなかったため、URLのみ記録します（必要なら「入力を直す」からメモやスクショを補足できます）
        </div>
      ) : null}

      {activeProjects.length > 0 || activeAreas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="eyebrow eyebrow--muted">
            LINK TO PROJECT / AREA · 保存先の紐づけ（任意）
          </span>
          <div className="row-chips">
            <button
              className={`chip${!draft.selectedTargetId ? ' chip--ink' : ' chip--soft'}`}
              onClick={() => onChangeDraft({ selectedTargetId: null })}
            >
              AIで自動照合 / 保留
            </button>
            {activeProjects.map((proj) => (
              <button
                key={proj.id}
                className={`chip${
                  draft.selectedTargetId === proj.id ? ' chip--ink' : ' chip--soft'
                }`}
                onClick={() => onChangeDraft({ selectedTargetId: proj.id })}
              >
                Project: {proj.name}
              </button>
            ))}
            {activeAreas.map((area) => (
              <button
                key={area.id}
                className={`chip${
                  draft.selectedTargetId === area.id ? ' chip--ink' : ' chip--soft'
                }`}
                onClick={() => onChangeDraft({ selectedTargetId: area.id })}
              >
                Area: {area.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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

      <div className="save__foot" style={{ flexWrap: 'wrap', gap: '8px' }}>
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onSaveReference ? (
            <button
              className="btn btn--ghost btn--pill btn--sm"
              onClick={onSaveReference}
              title="行動提案には使わず、参考資料（Resources）として残します"
            >
              見るだけ・参考
            </button>
          ) : null}
          <button className="btn btn--ghost btn--pill btn--sm" onClick={onSaveLater}>
            あとで
          </button>
        </div>
      </div>
    </>
  );
};
