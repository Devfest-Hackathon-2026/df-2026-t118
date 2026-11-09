import React, { useEffect, useRef, useState } from 'react';
import {
  ONBOARDING_AREA_PRESETS,
  ONBOARDING_FAVORITE_EXAMPLES,
  ONBOARDING_INTEREST_PRESETS,
  ONBOARDING_PROJECT_IDEAS,
} from '../../domain/constants/islandConstants';
import type { CharacterKind } from '../../domain/models/islandModels';
import {
  ONBOARDING_COPY,
  ONBOARDING_PROPOSAL_SAMPLE,
  ONBOARDING_STEP_IDS,
  onboardingProgress,
  suggestAreasFromInterests,
} from '../../domain/rules/onboardingRules';
import { Avatar, Icon } from '../common/UiParts';

export interface OnboardingSubmission {
  projects: Array<{ name: string; goal: string }>;
  areaNames: string[];
  interests: string[];
  expectations: string[];
  /** 「好き」帳の最初の1件（空なら登録しない） */
  favoriteName: string;
  favoriteHint: string;
  /** 外への検索の同意。ボタンそのものが同意であり、既定は false */
  acceptedSearch: boolean;
  /** 最後に「さいしょのひとつを送る」を選んだか */
  openSave: boolean;
}

/** ぽこのひとこと。見えているものにだけ言及する */
const Says: React.FC<{ character: CharacterKind; text: string; size?: number }> = ({
  character,
  text,
  size = 40,
}) => (
  <div className="s1__say">
    <Avatar kind={character} size={size} />
    <p className="s1__text">{text}</p>
  </div>
);

