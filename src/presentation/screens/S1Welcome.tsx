import React, { useState } from 'react';
import {
  NAMES,
  ONBOARDING_AREA_PRESETS,
  ONBOARDING_EXPECTATION_PRESETS,
  ONBOARDING_INTEREST_PRESETS,
  ONBOARDING_PROJECT_GENRES,
} from '../../domain/constants/islandConstants';
import type { CharacterKind } from '../../domain/models/islandModels';
import { Avatar, Icon } from '../common/UiParts';

export const S1Welcome: React.FC<{
  character: CharacterKind;
  onStart: () => void;
  onCompleteOnboarding?: (params: {
    projects: Array<{ name: string; goal: string }>;
    areaNames: string[];
    interests: string[];
    expectations: string[];
  }) => void;
}> = ({ character, onStart, onCompleteOnboarding }) => {
  const [surveyOpen, setSurveyOpen] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);

  // Q1: 今進めていること（Project）
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [projectGoal, setProjectGoal] = useState<string>('');
  const [addedProjects, setAddedProjects] = useState<Array<{ name: string; goal: string }>>([]);

  // Q2: 日々大切にしたいこと（Area）
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Q3: よく保存するもの（関心）
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Q4: しまに期待すること
  const [selectedExpectations, setSelectedExpectations] = useState<string[]>([]);

  const toggleItem = (list: string[], val: string, setter: (next: string[]) => void) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const handleSelectGenre = (g: { genre: string; defaultName: string; defaultGoal: string }) => {
    setSelectedGenre(g.genre);
    if (!projectName.trim()) {
      setProjectName(g.defaultName);
      setProjectGoal(g.defaultGoal);
    }
  };

  const handleAddDraftProject = () => {
    const trimmed = projectName.trim();
    if (!trimmed) return;
    setAddedProjects((prev) => [...prev, { name: trimmed, goal: projectGoal.trim() }]);
    setProjectName('');
    setProjectGoal('');
    setSelectedGenre(null);
  };

  const handleFinishSurvey = () => {
    const finalProjects = [...addedProjects];
    if (projectName.trim()) {
      finalProjects.push({ name: projectName.trim(), goal: projectGoal.trim() });
    }
    if (onCompleteOnboarding) {
      onCompleteOnboarding({
        projects: finalProjects,
        areaNames: selectedAreas,
        interests: selectedInterests,
        expectations: selectedExpectations,
      });
    } else {
      onStart();
    }
  };

  return (
    <div className="s1">
      <div className="s1__head">
        <span className="eyebrow">WELCOME</span>
        <h1 className="display display--xl">
          Hello,
          <br />
          your island.
        </h1>
        <span className="s1__sub">はじめまして。ここが、きみの島。</span>
      </div>

      <div className="s1__foot" style={{ maxWidth: '520px', width: '100%' }}>
        {!surveyOpen ? (
          <>
            <div className="glass s1__card">
              <Avatar kind={character} size={48} />
              <p className="s1__text">
                {NAMES[character]}だよ。気になったものを送ってくれたら、今進めていることにつなげて島に浮かべておくね。
              </p>
            </div>
            <div className="row2">
              <button
                className="btn btn--ghost btn--pill btn--lg"
                onClick={() => setSurveyOpen(true)}
              >
                <Icon name="tune" />
                今の取り組みを設定
              </button>
              <button className="btn btn--ink btn--pill btn--lg" onClick={onStart}>
                はじめる
              </button>
            </div>
          </>
        ) : (
          <div
            className="glass"
            style={{
              padding: '18px 20px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow eyebrow--accent">
                INITIAL SETUP · STEP {step + 1} / 4（すべて任意）
              </span>
              <button className="linkish" onClick={onStart}>
                スキップして島へ →
              </button>
            </div>

            {step === 0 ? (
              <>
                <strong style={{ fontSize: '15px' }}>
                  Q1. 今進めていること（Project）はありますか？
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  ジャンルを選ぶと具体的な取り組み名の例が入ります（あとで設定から編集できます）
                </span>
                <div className="row-chips">
                  {ONBOARDING_PROJECT_GENRES.map((g) => (
                    <button
                      key={g.genre}
                      className={`chip${selectedGenre === g.genre ? ' chip--ink' : ' chip--soft'}`}
                      onClick={() => handleSelectGenre(g)}
                    >
                      {g.genre}
                    </button>
                  ))}
                </div>
                <div className="inputpill">
                  <input
                    type="text"
                    placeholder="具体的な取り組み名（例：アプリのデモを完成させる）"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="inputpill">
                  <input
                    type="text"
                    placeholder="目的・メモ（任意）"
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                  />
                  {projectName.trim() ? (
                    <button
                      className="btn btn--ghost btn--pill btn--sm"
                      onClick={handleAddDraftProject}
                    >
                      ＋追加
                    </button>
                  ) : null}
                </div>
                {addedProjects.length > 0 ? (
                  <div className="row-chips">
                    {addedProjects.map((p, i) => (
                      <span key={i} className="chip chip--ink">
                        Project: {p.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : step === 1 ? (
              <>
                <strong style={{ fontSize: '15px' }}>
                  Q2. 日々大切にしたい領域（Area）は？
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  完了目標ではなく、継続して整えたい暮らしや活動の領域を選べます（複数可）
                </span>
                <div className="row-chips">
                  {ONBOARDING_AREA_PRESETS.map((area) => (
                    <button
                      key={area}
                      className={`chip${
                        selectedAreas.includes(area) ? ' chip--ink' : ' chip--soft'
                      }`}
                      onClick={() => toggleItem(selectedAreas, area, setSelectedAreas)}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </>
            ) : step === 2 ? (
              <>
                <strong style={{ fontSize: '15px' }}>Q3. よく保存するものは？</strong>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  関心の補助情報として参考にします（これだけで勝手にProjectは作りません）
                </span>
                <div className="row-chips">
                  {ONBOARDING_INTEREST_PRESETS.map((interest) => (
                    <button
                      key={interest}
                      className={`chip${
                        selectedInterests.includes(interest) ? ' chip--ink' : ' chip--soft'
                      }`}
                      onClick={() =>
                        toggleItem(selectedInterests, interest, setSelectedInterests)
                      }
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <strong style={{ fontSize: '15px' }}>Q4. しまに期待することは？</strong>
                <div className="row-chips">
                  {ONBOARDING_EXPECTATION_PRESETS.map((exp) => (
                    <button
                      key={exp}
                      className={`chip${
                        selectedExpectations.includes(exp) ? ' chip--ink' : ' chip--soft'
                      }`}
                      onClick={() =>
                        toggleItem(selectedExpectations, exp, setSelectedExpectations)
                      }
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="row2" style={{ marginTop: '4px' }}>
              {step > 0 ? (
                <button
                  className="btn btn--ghost btn--pill"
                  onClick={() => setStep((s) => s - 1)}
                >
                  戻る
                </button>
              ) : (
                <button
                  className="btn btn--ghost btn--pill"
                  onClick={() => setSurveyOpen(false)}
                >
                  キャンセル
                </button>
              )}
              {step < 3 ? (
                <button
                  className="btn btn--ink btn--pill"
                  onClick={() => setStep((s) => s + 1)}
                >
                  次へ
                </button>
              ) : (
                <button className="btn btn--ink btn--pill" onClick={handleFinishSurvey}>
                  この設定で島をはじめる
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
