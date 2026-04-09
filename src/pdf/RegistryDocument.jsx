// React-PDF document for the Asset Registry Export.
// Kept separate from the page so other report types can reuse the
// font registration and shared styling later.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Path,
} from '@react-pdf/renderer'

// ── Font registration ────────────────────────────────────────────
// react-pdf supports woff2 via the gstatic CDN directly.
Font.register({
  family: 'Cormorant Garamond',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3YmX5slCNuHLi8bLeY9MK7whWMhyjornFLsS6V7w.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3WmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKxy2osiU2.woff2',
      fontWeight: 400,
      fontStyle: 'italic',
    },
    {
      src: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYqnFLsS6V7w.woff2',
      fontWeight: 700,
    },
  ],
})

// Inter is a variable font in google/fonts which react-pdf does not
// handle well. We use the built-in Helvetica for sans-serif body
// labels — visually compatible at small sizes. To switch to true
// Inter, replace 'Helvetica' below with a Font.register() call
// pointing to a static TTF.
const SANS = 'Helvetica'
const SERIF = 'Cormorant Garamond'

// ── Color tokens (PDF version of the app palette) ───────────────
const C = {
  paper:       '#FFFFFF',
  text:        '#1A1A1A',
  textMuted:   '#5A5650',
  textFaint:   '#A09890',
  gold:        '#C9A96E',
  goldDark:    '#7A5520',
  navy:        '#1A2D52',
  white:       '#F6F4EF',
  border:      '#D5D0C8',
  borderFaint: '#EAE7DF',
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Cover
  coverPage: {
    backgroundColor: C.paper,
    padding: 60,
    fontFamily: SERIF,
    color: C.text,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  coverContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  coverShieldWrap: {
    position: 'relative',
    width: 90,
    height: 105,
    marginBottom: 28,
  },
  coverTagline: {
    fontFamily: SANS,
    fontSize: 10,
    color: C.gold,
    letterSpacing: 4,
    marginBottom: 18,
  },
  coverDivider: {
    width: 100,
    height: 1,
    backgroundColor: C.gold,
    marginBottom: 36,
  },
  coverOwner: {
    fontFamily: SERIF,
    fontSize: 36,
    color: C.text,
    marginBottom: 10,
  },
  coverDate: {
    fontFamily: SANS,
    fontSize: 11,
    color: C.textFaint,
    marginBottom: 48,
  },
  coverStats: {
    flexDirection: 'row',
    gap: 60,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: SERIF,
    fontSize: 28,
    color: C.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: SANS,
    fontSize: 9,
    color: C.textFaint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  coverFooter: {
    fontFamily: SANS,
    fontSize: 8,
    color: C.textFaint,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 16,
    borderTop: `1pt solid ${C.borderFaint}`,
  },

  // Inner pages
  page: {
    backgroundColor: C.paper,
    paddingTop: 72,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: SERIF,
    color: C.text,
  },
  header: {
    position: 'absolute',
    top: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: SANS,
    fontSize: 8,
    color: C.textFaint,
  },
  headerLeft: {
    fontFamily: SANS,
    fontSize: 8,
    color: C.textFaint,
  },
  headerRight: {
    fontFamily: SANS,
    fontSize: 8,
    color: C.textFaint,
  },

  // Asset entries
  assetRow: {
    paddingVertical: 10,
  },
  assetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  assetMain: {
    flex: 1,
    paddingRight: 12,
  },
  assetName: {
    fontFamily: SERIF,
    fontSize: 13,
    fontWeight: 700,
    color: C.text,
    marginBottom: 2,
  },
  assetCategory: {
    fontFamily: SANS,
    fontSize: 8,
    color: C.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  assetValue: {
    fontFamily: SERIF,
    fontSize: 13,
    color: C.gold,
    textAlign: 'right',
  },
  assetDesc: {
    fontFamily: SANS,
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
    marginTop: 4,
  },

  // Notes block
  notesBlock: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeft: `1pt solid ${C.gold}`,
  },
  noteSection: {
    marginBottom: 6,
  },
  noteLabel: {
    fontFamily: SANS,
    fontSize: 7,
    color: C.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  noteBody: {
    fontFamily: SANS,
    fontSize: 8,
    fontStyle: 'italic',
    color: C.textMuted,
    lineHeight: 1.5,
  },

  // Divider
  assetDivider: {
    height: 0.5,
    backgroundColor: C.borderFaint,
    marginTop: 12,
  },
})

// ── Provenance shield (recreated as react-pdf SVG primitives) ───
function ProvenanceShield() {
  return (
    <View style={styles.coverShieldWrap}>
      <Svg width={90} height={105} viewBox="-6 0 60 70">
        {/* Outer shield (gold) */}
        <Path
          d="M24,0 L48,0 Q54,0 54,6 L54,36 Q54,58 24,70 Q-6,58 -6,36 L-6,6 Q-6,0 0,0 Z"
          fill={C.gold}
        />
        {/* Inner shield (navy) */}
        <Path
          d="M24,4 L46,4 Q50,4 50,8 L50,36 Q50,55 24,66 Q-2,55 -2,36 L-2,8 Q-2,4 2,4 Z"
          fill={C.navy}
        />
        {/* P letterform — drawn as SVG Text with x/y attributes */}
        <Text
          x="24"
          y="46"
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize="40"
          fontWeight={500}
          fill={C.white}
        >
          P
        </Text>
      </Svg>
    </View>
  )
}

// ── Helpers ──────────────────────────────────────────────────────
function formatDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMoney(n) {
  const num = parseFloat(n) || 0
  return `$${num.toLocaleString('en-US')}`
}

// ── Document component ──────────────────────────────────────────
function RegistryDocument({ ownerName, assets, includeNotes }) {
  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0)
  const safeOwner = ownerName || 'Owner'

  return (
    <Document
      title={`Provenance Registry — ${safeOwner}`}
      author={safeOwner}
      creator="Provenance"
      producer="Provenance"
    >
      {/* ── Cover page ── */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverContent}>
          <ProvenanceShield />
          <Text style={styles.coverTagline}>ESTATE  ASSET  REGISTRY</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverOwner}>{safeOwner}</Text>
          <Text style={styles.coverDate}>Prepared on {formatDate()}</Text>
          <View style={styles.coverStats}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{assets.length}</Text>
              <Text style={styles.statLabel}>Assets</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatMoney(totalValue)}</Text>
              <Text style={styles.statLabel}>Total Value</Text>
            </View>
          </View>
        </View>
        <Text style={styles.coverFooter}>
          This document is for personal reference only. Consult a licensed attorney for estate planning advice.
        </Text>
      </Page>

      {/* ── Asset list page(s) ── */}
      <Page size="LETTER" style={styles.page}>
        {/* Fixed header repeats on every page after the cover */}
        <View style={styles.header} fixed>
          <Text style={styles.headerLeft}>
            Provenance Estate Registry — {safeOwner}
          </Text>
          <Text
            style={styles.headerRight}
            render={({ pageNumber }) => `${pageNumber}`}
          />
        </View>

        {assets.length === 0 ? (
          <Text style={{ fontFamily: SANS, fontSize: 11, color: C.textFaint, textAlign: 'center', marginTop: 60 }}>
            No assets in this registry yet.
          </Text>
        ) : (
          assets.map((asset, i) => (
            <View key={asset.id} style={styles.assetRow}>
              <View style={styles.assetTopRow}>
                <View style={styles.assetMain}>
                  <Text style={styles.assetName}>{asset.name || 'Untitled'}</Text>
                  {asset.category && (
                    <Text style={styles.assetCategory}>{asset.category}</Text>
                  )}
                </View>
                <Text style={styles.assetValue}>{formatMoney(asset.value)}</Text>
              </View>

              {asset.description && (
                <Text style={styles.assetDesc}>{asset.description}</Text>
              )}

              {includeNotes && asset.notes && (
                <View style={styles.notesBlock}>
                  {asset.notes.origin ? (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Origin</Text>
                      <Text style={styles.noteBody}>{asset.notes.origin}</Text>
                    </View>
                  ) : null}
                  {asset.notes.history ? (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>History</Text>
                      <Text style={styles.noteBody}>{asset.notes.history}</Text>
                    </View>
                  ) : null}
                  {asset.notes.meaning ? (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Meaning</Text>
                      <Text style={styles.noteBody}>{asset.notes.meaning}</Text>
                    </View>
                  ) : null}
                  {asset.notes.legacy ? (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Legacy</Text>
                      <Text style={styles.noteBody}>{asset.notes.legacy}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {i < assets.length - 1 && <View style={styles.assetDivider} />}
            </View>
          ))
        )}
      </Page>
    </Document>
  )
}

export default RegistryDocument
