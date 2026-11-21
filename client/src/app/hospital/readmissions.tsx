import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { WebPage } from '../../components/layout/Shell';
import { TONE, Tag, SourceNote } from '../../components/quality/Tag';
import { AiLabel, Avatar } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Radio } from '../../components/ui/Controls';
import { EmptyState, Loading } from '../../components/ui/States';
import { B, Mono, T } from '../../components/ui/Text';
import { FAILURE_OPTIONS, listReadmissionReviews, type FailurePoint, type ReadmissionReview, type ReviewEvent } from '../../lib/api/quality-extra';
import { useQuery } from '../../lib/api/useQuery';
import { color, familyFor, radius } from '../../theme/tokens';

type Draft = { pick?: FailurePoint; secondary: boolean; notes: string; saved: boolean };
const card = { backgroundColor: color.bgSurface, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg } as const;

/** Quality: review 30-day readmissions against the handoff record and record a failure point. */
export default function ReadmissionReviewScreen() {
  const { data: reviews, loading } = useQuery(() => listReadmissionReviews(), []);
  const [selId, setSelId] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  if (loading) return <WebPage side="hospital"><Loading /></WebPage>;
  if (!reviews?.length)
    return (
      <WebPage side="hospital">
        <EmptyState icon="check-circle" title="No readmissions to review" body="Returns within 30 days of a Handoff discharge show up here from the ADT feed." />
      </WebPage>
    );

  const sel = reviews.find((r) => r.id === selId) ?? reviews[0];
  const draft: Draft = drafts[sel.id] ?? { secondary: !!sel.secondary, notes: '', saved: false };
  const setDraft = (d: Partial<Draft>) => setDrafts((all) => ({ ...all, [sel.id]: { ...draft, ...d } }));

  return (
    <WebPage side="hospital">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', paddingBottom: 16 }}>
        <Queue reviews={reviews} selId={sel.id} onSelect={setSelId} />
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 860, minWidth: 0, gap: 16 }}>
          <Identity r={sel} />
          <ReadmitBanner r={sel} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <Timeline r={sel} />
            <View accessibilityLabel="Failure point review" style={{ flexGrow: 1, flexShrink: 1, flexBasis: 380, minWidth: 0, gap: 16 }}>
              <AiSuggestion r={sel} />
              <FindingForm r={sel} draft={draft} setDraft={setDraft} />
            </View>
          </View>
        </View>
      </View>
    </WebPage>
  );
}

