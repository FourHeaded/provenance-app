// Provenance brand logo. Heraldic shield + "P" letterform.
//
// Variants:
//   horizontal — shield + "Provenance" + "ESTATE ASSET REGISTRY" tagline
//   compact    — shield + "Provenance" on a single line
//   icon       — shield only, sized to the `size` prop
//
// Props:
//   variant: 'horizontal' | 'compact' | 'icon'  (default: 'horizontal')
//   size:    number  (default: 40, only used for icon variant)
//   theme:   'dark' | 'light'  (optional — falls back to data-theme attribute)

function getOuterFill(theme) {
  return theme === 'light' ? '#9A7030' : '#C9A96E'
}

function Shield({ height }) {
  // SVG aspect ratio is 60 wide x 70 tall (viewBox -6 0 60 70)
  const width = height * (60 / 70)
  return (
    <svg
      width={width}
      height={height}
      viewBox="-6 0 60 70"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer shield (gold) */}
      <path
        d="M24,0 L48,0 Q54,0 54,6 L54,36 Q54,58 24,70 Q-6,58 -6,36 L-6,6 Q-6,0 0,0 Z"
        fill="var(--logo-outer)"
      />
      {/* Inner shield (navy) */}
      <path
        d="M24,4 L46,4 Q50,4 50,8 L50,36 Q50,55 24,66 Q-2,55 -2,36 L-2,8 Q-2,4 2,4 Z"
        fill="#1A2D52"
      />
      {/* P letterform */}
      <text
        x="24"
        y="46"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', serif"
        fontSize="40"
        fontWeight="500"
        fill="#F6F4EF"
      >
        P
      </text>
    </svg>
  )
}

function Logo({ variant = 'horizontal', size = 40, theme }) {
  const resolvedTheme =
    theme ||
    (typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme')
      : null) ||
    'dark'

  // Pass the correct outer color via a CSS custom property on the wrapper
  // so the inline SVG renders correctly regardless of where it's mounted.
  const cssVars = { '--logo-outer': getOuterFill(resolvedTheme) }

  if (variant === 'icon') {
    return (
      <span className="logo logo--icon" style={cssVars}>
        <Shield height={size} />
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <span className="logo logo--compact" style={cssVars}>
        <Shield height={32} />
        <span className="logo-wordmark logo-wordmark--compact">Provenance</span>
      </span>
    )
  }

  // horizontal (default)
  return (
    <span className="logo logo--horizontal" style={cssVars}>
      <Shield height={48} />
      <span className="logo-text">
        <span className="logo-wordmark">Provenance</span>
        <span className="logo-tagline">ESTATE ASSET REGISTRY</span>
      </span>
    </span>
  )
}

export default Logo