export const S1Welcome: React.FC<{
  character: CharacterKind;
  onStart: () => void;
  onCompleteOnboarding?: (params: OnboardingSubmission) => void;
  onStepChange?: (step: number, interests: string[]) => void;
}> = ({ character, onStart, onCompleteOnboarding, onStepChange }) => {
  const [step, setStep] = useState<number>(0);

  // 1. よく保存するもの（関心）。島に浮かぶ見本カードの題にもなる
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  // 2. 大事にしたいこと（Area）
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areasSeeded, setAreasSeeded] = useState<boolean>(false);
  // 3. いま形にしたいこと（Project・任意）
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [projectGoal, setProjectGoal] = useState<string>('');
  // 5. 好きな人（「好き」帳の最初の1件）と、外への検索の同意
  const [favoriteName, setFavoriteName] = useState<string>('');
  const [searchAccepted, setSearchAccepted] = useState<boolean>(false);

  const stepId = ONBOARDING_STEP_IDS[step];
  const copy = ONBOARDING_COPY[stepId];
  const isLast = step === ONBOARDING_STEP_IDS.length - 1;

  // 島に実演させる。毎描画ではなく、画面か関心が変わったときだけ知らせる
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  useEffect(() => {
    onStepChangeRef.current?.(step, selectedInterests);
  }, [step, selectedInterests]);

  const toggleItem = (list: string[], val: string, setter: (next: string[]) => void) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const goNext = () => {
    // 関心 → Area。答えが次の画面を変えることを、ここで実際に起こす
    if (stepId === 'interests' && !areasSeeded) {
      const suggested = suggestAreasFromInterests(selectedInterests);
      if (suggested.length > 0) setSelectedAreas(suggested);
      setAreasSeeded(true);
    }
    setStep((s) => Math.min(s + 1, ONBOARDING_STEP_IDS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSelectIdea = (idea: { label: string; goal: string }) => {
    setSelectedIdea(idea.label);
    setProjectName(idea.label);
    setProjectGoal(idea.goal);
  };

  const finish = (openSave: boolean) => {
    if (!onCompleteOnboarding) {
      onStart();
      return;
    }
    onCompleteOnboarding({
      projects: projectName.trim()
        ? [{ name: projectName.trim(), goal: projectGoal.trim() }]
        : [],
      areaNames: selectedAreas,
      interests: selectedInterests,
      // 「しまに期待すること」は答えで提案が変わらないため聞かない（concept.md）
      expectations: [],
      favoriteName,
      // 手がかりのメモは初回では聞かない。必要になったら連絡箱が確認する
      favoriteHint: '',
      acceptedSearch: searchAccepted,
      openSave,
    });
  };

  const favoriteGiven = Boolean(favoriteName.trim());

  return (
    <div className="s1">
      <div className="s1__topbar">
        {step > 0 ? (
          <button className="s1__back" onClick={goBack} aria-label="戻る">
            <Icon name="arrow_back" />
          </button>
        ) : (
          <span className="s1__back s1__back--hidden" aria-hidden="true" />
        )}
        <div
          className="s1__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={ONBOARDING_STEP_IDS.length - 1}
          aria-valuenow={step}
        >
          <span
            className="s1__progress-fill"
            style={{ width: `${onboardingProgress(step) * 100}%` }}
          />
        </div>
        <button className="linkish s1__skip" onClick={onStart}>
          あとで
        </button>
      </div>

      {/* 質問のない画面（建物が建つ・締め）は島が画面いっぱいなので、内容を下に寄せる */}
      <div
        className={`s1__stage${
          !copy.question && stepId !== 'birth' ? ' s1__stage--low' : ''
        }`}
      >
        <div className="s1__block">
          <h1 className={stepId === 'birth' ? 'display display--xl' : 'display'}>
            {copy.heading}
          </h1>

          {/* 島が見せたことに、ぽこが名前をつける。1画面につきガラスのパネルは1枚だけ */}
          <div className="glass s1__panel">
            <Says character={character} text={copy.poko} size={stepId === 'birth' ? 48 : 40} />

            {/* 朝の提案の見本。本番と同じく、主役は集めたもので、一歩は小さく添える */}
            {stepId === 'project' ? (
              <div className="s1__sample">
                <span className="s1__sample-label">{ONBOARDING_PROPOSAL_SAMPLE.label}</span>
                <div className="s1__things">
                  {ONBOARDING_PROPOSAL_SAMPLE.things.map((thing, idx) => (
                    <span key={thing} className={`s1__thing s1__thing--${idx}`}>
                      {thing}
                    </span>
                  ))}
                </div>
                <span className="s1__sample-hint">{ONBOARDING_PROPOSAL_SAMPLE.hint}</span>
              </div>
            ) : null}

            {copy.question ? <span className="s1__q">{copy.question}</span> : null}

          {stepId === 'interests' ? (
            <div className="row-chips">
              {ONBOARDING_INTEREST_PRESETS.map((interest) => (
                <button
                  key={interest}
                  className={`chip${
                    selectedInterests.includes(interest) ? ' chip--ink' : ' chip--soft'
                  }`}
                  onClick={() => toggleItem(selectedInterests, interest, setSelectedInterests)}
                >
                  {interest}
                </button>
              ))}
            </div>
          ) : null}

          {stepId === 'areas' ? (
            <div className="row-chips">
              {ONBOARDING_AREA_PRESETS.map((area) => (
                <button
                  key={area}
                  className={`chip${selectedAreas.includes(area) ? ' chip--ink' : ' chip--soft'}`}
                  onClick={() => toggleItem(selectedAreas, area, setSelectedAreas)}
                >
                  {area}
                </button>
              ))}
            </div>
          ) : null}

          {stepId === 'project' ? (
            <>
              <div className="row-chips">
                {ONBOARDING_PROJECT_IDEAS.map((idea) => (
                  <button
                    key={idea.label}
                    className={`chip${
                      selectedIdea === idea.label ? ' chip--ink' : ' chip--soft'
                    }`}
                    onClick={() => handleSelectIdea(idea)}
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
              {/* 取り組み名は選んだ言葉そのもの。初回では文章を書かせず、
                  名前と目的は設定・一覧からあとで編集できる（ADR-004） */}
              {selectedIdea ? <span className="s1__note">{projectGoal}</span> : null}
            </>
          ) : null}

          {stepId === 'favorite' ? (
            <>
              {/* 入力は1つだけ。同名の多い名前は確認待ちになり、連絡箱があとで聞く */}
              <div className="inputpill">
                <input
                  type="text"
                  placeholder={`アーティスト・作家名（例：${ONBOARDING_FAVORITE_EXAMPLES.name}）`}
                  value={favoriteName}
                  onChange={(e) => setFavoriteName(e.target.value)}
                />
              </div>
              {copy.note ? <span className="s1__note">{copy.note}</span> : null}
            </>
          ) : null}
          </div>
        </div>
      </div>

      <div className="s1__foot">
        {stepId === 'birth' ? (
          <button className="btn btn--ink btn--pill btn--lg" onClick={goNext}>
            はじめる
          </button>
        ) : null}

        {stepId === 'interests' ||
        stepId === 'areas' ||
        stepId === 'project' ||
        stepId === 'grow' ? (
          <button className="btn btn--ink btn--pill btn--lg" onClick={goNext}>
            つぎへ
          </button>
        ) : null}

        {stepId === 'favorite' ? (
          favoriteGiven ? (
            // ボタンそのものが外への検索の同意。トグルにはしない
            <div className="row2">
              <button
                className="btn btn--ink btn--pill btn--lg"
                onClick={() => {
                  setSearchAccepted(true);
                  goNext();
                }}
              >
                探してもらう
              </button>
              <button
                className="btn btn--ghost btn--pill btn--lg"
                onClick={() => {
                  setSearchAccepted(false);
                  goNext();
                }}
              >
                いまは探さない
              </button>
            </div>
          ) : (
            <button
              className="btn btn--ghost btn--pill btn--lg"
              onClick={() => {
                setSearchAccepted(false);
                goNext();
              }}
            >
              いまは決めない
            </button>
          )
        ) : null}

        {isLast ? (
          // 「眺めるだけでもいい」を嘘にしないため、2つのボタンは同じ大きさにする
          <div className="row2">
            <button className="btn btn--ink btn--pill btn--lg" onClick={() => finish(true)}>
              送ってみる
            </button>
            <button className="btn btn--ghost btn--pill btn--lg" onClick={() => finish(false)}>
              まず島を眺める
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
