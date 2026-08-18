/**
 * Reproductions of diagrams that appear in the source documents.
 *
 * Registered by key so a document names a drawing rather than carrying markup.
 * Edge labels are set horizontally beside their side rather than rotated along
 * it as in the original: at phone width, text on a 60° slant is not readable.
 * The structure and the wording are the source's.
 */

function StateTriangle() {
  return (
    <svg
      className="diagram__svg"
      viewBox="0 84 640 358"
      role="img"
      aria-label="Emotional State sits at the centre of three inputs: Physiology, Cognition in the Moment, and Language and Meaning"
    >
      <polygon
        points="320,110 470,330 170,330"
        className="diagram__shape"
        fill="none"
        strokeLinejoin="round"
      />

      <text x="320" y="243" className="diagram__center" textAnchor="middle">
        Emotional
      </text>
      <text x="320" y="277" className="diagram__center" textAnchor="middle">
        State
      </text>

      {/* Left side */}
      <line x1="245" y1="220" x2="198" y2="220" className="diagram__tick" />
      <text x="186" y="206" className="diagram__label" textAnchor="end">
        Physiology
      </text>
      <text x="186" y="228" className="diagram__note" textAnchor="end">
        what you’re doing
      </text>
      <text x="186" y="246" className="diagram__note" textAnchor="end">
        with your body
      </text>

      {/* Right side */}
      <line x1="395" y1="220" x2="442" y2="220" className="diagram__tick" />
      <text x="454" y="206" className="diagram__label" textAnchor="start">
        Cognition in the
      </text>
      <text x="454" y="228" className="diagram__label" textAnchor="start">
        Moment
      </text>
      <text x="454" y="248" className="diagram__note" textAnchor="start">
        Focus
      </text>

      {/* Base */}
      <line x1="320" y1="330" x2="320" y2="368" className="diagram__tick" />
      <text x="320" y="392" className="diagram__label" textAnchor="middle">
        Language / Meaning
      </text>
      <text x="320" y="414" className="diagram__note" textAnchor="middle">
        (self-talk)
      </text>
    </svg>
  );
}

const DIAGRAMS: Record<string, () => JSX.Element> = {
  'state-triangle': StateTriangle,
};

export default function Diagram({ name }: { name: string }) {
  const Drawing = DIAGRAMS[name];
  if (!Drawing) return null;
  return (
    <figure className="diagram">
      <Drawing />
    </figure>
  );
}
