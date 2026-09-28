import { useId } from 'react';
import { SCENES, VIEWBOX, describeScene, sceneState, type SceneId } from '../model/precision-model';
import { EquationScene, FinaleScene, GraphScene, IntroScene, RulerScene, TallyTable, TransferScene } from './scenes';

interface StageProps {
  scene: SceneId;
  /** Time used for drawing (already quantized when reduced motion is on). */
  t: number;
  /** Time used for the text description (the finished picture of the current caption). */
  descriptionT: number;
  reducedMotion: boolean;
}

export function Stage({ scene, t, descriptionT, reducedMotion }: StageProps) {
  const state = sceneState(scene, t);
  const description = describeScene(sceneState(scene, descriptionT));
  const titleId = useId();
  const descId = useId();

  return (
    <figure className={`stage stage-${state.kind}`} data-scene={scene} data-display-t={Math.round(t)} data-motion={reducedMotion ? 'reduced' : 'full'}>
      {state.kind === 'graph' && <TallyTable s={state} />}
      <svg
        className="stage-svg"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{SCENES[scene].name}</title>
        <desc id={descId}>{description}</desc>
        <rect x={0} y={0} width={VIEWBOX.width} height={VIEWBOX.height} fill="#fffdf8" />
        {state.kind === 'intro' && <IntroScene s={state} />}
        {state.kind === 'ruler' && <RulerScene s={state} />}
        {state.kind === 'graph' && <GraphScene s={state} />}
        {state.kind === 'equation' && <EquationScene s={state} />}
        {state.kind === 'transfer' && <TransferScene s={state} />}
        {state.kind === 'finale' && <FinaleScene s={state} />}
      </svg>
    </figure>
  );
}
