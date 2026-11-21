import { View } from 'react-native';
import type { HandoffView, SensitiveSection, SourceRef } from '../../lib/api';
import { fmtTime } from '../../lib/clock';
import { color, radius } from '../../theme/tokens';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';
import { T } from '../ui/Text';

const LINE_WIDTHS = [[94, 88, 71], [90, 62]];
const TAIL_WIDTHS = [[86, 92, 54], [90, 83, 95, 40], [88, 76], [92, 85, 60]];

function Lines({ widths }: { widths: number[] }) {
  return (
    <View aria-hidden style={{ gap: 6 }}>
      {widths.map((w, i) => (
        <View key={i} style={{ height: 8, width: `${w}%`, backgroundColor: color.pdfGutter, borderRadius: 2 }} />
      ))}
    </View>
  );
}

/**
 * C-07 · Mock render of one packet page with the quoted text highlighted. The highlight carries
 * a tag naming the brief item, so it is not color alone. Placeholder until a real PDF renderer
 * (e.g. a server-rendered page image or a native PDF view) is wired in.
 */
export function PacketPage({ view, source, phone }: { view: HandoffView; source?: SourceRef; phone?: boolean }) {
  const { patient, from, handoff } = view;
  const page = source?.page ?? 1;
  return (
    <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: '#FFFFFF', paddingTop: phone ? 24 : 40, paddingHorizontal: phone ? 20 : 44, paddingBottom: phone ? 28 : 48, gap: 14, shadowColor: '#0F1B2A', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: color.pdfGutter, paddingBottom: 8 }}>
        <T size={11} color={color.textTertiary} style={{ flex: 1 }}>
          {from.name} · Discharge summary · {patient.name} · DOB {patient.dob}
        </T>
        <T size={11} color={color.textTertiary}>
          Page {page} of {handoff.pageCount}
        </T>
      </View>
      <T size={17} style={{ fontFamily: 'Georgia', fontWeight: '700', color: color.pdfInk, paddingTop: 6 }}>
        {source?.section ?? 'Discharge summary'}
      </T>
      {LINE_WIDTHS.map((w, i) => (
        <Lines key={i} widths={w} />
      ))}
      {source ? (
        <View style={{ marginTop: 18 }}>
          <View style={{ position: 'absolute', top: -22, left: -4, height: 20, paddingHorizontal: 6, backgroundColor: color.ink, borderRadius: 3, justifyContent: 'center', zIndex: 1 }}>
            <T size={11} weight={600} color="#FFFFFF">
              Quoted by brief · {source.tag}
            </T>
          </View>
          <View style={{ backgroundColor: color.sourceHighlight, borderWidth: 2, borderColor: color.sourceHighlightOutline, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 8 }}>
            <T size={15} lineHeight={22} style={{ fontFamily: 'Georgia', color: color.pdfInk }}>
              {source.quote}
            </T>
          </View>
        </View>
      ) : null}
      {TAIL_WIDTHS.map((w, i) => (
        <Lines key={i} widths={w} />
      ))}
    </View>
  );
}

export function HighlightLegend({ tag }: { tag: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <View aria-hidden style={{ width: 14, height: 14, backgroundColor: color.sourceHighlight, borderWidth: 2, borderColor: color.sourceHighlightOutline, borderRadius: 2 }} />
      <T size={13} color={color.textSecondary} style={{ flex: 1 }}>
        Highlight = text the brief quoted for "{tag}". Matched by AI; confirm it says what the brief says.
      </T>
    </View>
  );
}

/** C-11 · Sensitive section: collapsed by default; revealing is logged and says so before and after. */
export function SensitiveSectionCard({ section, revealed, revealedAt, onToggle }: { section: SensitiveSection; revealed: boolean; revealedAt?: string; onToggle: () => void }) {
  return (
    <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: color.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={revealed ? 'eye' : 'eye-off'} size={18} color={color.textSecondary} />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 180, gap: 2 }}>
          <T size={15} weight={600}>
            {section.title}
          </T>
          <T size={13} color={color.textTertiary}>
            {revealed ? 'Revealed · logged in Activity' : 'Sensitive, tap to reveal · revealing is logged'}
          </T>
        </View>
        <Button variant="secondary" fontSize={14} label={revealed ? 'Hide' : 'Reveal'} onPress={onToggle} accessibilityHint={revealed ? undefined : 'Revealing is recorded in the activity log'} />
      </View>
      {revealed ? (
        <View style={{ borderTopWidth: 1, borderTopColor: color.borderSubtle, paddingTop: 10, gap: 8 }}>
          <T size={15} lineHeight={22} color={color.textSecondary}>
            {section.body}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={13} color={color.textTertiary} />
            <T size={13} color={color.textTertiary}>
              Revealed by you at {fmtTime(revealedAt)} · recorded in Activity
            </T>
          </View>
        </View>
      ) : null}
    </View>
  );
}