function Queue({ reviews, selId, onSelect }: { reviews: ReadmissionReview[]; selId: string; onSelect: (id: string) => void }) {
  return (
    <View accessibilityLabel="Readmissions to review" style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, gap: 10 }}>
      <T accessibilityRole="header" size={17} lineHeight={24} weight={600}>
        To review · {reviews.length}
      </T>
      <T size={13} color={color.textTertiary}>
        Returns within 30 days · source: Riverside ADT feed (demo)
      </T>
      {reviews.map((r) => {
        const on = r.id === selId;
        const aiColor = r.queueTone === 'critical' ? color.critical : r.queueTone === 'important' ? color.important : color.textSecondary;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="link"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${r.queueName}, born ${r.birthYear}. ${r.queueLine}. ${r.queueAi}`}
            onPress={() => onSelect(r.id)}
            style={{ backgroundColor: color.bgSurface, borderWidth: on ? 2 : 1, borderColor: on ? color.accent : color.borderDefault, borderRadius: 10, padding: 12, gap: 4 }}
          >
            <T size={15} lineHeight={20} weight={700}>
              {r.queueName} · born {r.birthYear}
            </T>
            <T size={13} lineHeight={18} color={color.textSecondary}>
              {r.queueLine}
            </T>
            <T size={13} lineHeight={18} color={aiColor}>
              {r.queueAi}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Identity({ r }: { r: ReadmissionReview }) {
  const p = r.patient;
  return (
    <View accessibilityLabel="Patient identity" style={[card, { paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar initials={p.initials} size={44} />
        <View style={{ gap: 2 }}>
          <T accessibilityRole="header" aria-level={1} size={20} lineHeight={28} weight={700}>
            {p.name}
          </T>
          <T size={14} color={color.textSecondary}>
            <RNText style={{ color: color.textTertiary }}>DOB</RNText> <Mono color={color.textPrimary}>{p.dob}</Mono> · {p.ageYears} y{'   '}
            <RNText style={{ color: color.textTertiary }}>MRN</RNText> <Mono color={color.textPrimary}>{p.mrn}</Mono>
          </T>
        </View>
      </View>
      <T size={15} color={color.textSecondary} style={{ flexShrink: 1 }}>
        {r.stay}
      </T>
    </View>
  );
}

function ReadmitBanner({ r }: { r: ReadmissionReview }) {
  return (
    <View style={{ backgroundColor: color.criticalBg, borderWidth: 1, borderColor: color.criticalBorder, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320, gap: 2 }}>
        <T size={13} weight={600} color={color.critical}>
          Readmitted {r.daysAfter} day{r.daysAfter === 1 ? '' : 's'} after discharge
        </T>
        <T size={20} lineHeight={28} weight={700}>
          {r.diagnosis}
        </T>
        <T size={14} color={color.textSecondary}>
          {r.arrival}
        </T>
      </View>
      <T size={13} color={color.textSecondary} style={{ flexShrink: 1 }}>
        Source: Riverside ADT feed (demo) · principal diagnosis on admission
      </T>
    </View>
  );
}

const DOT: Record<ReviewEvent['kind'], { fill: string; ring: string }> = {
  plain: { fill: color.bgSurface, ring: color.borderStrong },
  ok: { fill: color.success, ring: color.success },
  bad: { fill: color.critical, ring: color.critical },
  urgent: { fill: color.critical, ring: color.critical },
  admit: { fill: color.ink, ring: color.ink },
};

function Timeline({ r }: { r: ReadmissionReview }) {
  return (
    <View accessibilityLabel="Handoff timeline" style={[card, { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, padding: 20 }]}>
      <T accessibilityRole="header" size={18} lineHeight={26} weight={600} style={{ marginBottom: 4 }}>
        Handoff timeline
      </T>
      <SourceNote size={13}>Source: Handoff event log · {r.timelineRange}</SourceNote>
      <View accessibilityRole="list" style={{ marginTop: 16 }}>
        {r.events.map((e, i) => {
          const d = DOT[e.kind];
          const tag = e.tag ? (e.kind === 'bad' ? TONE.critical : TONE.success) : undefined;
          return (
            <View key={i} accessibilityRole="listitem" style={{ flexDirection: 'row', gap: 10 }}>
              <T size={12} mono color={color.textSecondary} align="right" style={{ width: 92, paddingTop: 3 }}>
                {e.t}
              </T>
              <View style={{ width: 24, alignItems: 'center' }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: d.fill, borderWidth: 2, borderColor: d.ring, marginTop: 3 }} />
                <View style={{ flex: 1, width: 2, backgroundColor: color.borderDefault, minHeight: 16 }} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4, paddingBottom: 16 }}>
                <T size={15} lineHeight={20} weight={600}>
                  {e.title}
                </T>
                <T size={14} lineHeight={20} color={color.textSecondary}>
                  {e.detail}
                </T>
                {e.tag && tag ? <Tag label={e.tag} tone={e.kind === 'bad' ? 'critical' : 'success'} icon={e.kind === 'bad' ? 'alert-triangle' : 'check'} /> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AiSuggestion({ r }: { r: ReadmissionReview }) {
  const label = FAILURE_OPTIONS.find((o) => o.key === r.aiPick)!.label;
  const conf = { low: 'neutral', medium: 'important', high: 'success' } as const;
  const openSource = (page: number) => r.handoffId && router.push(`/aftercare/${r.handoffId}?tab=packet&page=${page}` as never);
  return (
    <View style={{ backgroundColor: color.bgSurface, borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, borderRadius: radius.lg, padding: 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <T accessibilityRole="header" size={18} lineHeight={26} weight={600} style={{ flex: 1, minWidth: 180 }}>
          AI-suggested failure point
        </T>
        <AiLabel />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <T size={20} lineHeight={28} weight={700}>
          {label}
        </T>
        <Tag label={`Confidence: ${r.confidence}`} tone={conf[r.confidence]} />
      </View>
      <View accessibilityRole="list" style={{ gap: 8 }}>
        {r.findings.map((parts, i) => (
          <View key={i} accessibilityRole="listitem" style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
            <T size={14} lineHeight={20} aria-hidden>
              •
            </T>
            <T size={14} lineHeight={20} style={{ flex: 1 }}>
              {parts.map((p, j) =>
                typeof p === 'string' ? (
                  p
                ) : 'b' in p ? (
                  <B key={j}>{p.b}</B>
                ) : (
                  <RNText key={j} accessibilityRole="link" accessibilityLabel={`View source, page ${p.page}`} onPress={() => openSource(p.page)} style={{ color: color.accent, textDecorationLine: 'underline' }}>
                    p.{p.page}
                  </RNText>
                ),
              )}
            </T>
          </View>
        ))}
      </View>
      <T size={13} color={color.textTertiary}>
        {r.notChecked}
      </T>
    </View>
  );
}

function FindingForm({ r, draft, setDraft }: { r: ReadmissionReview; draft: Draft; setDraft: (d: Partial<Draft>) => void }) {
  const pick = draft.pick ?? r.aiPick;
  const changed = pick !== r.aiPick;
  const saved = draft.saved;
  const label = FAILURE_OPTIONS.find((o) => o.key === pick)!.label;
  const summary = label + (changed ? ' (changed from AI)' : ' (AI confirmed)') + (r.secondary && draft.secondary ? ` + ${r.secondary.summary}` : '');
  return (
    <View style={[card, { padding: 20, gap: 14 }]}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Your finding" style={{ gap: 4 }}>
        <T accessibilityRole="header" size={18} lineHeight={26} weight={600} style={{ paddingBottom: 10 }}>
          Your finding
        </T>
        {FAILURE_OPTIONS.map((o) => {
          const on = o.key === pick;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: saved }}
              disabled={saved}
              onPress={() => setDraft({ pick: o.key })}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: on ? color.accentSelectedBg : 'transparent', opacity: saved && !on ? 0.6 : 1 }}
            >
              <Radio selected={on} size={18} />
              <T size={15} style={{ flex: 1 }}>
                {o.label}
              </T>
              {o.key === r.aiPick ? (
                <View style={{ height: 22, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: color.borderStrong, justifyContent: 'center' }}>
                  <T size={12} lineHeight={16} color={color.textSecondary}>
                    AI suggestion
                  </T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {r.secondary ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.secondary, disabled: saved }} disabled={saved} onPress={() => setDraft({ secondary: !draft.secondary })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
          <Checkbox checked={draft.secondary} size={18} />
          <T size={14} style={{ flex: 1 }}>
            {r.secondary.label}
          </T>
        </Pressable>
      ) : null}
      <View style={{ gap: 6 }}>
        <T size={14} weight={600} color={color.textSecondary}>
          Notes
        </T>
        <Field
          accessibilityLabel="Notes"
          multiline
          numberOfLines={3}
          editable={!saved}
          value={draft.notes}
          onChangeText={(notes) => setDraft({ notes })}
          placeholder="What did you check? Who did you talk to?"
        />
      </View>
      {!saved ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <T size={14} color={color.textSecondary} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200 }}>
            {changed ? 'You changed the finding from the AI suggestion. Add a note explaining why.' : 'Confirming records your name; the AI suggestion alone never counts.'}
          </T>
          <Button label={changed ? 'Save my finding' : 'Confirm AI suggestion'} onPress={() => setDraft({ saved: true })} style={{ height: 44, paddingHorizontal: 18 }} />
        </View>
      ) : (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: color.successBg, borderWidth: 1, borderColor: color.successBorder, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8 }}>
          <Icon name="check-circle" size={16} color={color.success} />
          <T size={14} lineHeight={20} style={{ flex: 1 }}>
            <RNText style={{ fontFamily: familyFor(700), color: color.success }}>Review saved</RNText> by Elena Ruiz (demo) · 11/21 10:05 · {summary} · counts toward Metrics
          </T>
        </View>
      )}
    </View>
  );
}
